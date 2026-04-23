using Depmap.Commands;

namespace Depmap;

internal static class Program
{
    public static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0 || args[0] is "-h" or "--help" or "help")
            {
                PrintUsage();
                return 0;
            }

            var command = args[0];
            var rest = args.Skip(1).ToArray();

            return command switch
            {
                "scan" => ScanCommand.Run(rest),
                _ => UnknownCommand(command),
            };
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"error: {ex.Message}");
            return 1;
        }
    }

    private static int UnknownCommand(string command)
    {
        Console.Error.WriteLine($"error: unknown command '{command}'");
        PrintUsage();
        return 2;
    }

    private static void PrintUsage()
    {
        Console.WriteLine("""
            depmap — visualize .NET solution and NuGet dependencies across a folder of repositories.

            Usage:
              depmap scan <rootFolder> [options]

            Options:
              --output <path>      Path for the self-contained HTML artifact (default: depmap.html)
              --json <path>        Also emit the raw graph as JSON to this path
              --include-transitive Include transitive NuGet edges from project.assets.json when present (default: true)
              --no-transitive      Disable transitive NuGet edges
              --ignore <glob>      Glob(s) of paths to skip (may be repeated)
              --quiet              Suppress progress output

            Examples:
              depmap scan ./repos
              depmap scan C:\src\microservices --output build/depmap.html --json build/graph.json
            """);
    }
}
