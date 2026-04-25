namespace DependencyRadar.Tests.Support;

/// <summary>
/// Creates a throw-away directory tree on disk that mirrors a realistic multi-repo .NET layout.
/// Each test constructs the shape it needs via the helper methods, keeping tests self-contained.
/// </summary>
internal sealed class TestFixtureWorkspace : IDisposable
{
    public string Root { get; }

    public TestFixtureWorkspace()
    {
        Root = Path.Combine(Path.GetTempPath(), "dependency-radar-test-" + Guid.NewGuid().ToString("n"));
        Directory.CreateDirectory(Root);
    }

    public string CreateRepo(string name)
    {
        var path = Path.Combine(Root, name);
        Directory.CreateDirectory(path);
        // A .git directory is enough for FindGitRepoRoot to pick it up.
        Directory.CreateDirectory(Path.Combine(path, ".git"));
        return path;
    }

    public string WriteSolution(string repoPath, string slnName, params string[] relativeCsprojPaths)
    {
        var slnPath = Path.Combine(repoPath, slnName + ".sln");
        using var sw = new StreamWriter(slnPath);
        sw.WriteLine("Microsoft Visual Studio Solution File, Format Version 12.00");
        sw.WriteLine("# Visual Studio Version 17");
        foreach (var rel in relativeCsprojPaths)
        {
            var projName = Path.GetFileNameWithoutExtension(rel);
            var guid = Guid.NewGuid().ToString("B").ToUpperInvariant();
            sw.WriteLine($"Project(\"{{9A19103F-16F7-4668-BE54-9A1E7A4F7556}}\") = \"{projName}\", \"{rel.Replace('/', '\\')}\", \"{guid}\"");
            sw.WriteLine("EndProject");
        }
        sw.WriteLine("Global");
        sw.WriteLine("EndGlobal");
        return slnPath;
    }

    public string WriteProject(string repoPath, string relativePath, string xml)
    {
        var full = Path.Combine(repoPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        File.WriteAllText(full, xml);
        return full;
    }

    public void Dispose()
    {
        try { Directory.Delete(Root, recursive: true); } catch { /* best effort */ }
    }
}
