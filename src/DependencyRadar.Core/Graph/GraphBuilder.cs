using System.Security.Cryptography;
using System.Text;
using DependencyRadar.Parsing;

namespace DependencyRadar.Graph;

/// <summary>
/// Assembles the in-memory graph from parsed solutions and projects.
///
/// Rules that matter:
///   - Project nodes are keyed by their absolute path (stable regardless of sln membership).
///   - A project may belong to multiple solutions; it gets one node, with multiple SolutionContains edges.
///   - A package is "internal" iff its PackageId matches the PackageId of a packable scanned project.
///     When matched, a ProducedBy edge links Package -> Project. This is the edge that closes the cross-repo loop.
///   - Packages that aren't matched locally are classified as "unknown". We never call out to nuget.org.
///   - Multi-targeted projects: we union dependency sets across TFMs (one node, all refs).
/// </summary>
internal sealed class GraphBuilder
{
    private readonly Dictionary<string, RepoNode> _repos = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, SolutionNode> _solutions = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, ProjectNode> _projects = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, PackageEntry> _packages = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<Edge> _edges = new();
    private readonly IReadOnlyList<string> _namePrefixes;

    // Map from absolute csproj path to the owning solution id (first sln wins; we additionally emit
    // SolutionContains edges for each membership).
    private readonly Dictionary<string, string> _projectPathToPrimarySolutionId = new(StringComparer.OrdinalIgnoreCase);

    public GraphBuilder(IReadOnlyList<string>? namePrefixes = null)
    {
        _namePrefixes = namePrefixes ?? Array.Empty<string>();
    }

    public void AddDiscovered(DiscoveryResult discovered)
    {
        // 1) Repos — one per distinct git root, falling back to the scan root when a project is not under a repo.
        foreach (var proj in discovered.Projects)
        {
            var repoPath = proj.GitRepoRoot ?? discovered.Root;
            EnsureRepo(repoPath);
        }
        foreach (var sln in discovered.Solutions)
        {
            var repoPath = Discovery.FindGitRepoRoot(sln.Path) ?? discovered.Root;
            EnsureRepo(repoPath);
        }

        // 2) Solution nodes.
        foreach (var sln in discovered.Solutions)
        {
            var repoPath = Discovery.FindGitRepoRoot(sln.Path) ?? discovered.Root;
            var repoId = _repos[repoPath].Id;
            var id = IdFor("sln", sln.Path);
            var node = new SolutionNode(id, StripPrefixes(Path.GetFileNameWithoutExtension(sln.Path)), sln.Path, repoId);
            _solutions[id] = node;

            foreach (var entry in sln.Projects)
            {
                _projectPathToPrimarySolutionId.TryAdd(entry.AbsoluteCsprojPath, id);
            }
        }

        // 3) Project nodes.
        foreach (var proj in discovered.Projects)
        {
            var repoPath = proj.GitRepoRoot ?? discovered.Root;
            var repoId = _repos[repoPath].Id;
            var id = IdFor("proj", proj.Path);
            var classification = Classifier.Classify(proj);
            _projectPathToPrimarySolutionId.TryGetValue(proj.Path, out var primarySolutionId);

            _projects[id] = new ProjectNode(
                Id: id,
                Name: StripPrefixes(Path.GetFileNameWithoutExtension(proj.Path)),
                AssemblyName: proj.AssemblyName,
                Path: proj.Path,
                SolutionId: primarySolutionId,
                RepoId: repoId,
                Sdk: proj.Sdk,
                TargetFrameworks: proj.TargetFrameworks,
                Classification: classification,
                PackageId: proj.IsPackable ? proj.PackageId : null,
                Version: proj.Version);
        }

        // 4) SolutionContains edges — emit one per sln-membership (a project can appear in multiple solutions).
        foreach (var sln in discovered.Solutions)
        {
            var slnId = IdFor("sln", sln.Path);
            foreach (var entry in sln.Projects)
            {
                var projId = IdFor("proj", entry.AbsoluteCsprojPath);
                if (_projects.ContainsKey(projId))
                    _edges.Add(new Edge(slnId, projId, EdgeKind.SolutionContains));
            }
        }

        // 5) Packages — first pass builds the "internal producer" index from packable projects.
        foreach (var proj in discovered.Projects)
        {
            if (!proj.IsPackable) continue;
            var projId = IdFor("proj", proj.Path);
            var pkgId = IdFor("pkg", proj.PackageId);
            var entry = _packages.TryGetValue(pkgId, out var existing)
                ? existing
                : new PackageEntry(pkgId, proj.PackageId);
            entry.Classification = PackageClassification.Internal;
            entry.ProducedByProjectId = projId;
            _packages[pkgId] = entry;

            // Package -> Project produced-by edge.
            _edges.Add(new Edge(pkgId, projId, EdgeKind.ProducedBy));
        }

        // 6) Package references (direct).
        foreach (var proj in discovered.Projects)
        {
            var projId = IdFor("proj", proj.Path);
            foreach (var pkgRef in proj.PackageReferences)
            {
                var pkgId = IdFor("pkg", pkgRef.Id);
                var entry = _packages.TryGetValue(pkgId, out var existing)
                    ? existing
                    : new PackageEntry(pkgId, pkgRef.Id);

                // Leave existing classification alone if already marked Internal.
                if (entry.Classification != PackageClassification.Internal)
                    entry.Classification = PackageClassification.Unknown;

                if (pkgRef.Version is { } v) entry.Versions.Add(v);
                _packages[pkgId] = entry;

                _edges.Add(new Edge(projId, pkgId, EdgeKind.PackageRef, pkgRef.Version));
            }
        }

        // 7) Project references.
        foreach (var proj in discovered.Projects)
        {
            var fromId = IdFor("proj", proj.Path);
            foreach (var refTo in proj.ProjectReferences)
            {
                var toId = IdFor("proj", refTo.AbsolutePath);
                // Note: the target project may not be in _projects if the reference is outside the scanned root.
                // We still emit the edge — the viewer will render a dangling-node placeholder in a later phase.
                // For phase 1, skip dangling refs silently.
                if (_projects.ContainsKey(toId))
                    _edges.Add(new Edge(fromId, toId, EdgeKind.ProjectRef));
            }
        }
    }

    public Graph Build(string root)
    {
        var repos = _repos.Values.OrderBy(r => r.Name, StringComparer.OrdinalIgnoreCase).ToList();
        var solutions = _solutions.Values.OrderBy(s => s.Name, StringComparer.OrdinalIgnoreCase).ToList();
        var projects = _projects.Values.OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase).ToList();
        var packages = _packages.Values
            .OrderBy(p => p.PackageId, StringComparer.OrdinalIgnoreCase)
            .Select(p => new PackageNode(p.Id, p.PackageId, p.Classification, p.ProducedByProjectId, p.Versions.OrderBy(v => v, StringComparer.Ordinal).ToList()))
            .ToList();
        var edges = _edges.ToList();

        return new Graph
        {
            Root = root,
            ScannedAt = DateTimeOffset.UtcNow,
            Repos = repos,
            Solutions = solutions,
            Projects = projects,
            Packages = packages,
            Edges = edges,
        };
    }

    private void EnsureRepo(string repoPath)
    {
        if (_repos.ContainsKey(repoPath)) return;
        var id = IdFor("repo", repoPath);
        var name = Path.GetFileName(repoPath.TrimEnd(Path.DirectorySeparatorChar));
        if (string.IsNullOrEmpty(name)) name = repoPath;
        var (branch, origin) = ReadGitMeta(repoPath);
        _repos[repoPath] = new RepoNode(id, name, repoPath, branch, origin);
    }

    private static (string? Branch, string? Origin) ReadGitMeta(string repoPath)
    {
        string? branch = null;
        string? origin = null;

        try
        {
            var headPath = System.IO.Path.Combine(repoPath, ".git", "HEAD");
            if (File.Exists(headPath))
            {
                var head = File.ReadAllText(headPath).Trim();
                const string refPrefix = "ref: refs/heads/";
                branch = head.StartsWith(refPrefix, StringComparison.Ordinal)
                    ? head[refPrefix.Length..]
                    : head.Length >= 7 ? head[..7] : head;
            }

            var configPath = System.IO.Path.Combine(repoPath, ".git", "config");
            if (File.Exists(configPath))
            {
                var inOrigin = false;
                foreach (var line in File.ReadLines(configPath))
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith('['))
                    {
                        inOrigin = trimmed.Equals("[remote \"origin\"]", StringComparison.OrdinalIgnoreCase);
                        continue;
                    }
                    if (inOrigin && trimmed.StartsWith("url", StringComparison.OrdinalIgnoreCase))
                    {
                        var eq = trimmed.IndexOf('=');
                        if (eq >= 0) origin = trimmed[(eq + 1)..].Trim();
                        break;
                    }
                }
            }
        }
        catch { /* git metadata is best-effort */ }

        return (branch, origin);
    }

    private string StripPrefixes(string name)
    {
        foreach (var prefix in _namePrefixes)
        {
            if (!string.IsNullOrEmpty(prefix) && name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return name[prefix.Length..];
        }
        return name;
    }

    private static string IdFor(string kind, string raw)
    {
        // Deterministic, stable id. Short SHA-256 prefix keyed by kind + case-normalized raw value.
        var normalized = raw.Replace('\\', '/').ToLowerInvariant();
        var bytes = Encoding.UTF8.GetBytes(kind + "\0" + normalized);
        var hash = SHA256.HashData(bytes);
        return kind + "_" + Convert.ToHexString(hash, 0, 8).ToLowerInvariant();
    }

    private sealed class PackageEntry
    {
        public PackageEntry(string id, string packageId)
        {
            Id = id;
            PackageId = packageId;
        }

        public string Id { get; }
        public string PackageId { get; }
        public PackageClassification Classification { get; set; } = PackageClassification.Unknown;
        public string? ProducedByProjectId { get; set; }
        public HashSet<string> Versions { get; } = new(StringComparer.Ordinal);
    }
}
