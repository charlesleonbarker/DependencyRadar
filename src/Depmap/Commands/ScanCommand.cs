using Depmap.Rendering;
using Depmap.Scanning;

namespace Depmap.Commands;

internal static class ScanCommand
{
    public static int Run(string[] args)
    {
        var options = ScanOptions.Parse(args);
        if (options is null) return 2;

        var root = Path.GetFullPath(options.Root);
        if (!Directory.Exists(root))
        {
            Console.Error.WriteLine($"error: root folder does not exist: {root}");
            return 1;
        }

        var log = options.Quiet ? (Action<string>)(_ => { }) : Console.Error.WriteLine;
        var scanner = new DepmapScanner();
        var snapshot = scanner.Scan(new ScanRequest(root, options.IncludeTransitive, options.IgnoreGlobs), log, indentJson: true);

        if (options.JsonPath is { } jsonPath)
        {
            var resolvedJson = Path.GetFullPath(jsonPath);
            EnsureParentDirectory(resolvedJson);
            File.WriteAllText(resolvedJson, snapshot.GraphJson);
            log($"wrote {resolvedJson}");
        }

        var htmlPath = Path.GetFullPath(options.OutputPath);
        EnsureParentDirectory(htmlPath);
        var html = ArtifactBuilder.BuildSingleFileHtml(snapshot.GraphJson);
        File.WriteAllText(htmlPath, html);
        log($"wrote {htmlPath}");

        return 0;
    }

    private static void EnsureParentDirectory(string filePath)
    {
        var dir = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
    }
}

internal sealed record ScanOptions(
    string Root,
    string OutputPath,
    string? JsonPath,
    bool IncludeTransitive,
    IReadOnlyList<string> IgnoreGlobs,
    bool Quiet)
{
    public static ScanOptions? Parse(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("error: 'scan' requires a root folder argument");
            return null;
        }

        string? root = null;
        string output = "depmap.html";
        string? json = null;
        bool includeTransitive = true;
        var ignores = new List<string>();
        bool quiet = false;

        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            switch (a)
            {
                case "--output":
                    output = RequireValue(args, ref i, a);
                    break;
                case "--json":
                    json = RequireValue(args, ref i, a);
                    break;
                case "--include-transitive":
                    includeTransitive = true;
                    break;
                case "--no-transitive":
                    includeTransitive = false;
                    break;
                case "--ignore":
                    ignores.Add(RequireValue(args, ref i, a));
                    break;
                case "--quiet":
                    quiet = true;
                    break;
                default:
                    if (a.StartsWith("--"))
                    {
                        Console.Error.WriteLine($"error: unknown option '{a}'");
                        return null;
                    }
                    if (root is not null)
                    {
                        Console.Error.WriteLine($"error: unexpected argument '{a}'");
                        return null;
                    }
                    root = a;
                    break;
            }
        }

        if (root is null)
        {
            Console.Error.WriteLine("error: root folder is required");
            return null;
        }

        return new ScanOptions(root, output, json, includeTransitive, ignores, quiet);
    }

    private static string RequireValue(string[] args, ref int i, string flag)
    {
        if (i + 1 >= args.Length)
            throw new ArgumentException($"option {flag} requires a value");
        return args[++i];
    }
}
