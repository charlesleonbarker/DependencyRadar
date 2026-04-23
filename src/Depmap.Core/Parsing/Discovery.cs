namespace Depmap.Parsing;

/// <summary>
/// Walks a root folder, finds .sln and .csproj files, and parses them.
/// Also attributes each project to its owning git repository (the nearest ancestor containing a .git folder or file).
/// </summary>
internal static class Discovery
{
    public static DiscoveryResult Discover(string root, IReadOnlyList<string> ignoreGlobs, Action<string> log)
    {
        var ignore = new IgnoreMatcher(ignoreGlobs);

        var slnPaths = EnumerateFiles(root, "*.sln", ignore).ToList();
        var csprojPaths = EnumerateFiles(root, "*.csproj", ignore).ToList();

        var solutions = new List<ParsedSolution>();
        foreach (var sln in slnPaths)
        {
            try
            {
                solutions.Add(SolutionParser.Parse(sln));
            }
            catch (Exception ex)
            {
                log($"  warn: failed to parse {sln}: {ex.Message}");
            }
        }

        var projects = new List<ParsedProject>();
        foreach (var csproj in csprojPaths)
        {
            try
            {
                projects.Add(ProjectParser.Parse(csproj));
            }
            catch (Exception ex)
            {
                log($"  warn: failed to parse {csproj}: {ex.Message}");
            }
        }

        return new DiscoveryResult(root, solutions, projects);
    }

    private static IEnumerable<string> EnumerateFiles(string root, string pattern, IgnoreMatcher ignore)
    {
        // EnumerateFiles with SearchOption.AllDirectories follows the simplest path, but we want to skip common
        // noise folders (bin, obj, node_modules, .git) for performance — not correctness.
        return SafeEnumerate(root, pattern)
            .Where(p => !IsNoisePath(p))
            .Where(p => !ignore.IsIgnored(p));
    }

    private static IEnumerable<string> SafeEnumerate(string root, string pattern)
    {
        var stack = new Stack<string>();
        stack.Push(root);
        while (stack.Count > 0)
        {
            var dir = stack.Pop();
            string[] files;
            string[] subdirs;
            try
            {
                files = Directory.GetFiles(dir, pattern);
                subdirs = Directory.GetDirectories(dir);
            }
            catch (UnauthorizedAccessException) { continue; }
            catch (DirectoryNotFoundException) { continue; }

            foreach (var f in files) yield return f;

            foreach (var sub in subdirs)
            {
                var name = Path.GetFileName(sub);
                if (IsNoiseFolderName(name)) continue;
                stack.Push(sub);
            }
        }
    }

    private static bool IsNoiseFolderName(string name) =>
        name.Equals("bin", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("obj", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("node_modules", StringComparison.OrdinalIgnoreCase) ||
        name.Equals(".git", StringComparison.OrdinalIgnoreCase) ||
        name.Equals(".vs", StringComparison.OrdinalIgnoreCase) ||
        name.Equals(".idea", StringComparison.OrdinalIgnoreCase) ||
        name.Equals("packages", StringComparison.OrdinalIgnoreCase);

    private static bool IsNoisePath(string path)
    {
        // A conservative extra filter in case something walked into a known-bad spot.
        var normalized = path.Replace('\\', '/');
        return normalized.Contains("/bin/", StringComparison.OrdinalIgnoreCase)
            || normalized.Contains("/obj/", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Finds the nearest ancestor directory containing a .git folder or file, starting from <paramref name="startPath"/>.
    /// Returns null if nothing is found before reaching the filesystem root.
    /// </summary>
    public static string? FindGitRepoRoot(string startPath)
    {
        var dir = File.Exists(startPath) ? Path.GetDirectoryName(startPath) : startPath;
        while (!string.IsNullOrEmpty(dir))
        {
            if (Directory.Exists(Path.Combine(dir, ".git")) || File.Exists(Path.Combine(dir, ".git")))
                return dir;
            var parent = Path.GetDirectoryName(dir);
            if (parent == dir) break;
            dir = parent;
        }
        return null;
    }
}

internal sealed record DiscoveryResult(string Root, IReadOnlyList<ParsedSolution> Solutions, IReadOnlyList<ParsedProject> Projects);
