using System.Xml.Linq;

namespace Depmap.Parsing;

/// <summary>
/// Parses a .csproj file as XML to extract:
///   - Sdk attribute (Microsoft.NET.Sdk, Microsoft.NET.Sdk.Web, Microsoft.NET.Sdk.BlazorWebAssembly, …)
///   - TargetFramework / TargetFrameworks
///   - ProjectReference items
///   - PackageReference items
///   - IsPackable / GeneratePackageOnBuild / PackageId (packability)
///   - IsTestProject (explicit)
/// Property-evaluation nuance: we deliberately do not evaluate MSBuild conditions or imports. We take the last
/// literal value we see for properties, and collect all item elements without condition filtering. For a
/// dependency-visualization tool this is the right trade-off — we err toward the union, and anything we can't
/// resolve locally becomes "unknown" in the downstream graph.
/// </summary>
internal static class ProjectParser
{
    // Well-known test-related package IDs. If a project references any of these, we classify it as a test project
    // even if <IsTestProject> is absent.
    private static readonly HashSet<string> TestPackageIds = new(StringComparer.OrdinalIgnoreCase)
    {
        "Microsoft.NET.Test.Sdk",
        "xunit",
        "xunit.core",
        "xunit.runner.visualstudio",
        "NUnit",
        "NUnit3TestAdapter",
        "MSTest.TestFramework",
        "MSTest.TestAdapter",
    };

    public static ParsedProject Parse(string path)
    {
        var absPath = Path.GetFullPath(path);
        var projectDir = Path.GetDirectoryName(absPath)!;
        var xml = XDocument.Load(absPath);
        var root = xml.Root ?? throw new InvalidDataException($"{absPath}: empty XML document");

        var sdk = (string?)root.Attribute("Sdk");

        var targetFrameworks = ReadPropertyMany(root, "TargetFrameworks");
        if (targetFrameworks.Count == 0)
        {
            var singular = ReadPropertyLast(root, "TargetFramework");
            if (!string.IsNullOrWhiteSpace(singular)) targetFrameworks = new[] { singular };
        }

        var packageId = ReadPropertyLast(root, "PackageId") ?? Path.GetFileNameWithoutExtension(absPath);
        var assemblyName = ReadPropertyLast(root, "AssemblyName") ?? Path.GetFileNameWithoutExtension(absPath);

        var isTestProjectExplicit = ReadBoolProperty(root, "IsTestProject");
        var isPackable = ReadBoolProperty(root, "IsPackable");
        var generatePackageOnBuild = ReadBoolProperty(root, "GeneratePackageOnBuild");
        var hasExplicitPackageId = ReadPropertyLast(root, "PackageId") is not null;

        var projectReferences = new List<ParsedProjectReference>();
        foreach (var pr in DescendantItems(root, "ProjectReference"))
        {
            var include = (string?)pr.Attribute("Include");
            if (string.IsNullOrWhiteSpace(include)) continue;
            var target = Path.GetFullPath(Path.Combine(projectDir, include.Replace('\\', Path.DirectorySeparatorChar)));
            projectReferences.Add(new ParsedProjectReference(target));
        }

        var packageReferences = new List<ParsedPackageReference>();
        foreach (var pr in DescendantItems(root, "PackageReference"))
        {
            var include = (string?)pr.Attribute("Include") ?? (string?)pr.Attribute("Update");
            if (string.IsNullOrWhiteSpace(include)) continue;
            var version = (string?)pr.Attribute("Version") ?? (string?)pr.Element(pr.Name.Namespace + "Version");
            packageReferences.Add(new ParsedPackageReference(include, version));
        }

        var isTest = isTestProjectExplicit
            ?? packageReferences.Any(p => TestPackageIds.Contains(p.Id));

        // Packable = any clear signal a NuGet will be produced.
        var packable = (isPackable ?? false) || (generatePackageOnBuild ?? false) || hasExplicitPackageId;
        // …unless the project is explicitly non-packable.
        if (isPackable == false) packable = false;

        return new ParsedProject(
            Path: absPath,
            Sdk: sdk,
            AssemblyName: assemblyName,
            PackageId: packageId,
            TargetFrameworks: targetFrameworks,
            IsTestProject: isTest,
            IsPackable: packable,
            ProjectReferences: projectReferences,
            PackageReferences: packageReferences,
            GitRepoRoot: Discovery.FindGitRepoRoot(absPath));
    }

    private static IEnumerable<XElement> DescendantItems(XElement root, string localName) =>
        root.Descendants().Where(e => e.Name.LocalName == localName);

    private static IEnumerable<XElement> Properties(XElement root, string localName) =>
        root.Descendants().Where(e => e.Name.LocalName == localName);

    private static string? ReadPropertyLast(XElement root, string name)
    {
        string? last = null;
        foreach (var el in Properties(root, name))
        {
            var v = el.Value.Trim();
            if (!string.IsNullOrEmpty(v)) last = v;
        }
        return last;
    }

    private static IReadOnlyList<string> ReadPropertyMany(XElement root, string name)
    {
        var raw = ReadPropertyLast(root, name);
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<string>();
        return raw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    private static bool? ReadBoolProperty(XElement root, string name)
    {
        var raw = ReadPropertyLast(root, name);
        if (raw is null) return null;
        return bool.TryParse(raw, out var b) ? b : null;
    }
}

internal sealed record ParsedProject(
    string Path,
    string? Sdk,
    string AssemblyName,
    string PackageId,
    IReadOnlyList<string> TargetFrameworks,
    bool IsTestProject,
    bool IsPackable,
    IReadOnlyList<ParsedProjectReference> ProjectReferences,
    IReadOnlyList<ParsedPackageReference> PackageReferences,
    string? GitRepoRoot);

internal sealed record ParsedProjectReference(string AbsolutePath);

internal sealed record ParsedPackageReference(string Id, string? Version);
