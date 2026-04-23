using Depmap.Graph;
using Depmap.Parsing;
using Xunit;

namespace Depmap.Tests;

public class ClassifierTests
{
    private static ParsedProject Project(
        string sdk = "Microsoft.NET.Sdk",
        bool isTest = false,
        bool isPackable = false,
        string[]? packageRefs = null)
    {
        return new ParsedProject(
            Path: "/tmp/Project.csproj",
            Sdk: sdk,
            AssemblyName: "Project",
            PackageId: "Project",
            TargetFrameworks: new[] { "net8.0" },
            IsTestProject: isTest,
            IsPackable: isPackable,
            ProjectReferences: Array.Empty<ParsedProjectReference>(),
            PackageReferences: (packageRefs ?? Array.Empty<string>())
                .Select(id => new ParsedPackageReference(id, "1.0.0")).ToList(),
            GitRepoRoot: null);
    }

    [Fact]
    public void Default_sdk_with_nothing_else_is_library() =>
        Assert.Equal(ProjectClassification.Library, Classifier.Classify(Project()));

    [Fact]
    public void Test_project_classified_as_test() =>
        Assert.True(Classifier.Classify(Project(isTest: true)).HasFlag(ProjectClassification.Test));

    [Fact]
    public void Web_sdk_classified_as_web() =>
        Assert.True(Classifier.Classify(Project(sdk: "Microsoft.NET.Sdk.Web")).HasFlag(ProjectClassification.Web));

    [Fact]
    public void Blazor_sdk_classified_as_blazor()
    {
        var c = Classifier.Classify(Project(sdk: "Microsoft.NET.Sdk.BlazorWebAssembly"));
        Assert.True(c.HasFlag(ProjectClassification.Blazor));
    }

    [Fact]
    public void Blazor_via_component_package_classified_as_blazor()
    {
        var c = Classifier.Classify(Project(packageRefs: new[] { "Microsoft.AspNetCore.Components.Web" }));
        Assert.True(c.HasFlag(ProjectClassification.Blazor));
    }

    [Fact]
    public void Packable_project_tagged_nuget_producing() =>
        Assert.True(Classifier.Classify(Project(isPackable: true)).HasFlag(ProjectClassification.NugetProducing));
}
