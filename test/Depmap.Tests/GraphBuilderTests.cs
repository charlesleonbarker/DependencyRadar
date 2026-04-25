using DependencyRadar.Graph;
using DependencyRadar.Parsing;
using DependencyRadar.Tests.Support;
using Xunit;

namespace DependencyRadar.Tests;

public class GraphBuilderTests
{
    [Fact]
    public void Links_consumer_to_internal_nuget_via_produced_by_edge()
    {
        // Arrange: Repo A produces "Acme.Common", Repo B consumes it via PackageReference.
        using var ws = new TestFixtureWorkspace();
        var repoA = ws.CreateRepo("repoA");
        var repoB = ws.CreateRepo("repoB");

        var producerPath = ws.WriteProject(repoA, "src/Acme.Common/Acme.Common.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <IsPackable>true</IsPackable>
                <PackageId>Acme.Common</PackageId>
              </PropertyGroup>
            </Project>
            """);

        var consumerPath = ws.WriteProject(repoB, "src/Orders.Api/Orders.Api.csproj", """
            <Project Sdk="Microsoft.NET.Sdk.Web">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
              </PropertyGroup>
              <ItemGroup>
                <PackageReference Include="Acme.Common" Version="1.0.0" />
              </ItemGroup>
            </Project>
            """);

        var discovered = Discovery.Discover(ws.Root, Array.Empty<string>(), _ => { });

        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(ws.Root);

        // Assert: the Acme.Common package is classified Internal and has a produced-by edge to its project.
        var pkg = Assert.Single(graph.Packages, p => p.PackageId == "Acme.Common");
        Assert.Equal(PackageClassification.Internal, pkg.Classification);

        var producerNode = Assert.Single(graph.Projects, p => p.Name == "Acme.Common");
        Assert.Equal(producerNode.Id, pkg.ProducedByProjectId);

        Assert.Contains(graph.Edges, e => e.From == pkg.Id && e.To == producerNode.Id && e.Kind == EdgeKind.ProducedBy);

        // And the consumer has a package-ref edge to the package.
        var consumerNode = Assert.Single(graph.Projects, p => p.Name == "Orders.Api");
        Assert.Contains(graph.Edges, e => e.From == consumerNode.Id && e.To == pkg.Id && e.Kind == EdgeKind.PackageRef);
    }

    [Fact]
    public void Classifies_unknown_packages_when_no_internal_producer_found()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        ws.WriteProject(repo, "src/App/App.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
              <ItemGroup>
                <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
              </ItemGroup>
            </Project>
            """);

        var discovered = Discovery.Discover(ws.Root, Array.Empty<string>(), _ => { });
        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(ws.Root);

        var pkg = Assert.Single(graph.Packages, p => p.PackageId == "Newtonsoft.Json");
        Assert.Equal(PackageClassification.Unknown, pkg.Classification);
        Assert.Null(pkg.ProducedByProjectId);
    }

    [Fact]
    public void Groups_projects_by_owning_git_repo()
    {
        using var ws = new TestFixtureWorkspace();
        var repoA = ws.CreateRepo("alpha");
        var repoB = ws.CreateRepo("beta");
        ws.WriteProject(repoA, "A.csproj", """
            <Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>
            """);
        ws.WriteProject(repoB, "B.csproj", """
            <Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>
            """);

        var discovered = Discovery.Discover(ws.Root, Array.Empty<string>(), _ => { });
        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(ws.Root);

        Assert.Equal(2, graph.Repos.Count);
        Assert.Equal(2, graph.Projects.Count);
        Assert.NotEqual(graph.Projects[0].RepoId, graph.Projects[1].RepoId);
    }

    [Fact]
    public void Reverse_bfs_from_internal_package_reaches_consumer_and_its_tests()
    {
        using var ws = new TestFixtureWorkspace();
        var repoA = ws.CreateRepo("repoA");
        var repoB = ws.CreateRepo("repoB");

        // Repo A produces "Acme.Common"
        ws.WriteProject(repoA, "src/Acme.Common/Acme.Common.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <IsPackable>true</IsPackable>
                <PackageId>Acme.Common</PackageId>
              </PropertyGroup>
            </Project>
            """);

        // Repo B consumes it as a NuGet (simulating cross-repo), and has a test project that references the consumer.
        ws.WriteProject(repoB, "src/Orders.Api/Orders.Api.csproj", """
            <Project Sdk="Microsoft.NET.Sdk.Web">
              <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
              <ItemGroup>
                <PackageReference Include="Acme.Common" Version="1.0.0" />
              </ItemGroup>
            </Project>
            """);
        ws.WriteProject(repoB, "tests/Orders.Api.Tests/Orders.Api.Tests.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <IsTestProject>true</IsTestProject>
              </PropertyGroup>
              <ItemGroup>
                <PackageReference Include="xunit" Version="2.6.2" />
                <ProjectReference Include="..\..\src\Orders.Api\Orders.Api.csproj" />
              </ItemGroup>
            </Project>
            """);

        var discovered = Discovery.Discover(ws.Root, Array.Empty<string>(), _ => { });
        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(ws.Root);

        // Do a reverse BFS from the Acme.Common *project* — that's the thing that would actually change.
        var producer = Assert.Single(graph.Projects, p => p.Name == "Acme.Common");
        var reverseAdj = graph.Edges.GroupBy(e => e.To).ToDictionary(g => g.Key, g => g.ToList());

        var reached = new HashSet<string>();
        var queue = new Queue<string>();
        queue.Enqueue(producer.Id);
        reached.Add(producer.Id);
        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            if (!reverseAdj.TryGetValue(cur, out var incoming)) continue;
            foreach (var e in incoming)
            {
                if (reached.Add(e.From)) queue.Enqueue(e.From);
            }
        }

        // Expect to have reached: Acme.Common package (via producedBy edge), Orders.Api (via packageRef), Orders.Api.Tests (via projectRef).
        Assert.Contains(graph.Packages.Single(p => p.PackageId == "Acme.Common").Id, reached);
        Assert.Contains(graph.Projects.Single(p => p.Name == "Orders.Api").Id, reached);
        Assert.Contains(graph.Projects.Single(p => p.Name == "Orders.Api.Tests").Id, reached);
    }
}
