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

    public static string Serialize(GraphModel graph, bool indent)
    {
        var options = indent ? _optionsIndented : _optionsCompact;

        var payload = new
        {
            schemaVersion = 1,
            scannedAt = graph.ScannedAt.ToString("O"),
            root = graph.Root,
            repos = graph.Repos.Select(r => new
            {
                id = r.Id,
                name = r.Name,
                path = r.Path,
            }),
            solutions = graph.Solutions.Select(s => new
            {
                id = s.Id,
                name = s.Name,
                path = s.Path,
                repo = s.RepoId,
            }),
            projects = graph.Projects.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                assemblyName = p.AssemblyName,
                path = p.Path,
                solution = p.SolutionId,
                repo = p.RepoId,
                sdk = p.Sdk,
                tfms = p.TargetFrameworks,
                kinds = SplitClassification(p.Classification),
                packageId = p.PackageId,
                version = p.Version,
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

}
