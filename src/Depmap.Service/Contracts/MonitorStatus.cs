using DependencyRadar.Scanning;

namespace DependencyRadar.Service.Contracts;

public sealed record MonitorStatus(
    long Version,
    string State,
    IReadOnlyList<string> Roots,
    DateTimeOffset? LastScanAt,
    DateTimeOffset? LastChangeAt,
    string? LastError,
    GraphSummary? Summary);
