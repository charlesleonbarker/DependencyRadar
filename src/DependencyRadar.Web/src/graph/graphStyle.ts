import type cytoscape from "cytoscape";

interface GraphPalette {
  ink: string;
  muted: string;
  accent: string;
  red: string;
  green: string;
  teal: string;
  kindLibrary: string;
  kindTest: string;
  kindWeb: string;
  kindBlazor: string;
  kindService: string;
  kindNuget: string;
}

const DEFAULT_PALETTE: GraphPalette = {
  ink: "#1b1f23",
  muted: "#64748b",
  accent: "#2563eb",
  red: "#dc2626",
  green: "#16a34a",
  teal: "#0f766e",
  kindLibrary: "#94a3b8",
  kindTest: "#8b5cf6",
  kindWeb: "#f59e0b",
  kindBlazor: "#ec4899",
  kindService: "#14b8a6",
  kindNuget: "#16a34a",
};

export function graphStyleFromElement(element: Element): cytoscape.StylesheetJson {
  const styles = getComputedStyle(element);
  const cssColor = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return graphStyle({
    ink: cssColor("--ink", DEFAULT_PALETTE.ink),
    muted: cssColor("--muted", DEFAULT_PALETTE.muted),
    accent: cssColor("--accent", DEFAULT_PALETTE.accent),
    red: cssColor("--red", DEFAULT_PALETTE.red),
    green: cssColor("--green", DEFAULT_PALETTE.green),
    teal: cssColor("--teal", DEFAULT_PALETTE.teal),
    kindLibrary: cssColor("--kind-library", DEFAULT_PALETTE.kindLibrary),
    kindTest: cssColor("--kind-test", DEFAULT_PALETTE.kindTest),
    kindWeb: cssColor("--kind-web", DEFAULT_PALETTE.kindWeb),
    kindBlazor: cssColor("--kind-blazor", DEFAULT_PALETTE.kindBlazor),
    kindService: cssColor("--kind-service", DEFAULT_PALETTE.kindService),
    kindNuget: cssColor("--kind-nuget", DEFAULT_PALETTE.kindNuget),
  });
}

export const GRAPH_STYLE: cytoscape.StylesheetJson = graphStyle(DEFAULT_PALETTE);

function graphStyle(palette: GraphPalette): cytoscape.StylesheetJson {
  return [
  {
    selector: "node",
    style: {
      label: "data(label)",
      color: palette.ink,
      "font-size": 14,
      "min-zoomed-font-size": 7,
      "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 7,
      "text-outline-width": 0,
      "background-color": palette.muted,
      width: 30,
      height: 30,
      "border-width": 1.5,
      "border-color": palette.muted,
      "transition-property": "opacity, border-width, border-color, background-color",
      "transition-duration": 120,
      "transition-timing-function": "ease-out",
    },
  },
  {
    selector: ".n-repo",
    style: {
      shape: "round-rectangle",
      "background-opacity": 0.04,
      "background-color": palette.accent,
      "border-style": "dashed",
      "border-color": palette.accent,
      "border-width": 2.5,
      "border-opacity": 0.45,
      "text-valign": "top",
      "text-halign": "center",
      "text-justification": "center",
      "font-size": 12,
      "font-weight": 600,
      "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
      color: palette.accent,
      padding: "38px",
      "text-margin-x": 0,
      "text-margin-y": 14,
      "text-max-width": "220px",
      "text-wrap": "wrap",
    },
  },
  { selector: ".n-project", style: { shape: "round-rectangle", "background-color": palette.muted, width: 48, height: 32 } },
  { selector: ".kind-library", style: { "background-color": palette.kindLibrary } },
  { selector: ".kind-test", style: { "background-color": palette.kindTest } },
  { selector: ".kind-web", style: { "background-color": palette.kindWeb } },
  { selector: ".kind-blazor", style: { "background-color": palette.kindBlazor } },
  { selector: ".kind-service", style: { "background-color": palette.kindService } },
  { selector: ".kind-nuget-producing", style: { "border-color": palette.kindNuget, "border-width": 3 } },
  { selector: ".n-package", style: { shape: "diamond", width: 30, height: 30 } },
  { selector: ".pkg-internal", style: { "background-color": palette.kindNuget, color: palette.ink } },
  { selector: ".pkg-unknown", style: { "background-color": palette.muted, opacity: 0.92 } },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "rgba(71, 85, 105, 0.26)",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "rgba(71, 85, 105, 0.26)",
      "curve-style": "bezier",
      "arrow-scale": 0.85,
      "overlay-opacity": 0,
      "source-distance-from-node": 3,
      "target-distance-from-node": 5,
      "transition-property": "opacity, width, line-color, target-arrow-color",
      "transition-duration": 120,
      "transition-timing-function": "ease-out",
      events: "no",
    },
  },
  { selector: ".e-projectRef", style: { width: 3, "line-color": palette.teal, "target-arrow-color": palette.teal, "target-arrow-shape": "triangle" } },
  { selector: ".e-packageRef", style: { width: 2.5, "line-color": palette.red, "target-arrow-color": palette.red, "target-arrow-shape": "vee" } },
  { selector: ".e-producedBy", style: { width: 2.3, "line-color": palette.green, "target-arrow-color": palette.green, "target-arrow-shape": "triangle", "line-style": "dotted" } },
  {
    selector: ".n-repo:active",
    style: {
      "overlay-color": palette.accent,
      "overlay-opacity": 0.07,
      "overlay-padding": 6,
    },
  },
  {
    selector: ".n-repo:hover",
    style: {
      "background-opacity": 0.11,
    },
  },
  { selector: ".is-filtered", style: { display: "none" } },
  { selector: ".dim", style: { opacity: 0.09 } },
  { selector: "edge.dim", style: { "target-arrow-shape": "none" } },
  { selector: ".hilite", style: { opacity: 1, "z-index": 20 } },
  {
    selector: ".ancestor",
    style: {
      "border-color": palette.red,
      "border-width": 10,
    },
  },
  {
    selector: ".descendant",
    style: {
      "border-color": palette.green,
      "border-width": 10,
    },
  },
  {
    selector: ":selected",
    style: {
      "border-color": palette.accent,
      "border-width": 12,
      "z-index": 70,
      "overlay-opacity": 0,
    },
  },
  {
    selector: ".n-repo:selected",
    style: {
      "border-width": 3.5,
      "border-opacity": 1,
    },
  },
  { selector: ".sidebar-muted", style: { opacity: 0.15 } },
  {
    selector: ".n-repo.sidebar-muted",
    style: {
      // opacity: 1 prevents the compound node from cascading its opacity down to
      // child project nodes — without this, children multiply to ~0.006 (invisible).
      // The repo box appearance is controlled via the individual *-opacity properties below.
      opacity: 1,
      "border-opacity": 0.06,
      "background-opacity": 0.01,
      "text-opacity": 0.12,
    },
  },
  { selector: "edge.sidebar-muted", style: { "target-arrow-shape": "none" } },
  { selector: ".sidebar-focus", style: { opacity: 1, "z-index": 80 } },
  {
    selector: ".n-repo.sidebar-focus",
    style: {
      "border-opacity": 0.75,
      "background-opacity": 0.08,
      "text-opacity": 1,
      "z-index": 75,
    },
  },
  { selector: "edge.sidebar-focus", style: { opacity: 1, width: 4, "z-index": 70 } },
  ];
}
