using Depmap.Parsing;

namespace Depmap.Graph;

internal static class Classifier
{
    public static ProjectClassification Classify(ParsedProject p)
    {
        var c = ProjectClassification.None;

        var sdk = p.Sdk ?? string.Empty;
        var sdkLower = sdk.ToLowerInvariant();

        var isWebSdk    = sdkLower.Contains("microsoft.net.sdk.web");
        var isBlazorSdk = sdkLower.Contains("blazor");
        var isWorkerSdk = sdkLower.Contains("worker");

        if (p.IsTestProject)
            c |= ProjectClassification.Test;

        if (isWebSdk)
            c |= ProjectClassification.Web;

        if (isBlazorSdk || HasBlazorPackage(p))
            c |= ProjectClassification.Blazor;

        if (isWorkerSdk || HasHostingPackage(p) && !isWebSdk)
            c |= ProjectClassification.Service;

        if (p.IsPackable)
            c |= ProjectClassification.NugetProducing;

        if (c == ProjectClassification.None)
        {
            // Default classification: library is the usual case. Console apps get a separate label when the
            // project opts in with OutputType=Exe — we don't parse OutputType explicitly here; it's informational
            // only for the graph, and doesn't change impact analysis.
            c = ProjectClassification.Library;
        }

        return c;
    }

    private static bool HasBlazorPackage(ParsedProject p) =>
        p.PackageReferences.Any(pr =>
            pr.Id.StartsWith("Microsoft.AspNetCore.Components", StringComparison.OrdinalIgnoreCase));

    private static bool HasHostingPackage(ParsedProject p) =>
        p.PackageReferences.Any(pr => pr.Id.Equals("Microsoft.Extensions.Hosting", StringComparison.OrdinalIgnoreCase));
}
