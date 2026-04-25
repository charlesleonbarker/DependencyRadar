using System.Text.RegularExpressions;

namespace DependencyRadar.Parsing;

/// <summary>
/// A minimal glob matcher for --ignore patterns. Supports:
///   *   — any characters except '/'
///   **  — any characters including '/'
///   ?   — a single character
/// Matching is case-insensitive and operates on forward-slash-normalized paths.
/// </summary>
internal sealed class IgnoreMatcher
{
    private readonly List<Regex> _patterns;

    public IgnoreMatcher(IReadOnlyList<string> globs)
    {
        _patterns = globs.Select(Compile).ToList();
    }

    public bool IsIgnored(string path)
    {
        if (_patterns.Count == 0) return false;
        var normalized = path.Replace('\\', '/');
        return _patterns.Any(r => r.IsMatch(normalized));
    }

    private static Regex Compile(string glob)
    {
        // Build a regex by escaping everything except our glob tokens.
        // Strategy: replace ** with a placeholder, then * and ? separately, then restore **.
        var g = glob.Replace('\\', '/');
        const string doubleStarPlaceholder = "\u0001DS\u0001";
        g = g.Replace("**", doubleStarPlaceholder);

        var escaped = Regex.Escape(g);

        // Regex.Escape escapes '*' to '\*' and '?' to '\?'; restore them as glob tokens.
        escaped = escaped.Replace("\\*", "[^/]*").Replace("\\?", "[^/]");

        // Restore ** as ".*".
        escaped = escaped.Replace(doubleStarPlaceholder, ".*");

        // Allow matching anywhere in the path unless the glob is anchored with '/'.
        if (!g.StartsWith("/")) escaped = ".*" + escaped;
        escaped = "^" + escaped + "$";

        return new Regex(escaped, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }
}
