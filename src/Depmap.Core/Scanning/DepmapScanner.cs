using Depmap.Graph;
using Depmap.Parsing;
using Depmap.Rendering;

namespace Depmap.Scanning;

public sealed record ScanRequest(
    IReadOnlyList<string> Roots,
    bool IncludeTransitive,
    IReadOnlyList<string> IgnoreGlobs)
{
    public ScanRequest(string root, bool includeTransitive, IReadOnlyList<string> ignoreGlobs)
        : this(new[] { root }, includeTransitive, ignoreGlobs)
    {
    }
}

public sealed record GraphSummary(
    int RepoCount,
    int SolutionCount,
    int ProjectCount,
    int PackageCount,
    int EdgeCount);

public sealed record ScanSnapshot(
    IReadOnlyList<string> Roots,
    DateTimeOffset ScannedAt,
    string GraphJson,
    GraphSummary Summary);

public sealed class DepmapScanner
{
    public ScanSnapshot Scan(ScanRequest request, Action<string>? log = null, bool indentJson = false)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Roots.Count == 0)
            throw new ArgumentException("At least one root folder is required.", nameof(request));

        log ??= static _ => { };

        var normalizedRoots = request.Roots
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var root in normalizedRoots)
        {
            if (!Directory.Exists(root))
                throw new DirectoryNotFoundException($"root folder does not exist: {root}");
        }

        var builder = new GraphBuilder();
        var discoveredProjects = new List<ParsedProject>();
        var totalSolutions = 0;

        foreach (var root in normalizedRoots)
        {
            log($"scanning {root}...");
            var discovered = Discovery.Discover(root, request.IgnoreGlobs, log);
            totalSolutions += discovered.Solutions.Count;
            discoveredProjects.AddRange(discovered.Projects);
            builder.AddDiscovered(discovered);
        }

        log($"  found {totalSolutions} solution(s), {discoveredProjects.Count} project(s)");

        if (request.IncludeTransitive)
        {
            log("reading project.assets.json where available...");
            var transitiveCount = builder.AddTransitiveFromAssetsFiles(discoveredProjects);
            log($"  added {transitiveCount} transitive package edge(s)");
        }

        var graph = builder.Build(RenderRootsLabel(normalizedRoots));
        var summary = new GraphSummary(
            graph.Repos.Count,
            graph.Solutions.Count,
            graph.Projects.Count,
            graph.Packages.Count,
            graph.Edges.Count);

        log($"graph: {summary.RepoCount} repo(s), {summary.SolutionCount} solution(s), {summary.ProjectCount} project(s), {summary.PackageCount} package(s), {summary.EdgeCount} edge(s)");

        return new ScanSnapshot(
            normalizedRoots,
            graph.ScannedAt,
            GraphJsonWriter.Serialize(graph, indentJson),
            summary);
    }

    private static string RenderRootsLabel(IReadOnlyList<string> roots)
    {
        if (roots.Count == 1)
            return roots[0];

        var commonRoot = roots[0];
        foreach (var root in roots.Skip(1))
        {
            commonRoot = FindCommonPath(commonRoot, root);
            if (string.IsNullOrEmpty(commonRoot))
                break;
        }

        return string.IsNullOrEmpty(commonRoot)
            ? string.Join("; ", roots)
            : commonRoot;
    }

    private static string FindCommonPath(string left, string right)
    {
        var leftParts = Path.GetFullPath(left).Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        var rightParts = Path.GetFullPath(right).Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        var count = 0;
        while (count < leftParts.Length
            && count < rightParts.Length
            && string.Equals(leftParts[count], rightParts[count], StringComparison.OrdinalIgnoreCase))
        {
            count++;
        }

        if (count == 0)
            return string.Empty;

        var prefix = left.StartsWith(Path.DirectorySeparatorChar) ? Path.DirectorySeparatorChar.ToString() : string.Empty;
        return prefix + Path.Combine(leftParts.Take(count).ToArray());
    }
}
