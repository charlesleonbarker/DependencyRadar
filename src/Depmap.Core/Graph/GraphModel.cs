namespace Depmap.Graph;

internal enum NodeKind
{
    Repo,
    Solution,
    Project,
    Package,
}

internal enum EdgeKind
{
    SolutionContains,
    ProjectRef,
    PackageRef,
    PackageRefTransitive,
    ProducedBy,
}

internal enum PackageClassification
{
    Internal,
    External,
    Unknown,
}

[Flags]
internal enum ProjectClassification
{
    None          = 0,
    Library       = 1 << 0,
    Test          = 1 << 1,
    Web           = 1 << 2,
    Blazor        = 1 << 3,
    Service       = 1 << 4,
    NugetProducing= 1 << 5,
    Console       = 1 << 6,
}

internal sealed record RepoNode(string Id, string Name, string Path);

internal sealed record SolutionNode(string Id, string Name, string Path, string RepoId);

internal sealed record ProjectNode(
    string Id,
    string Name,
    string AssemblyName,
    string Path,
    string? SolutionId,
    string RepoId,
    string? Sdk,
    IReadOnlyList<string> TargetFrameworks,
    ProjectClassification Classification,
    string? PackageId);

internal sealed record PackageNode(
    string Id,
    string PackageId,
    PackageClassification Classification,
    string? ProducedByProjectId,
    IReadOnlyList<string> Versions);

internal sealed record Edge(string From, string To, EdgeKind Kind);

internal sealed class Graph
{
    public required string Root { get; init; }
    public required DateTimeOffset ScannedAt { get; init; }
    public required IReadOnlyList<RepoNode> Repos { get; init; }
    public required IReadOnlyList<SolutionNode> Solutions { get; init; }
    public required IReadOnlyList<ProjectNode> Projects { get; init; }
    public required IReadOnlyList<PackageNode> Packages { get; init; }
    public required IReadOnlyList<Edge> Edges { get; init; }
}
