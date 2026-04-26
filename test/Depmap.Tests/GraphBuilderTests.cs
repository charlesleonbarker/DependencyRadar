using DependencyRadar.Graph;
using DependencyRadar.Parsing;
using DependencyRadar.Rendering;
using DependencyRadar.Tests.Support;
using System.Text.Json;
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
    public void Package_reference_edges_carry_local_version()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        ws.WriteProject(repo, "src/App/App.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
              <ItemGroup>
                <PackageReference Include="Newtonsoft.Json" Version="[13.0.1,14.0.0)" />
              </ItemGroup>
            </Project>
            """);

        var discovered = Discovery.Discover(ws.Root, Array.Empty<string>(), _ => { });
        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(ws.Root);

        var project = Assert.Single(graph.Projects, p => p.Name == "App");
        var package = Assert.Single(graph.Packages, p => p.PackageId == "Newtonsoft.Json");
        var edge = Assert.Single(graph.Edges, e => e.From == project.Id && e.To == package.Id && e.Kind == EdgeKind.PackageRef);
        Assert.Equal("[13.0.1,14.0.0)", edge.Version);

        using var json = JsonDocument.Parse(GraphJsonWriter.Serialize(graph, indent: false));
        var serializedEdge = json.RootElement.GetProperty("edges")
            .EnumerateArray()
            .Single(e =>
                e.GetProperty("from").GetString() == project.Id
                && e.GetProperty("to").GetString() == package.Id
                && e.GetProperty("kind").GetString() == "packageRef");
        Assert.Equal("[13.0.1,14.0.0)", serializedEdge.GetProperty("version").GetString());
    }

    [Fact]
    public void Graph_json_includes_display_paths_without_rewriting_raw_paths_or_ids()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("alpha");
        var projectPath = ws.WriteProject(repo, "src/App/App.csproj", """
            <Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>
            """);

        var discovered = Discovery.Discover(ws.Root, Array.Empty<string>(), _ => { });
        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(ws.Root);
        var project = Assert.Single(graph.Projects, p => p.Name == "App");

        using var json = JsonDocument.Parse(GraphJsonWriter.Serialize(graph, indent: false, displayPathPrefixes: new[] { ws.Root }));
        var serializedProject = json.RootElement.GetProperty("projects")
            .EnumerateArray()
            .Single(p => p.GetProperty("id").GetString() == project.Id);

        Assert.Equal(project.Id, serializedProject.GetProperty("id").GetString());
        Assert.Equal(projectPath, serializedProject.GetProperty("path").GetString());
        Assert.Equal("alpha/src/App/App.csproj", serializedProject.GetProperty("displayPath").GetString());
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

    [Fact]
    public void Fixture_acme_common_reaches_customers_web_tests_through_logging_package()
    {
        var fixtureRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "fixtures"));
        var discovered = Discovery.Discover(fixtureRoot, Array.Empty<string>(), _ => { });
        var builder = new GraphBuilder();
        builder.AddDiscovered(discovered);
        var graph = builder.Build(fixtureRoot);

        var acmeCommon = Assert.Single(graph.Projects, p => p.Name == "Acme.Common");
        var acmeLogging = Assert.Single(graph.Projects, p => p.Name == "Acme.Logging");
        var acmeLoggingPackage = Assert.Single(graph.Packages, p => p.PackageId == "Acme.Logging");
        var customersWeb = Assert.Single(graph.Projects, p => p.Name == "Customers.Web");
        var customersWebTests = Assert.Single(graph.Projects, p => p.Name == "Customers.Web.Tests");

        Assert.Contains(graph.Edges, e => e.From == acmeLogging.Id && e.To == acmeCommon.Id && e.Kind == EdgeKind.ProjectRef);
        Assert.Contains(graph.Edges, e => e.From == acmeLoggingPackage.Id && e.To == acmeLogging.Id && e.Kind == EdgeKind.ProducedBy);
        Assert.Contains(graph.Edges, e => e.From == customersWeb.Id && e.To == acmeLoggingPackage.Id && e.Kind == EdgeKind.PackageRef);
        Assert.Contains(graph.Edges, e => e.From == customersWebTests.Id && e.To == customersWeb.Id && e.Kind == EdgeKind.ProjectRef);

        var reverseAdj = graph.Edges.GroupBy(e => e.To).ToDictionary(g => g.Key, g => g.ToList());
        var reached = new HashSet<string>();
        var queue = new Queue<string>();
        queue.Enqueue(acmeCommon.Id);
        reached.Add(acmeCommon.Id);
        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            if (!reverseAdj.TryGetValue(cur, out var incoming)) continue;
            foreach (var e in incoming)
            {
                if (reached.Add(e.From)) queue.Enqueue(e.From);
            }
        }

        Assert.Contains(customersWebTests.Id, reached);
    }
}
