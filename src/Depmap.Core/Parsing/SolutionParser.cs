using System.Text.RegularExpressions;

namespace Depmap.Parsing;

/// <summary>
/// Parses a Visual Studio .sln file by scanning for <c>Project(...) = "Name", "RelativePath", "{ProjectGuid}"</c> lines.
/// We avoid Microsoft.Build because it has deep MSBuild resolution requirements; the text format is stable enough
/// that a regex is both reliable and far less trouble.
/// </summary>
internal static class SolutionParser
{
    private static readonly Regex ProjectLine = new(
        @"^Project\(""\{(?<typeGuid>[^}]+)\}""\)\s*=\s*""(?<name>[^""]+)"",\s*""(?<path>[^""]+)"",\s*""\{(?<projGuid>[^}]+)\}""",
        RegexOptions.Compiled | RegexOptions.Multiline);

    public static ParsedSolution Parse(string path)
    {
        var text = File.ReadAllText(path);
        var slnDir = Path.GetDirectoryName(Path.GetFullPath(path))!;

        var projects = new List<ParsedSolutionProjectEntry>();
        foreach (Match m in ProjectLine.Matches(text))
        {
            var typeGuid = m.Groups["typeGuid"].Value;
            var name = m.Groups["name"].Value;
            var relPath = m.Groups["path"].Value.Replace('\\', Path.DirectorySeparatorChar);
            // Skip solution folders and non-C# entries we don't care about.
            // Solution folders have type GUID {2150E333-8FDC-42A3-9474-1A3956D46DE8}.
            if (typeGuid.Equals("2150E333-8FDC-42A3-9474-1A3956D46DE8", StringComparison.OrdinalIgnoreCase))
                continue;
            // Only include C#-project-shaped entries — we recognise them by the .csproj extension on the path.
            if (!relPath.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase))
                continue;

            var absPath = Path.GetFullPath(Path.Combine(slnDir, relPath));
            projects.Add(new ParsedSolutionProjectEntry(name, absPath));
        }

        return new ParsedSolution(Path.GetFullPath(path), projects);
    }
}

internal sealed record ParsedSolution(string Path, IReadOnlyList<ParsedSolutionProjectEntry> Projects);

internal sealed record ParsedSolutionProjectEntry(string Name, string AbsoluteCsprojPath);
