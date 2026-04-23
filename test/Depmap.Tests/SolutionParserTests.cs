using Depmap.Parsing;
using Depmap.Tests.Support;
using Xunit;

namespace Depmap.Tests;

public class SolutionParserTests
{
    [Fact]
    public void Parses_csproj_entries_and_skips_solution_folders()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("svc");
        var proj = ws.WriteProject(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
        var sln = ws.WriteSolution(repo, "svc", "src/App/App.csproj");

        // Also append a solution folder entry, which must be ignored.
        File.AppendAllText(sln, """
            Project("{2150E333-8FDC-42A3-9474-1A3956D46DE8}") = "docs", "docs", "{11111111-1111-1111-1111-111111111111}"
            EndProject
            """);

        var parsed = SolutionParser.Parse(sln);

        Assert.Single(parsed.Projects);
        Assert.Equal(Path.GetFullPath(proj), parsed.Projects[0].AbsoluteCsprojPath);
    }
}
