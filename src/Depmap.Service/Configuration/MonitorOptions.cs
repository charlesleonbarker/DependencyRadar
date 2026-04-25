namespace DependencyRadar.Service.Configuration;

public sealed class MonitorOptions
{
    public const string SectionName = "DependencyRadar";

    public string[] Roots { get; init; } = [];
    public string[] IgnoreGlobs { get; init; } = [];
    public bool IncludeTransitive { get; init; } = true;
    public int DebounceMilliseconds { get; init; } = 1500;
}
