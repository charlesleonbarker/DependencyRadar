namespace DependencyRadar.Service.Configuration;

public sealed class MonitorOptions
{
    public const string SectionName = "DependencyRadar";

    public string[] Roots { get; init; } = [];
    public string[] IgnoreGlobs { get; init; } = [];
    public string[] NamePrefixes { get; init; } = [];
    public int DebounceMilliseconds { get; init; } = 1500;
}
