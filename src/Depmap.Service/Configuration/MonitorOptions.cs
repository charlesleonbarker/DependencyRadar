namespace Depmap.Service.Configuration;

public sealed class MonitorOptions
{
    public const string SectionName = "Depmap";

    public string[] Roots { get; init; } = [];
    public string[] IgnoreGlobs { get; init; } = [];
    public bool IncludeTransitive { get; init; } = true;
    public int DebounceMilliseconds { get; init; } = 1500;
}
