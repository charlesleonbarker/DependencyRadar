using System.Reflection;
using System.Text;

namespace Depmap.Rendering;

/// <summary>
/// Produces the self-contained depmap.html by taking the viewer template and replacing placeholders
/// with the inlined CSS, JS, graph JSON, and (where available) Cytoscape library bundles.
///
/// Placeholders in viewer.html:
///   /*__DEPMAP_CSS__*/                — replaced with viewer.css contents
///   /*__DEPMAP_GRAPH_JSON__*/         — replaced with graph JSON (inside a non-executing script tag)
///   &lt;!--__DEPMAP_CYTOSCAPE_JS__--&gt;     — replaced with cytoscape.min.js in a script tag, or a CDN fallback
///   &lt;!--__DEPMAP_CYTOSCAPE_FCOSE_JS__--&gt; — fcose layout; CDN fallback if not embedded
///   &lt;!--__DEPMAP_CYTOSCAPE_DAGRE_JS__--&gt; — dagre layout; CDN fallback if not embedded
///   /*__DEPMAP_VIEWER_JS__*/          — replaced with viewer.js contents
/// </summary>
internal static class ArtifactBuilder
{
    private const string CdnFallbackCytoscape = "https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js";
    private const string CdnFallbackFcose     = "https://unpkg.com/cytoscape-fcose@2.2.0/cytoscape-fcose.js";
    private const string CdnFallbackDagre     = "https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js";

    public static string BuildSingleFileHtml(string graphJson)
    {
        var viewerHtml = ReadResource("Viewer.viewer.html");
        var viewerCss  = ReadResource("Viewer.viewer.css");
        var viewerJs   = ReadResource("Viewer.viewer.js");

        var cytoscapeTag = InlineOrCdn("Viewer.cytoscape.min.js", CdnFallbackCytoscape);
        var fcoseTag     = InlineOrCdn("Viewer.cytoscape-fcose.min.js", CdnFallbackFcose, globalVar: "cytoscapeFcose");
        var dagreTag     = InlineOrCdn("Viewer.cytoscape-dagre.min.js", CdnFallbackDagre, globalVar: "cytoscapeDagre");

        // Replace in a deterministic order. The graph JSON is placed inside a <script type="application/json">,
        // so the only sequence we need to escape is '</script>' which can't legally appear in JSON — we escape
        // defensively anyway.
        var safeGraphJson = graphJson.Replace("</", "<\\/");

        var html = viewerHtml
            .Replace("/*__DEPMAP_CSS__*/", viewerCss)
            .Replace("/*__DEPMAP_GRAPH_JSON__*/", safeGraphJson)
            .Replace("<!--__DEPMAP_CYTOSCAPE_JS__-->", cytoscapeTag)
            .Replace("<!--__DEPMAP_CYTOSCAPE_FCOSE_JS__-->", fcoseTag)
            .Replace("<!--__DEPMAP_CYTOSCAPE_DAGRE_JS__-->", dagreTag)
            .Replace("/*__DEPMAP_VIEWER_JS__*/", viewerJs);

        return html;
    }

    private static string InlineOrCdn(string resourceName, string cdnUrl, string? globalVar = null)
    {
        var contents = TryReadResource(resourceName);
        if (contents is not null)
            return $"<script>{contents}</script>";
        // Fall back to a CDN load. The comment makes the trade-off visible in the rendered HTML source.
        var marker = globalVar is null ? string.Empty : $" <!-- expects window.{globalVar} -->";
        return $"<script src=\"{cdnUrl}\"></script>{marker}";
    }

    private static string ReadResource(string suffix)
    {
        return TryReadResource(suffix) ?? throw new FileNotFoundException($"Missing embedded resource: {suffix}");
    }

    private static string? TryReadResource(string suffix)
    {
        var asm = Assembly.GetExecutingAssembly();
        var fullName = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
        if (fullName is null) return null;
        using var stream = asm.GetManifestResourceStream(fullName)!;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
