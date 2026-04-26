using DependencyRadar.Parsing;
using DependencyRadar.Tests.Support;
using Xunit;

namespace DependencyRadar.Tests;

public class ProjectParserTests
{
    [Fact]
    public void Parses_sdk_and_target_frameworks()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "src/Foo/Foo.csproj", """
            <Project Sdk="Microsoft.NET.Sdk.Web">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
              </PropertyGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.Equal("Microsoft.NET.Sdk.Web", parsed.Sdk);
        Assert.Equal(new[] { "net8.0" }, parsed.TargetFrameworks);
    }

    [Fact]
    public void Parses_multi_targeted_frameworks()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "src/Foo/Foo.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFrameworks>net6.0;net8.0</TargetFrameworks>
              </PropertyGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.Equal(new[] { "net6.0", "net8.0" }, parsed.TargetFrameworks);
    }

    [Fact]
    public void Detects_test_projects_via_test_sdk_reference()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "tests/FooTests/FooTests.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
              </PropertyGroup>
              <ItemGroup>
                <PackageReference Include="xunit" Version="2.6.2" />
                <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
              </ItemGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.True(parsed.IsTestProject);
    }

    [Fact]
    public void Treats_explicit_IsTestProject_false_as_override()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "src/LooksLikeTest/LooksLikeTest.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <IsTestProject>false</IsTestProject>
              </PropertyGroup>
              <ItemGroup>
                <PackageReference Include="xunit" Version="2.6.2" />
              </ItemGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        // Explicit <IsTestProject>false</IsTestProject> wins over package-reference heuristic.
        Assert.False(parsed.IsTestProject);
    }

    [Fact]
    public void Detects_packable_via_GeneratePackageOnBuild()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "src/Lib/Lib.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
                <GeneratePackageOnBuild>true</GeneratePackageOnBuild>
              </PropertyGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.True(parsed.IsPackable);
    }

    [Fact]
    public void Non_packable_by_default()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "src/Lib/Lib.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <TargetFramework>net8.0</TargetFramework>
              </PropertyGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.False(parsed.IsPackable);
    }

    [Fact]
    public void Captures_ProjectReferences_as_absolute_paths()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var otherPath = ws.WriteProject(repo, "src/Other/Other.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
            </Project>
            """);
        var path = ws.WriteProject(repo, "src/Consumer/Consumer.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
              <ItemGroup>
                <ProjectReference Include="..\Other\Other.csproj" />
              </ItemGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.Single(parsed.ProjectReferences);
        Assert.Equal(Path.GetFullPath(otherPath), parsed.ProjectReferences[0].AbsolutePath);
    }

    [Fact]
    public void Captures_PackageReferences_with_versions()
    {
        using var ws = new TestFixtureWorkspace();
        var repo = ws.CreateRepo("r");
        var path = ws.WriteProject(repo, "src/Foo/Foo.csproj", """
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
              <ItemGroup>
                <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
                <PackageReference Include="Acme.Common" Version="1.2.3" />
              </ItemGroup>
            </Project>
            """);

        var parsed = ProjectParser.Parse(path);

        Assert.Equal(2, parsed.PackageReferences.Count);
        Assert.Contains(parsed.PackageReferences, r => r.Id == "Newtonsoft.Json" && r.Version == "13.0.3");
        Assert.Contains(parsed.PackageReferences, r => r.Id == "Acme.Common" && r.Version == "1.2.3");
    }
}
