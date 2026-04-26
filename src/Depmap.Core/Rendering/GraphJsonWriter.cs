using System.Text.Json;
using DependencyRadar.Graph;
using GraphModel = DependencyRadar.Graph.Graph;

namespace DependencyRadar.Rendering;

/// <summary>
/// Serializes a Graph to the JSON shape consumed by the viewer.
///
/// The shape is deliberately flat and stable. Do not rename keys without updating Viewer/viewer.js.
/// </summary>
internal static class GraphJsonWriter
{
    private static readonly JsonSerializerOptions _optionsCompact = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly JsonSerializerOptions _optionsIndented = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static string Serialize(GraphModel graph, bool indent, IReadOnlyList<string>? displayPathPrefixes = null)
    {
        var pathDisplay = new DisplayPathFormatter(displayPathPrefixes);
        var options = indent ? _optionsIndented : _optionsCompact;

        var payload = new
        {
            schemaVersion = 1,
            scannedAt = graph.ScannedAt.ToString("O"),
            root = graph.Root,
            displayRoot = pathDisplay.Format(graph.Root),
            repos = graph.Repos.Select(r => new
            {
                id = r.Id,
                name = r.Name,
                path = r.Path,
                displayPath = pathDisplay.Format(r.Path),
            }),
            solutions = graph.Solutions.Select(s => new
            {
                id = s.Id,
                name = s.Name,
                path = s.Path,
                displayPath = pathDisplay.Format(s.Path),
                repo = s.RepoId,
            }),
            projects = graph.Projects.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                assemblyName = p.AssemblyName,
                path = p.Path,
                displayPath = pathDisplay.Format(p.Path),
                solution = p.SolutionId,
                repo = p.RepoId,
                sdk = p.Sdk,
                tfms = p.TargetFrameworks,
                kinds = SplitClassification(p.Classification),
                packageId = p.PackageId,
            }),
            packages = graph.Packages.Select(p => new
            {
                id = p.Id,
                name = p.PackageId,
                classification = p.Classification.ToString().ToLowerInvariant(),
                producedBy = p.ProducedByProjectId,
                versions = p.Versions,
            }),
            edges = graph.Edges.Select(e => new
            {
                from = e.From,
                to = e.To,
                kind = EdgeKindToJson(e.Kind),
                version = e.Version,
            }),
        };

        return JsonSerializer.Serialize(payload, options);
    }

    private static string[] SplitClassification(ProjectClassification c)
    {
        if (c == ProjectClassification.None) return Array.Empty<string>();
        return Enum.GetValues<ProjectClassification>()
            .Where(v => v != ProjectClassification.None && c.HasFlag(v))
            .Select(v => v switch
            {
                ProjectClassification.NugetProducing => "nuget-producing",
                _ => v.ToString().ToLowerInvariant(),
            })
            .ToArray();
    }

    private static string EdgeKindToJson(EdgeKind kind) => kind switch
    {
        EdgeKind.SolutionContains => "solutionContains",
        EdgeKind.ProjectRef => "projectRef",
        EdgeKind.PackageRef => "packageRef",
        EdgeKind.ProducedBy => "producedBy",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };

    private sealed class DisplayPathFormatter
    {
        private readonly string[] _prefixes;

        public DisplayPathFormatter(IReadOnlyList<string>? prefixes)
        {
            _prefixes = (prefixes ?? Array.Empty<string>())
                .Where(static prefix => !string.IsNullOrWhiteSpace(prefix))
                .Select(Normalize)
                .OrderByDescending(static prefix => prefix.Length)
                .ToArray();
        }

        public string Format(string path)
        {
            var normalized = Normalize(path);
            foreach (var prefix in _prefixes)
            {
                if (!IsUnderPrefix(normalized, prefix))
                    continue;

                var trimmed = normalized[prefix.Length..].TrimStart('/');
                return string.IsNullOrEmpty(trimmed) ? "." : trimmed;
            }

            return path;
        }

        private static bool IsUnderPrefix(string path, string prefix)
        {
            return path.Equals(prefix, StringComparison.OrdinalIgnoreCase)
                || path.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase);
        }

        private static string Normalize(string path)
        {
            return Path.GetFullPath(path).Replace('\\', '/').TrimEnd('/');
        }
    }
}
