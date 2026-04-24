import type cytoscape from "cytoscape";
import type { DepmapGraph, ProjectKind } from "../api/types";
import type { GraphModel } from "../domain/graphModel";
import { effectiveProjectKinds } from "../domain/projectKinds";

export type LayoutId = "dagre" | "fcose" | "concentric";

export interface FilterState {
  kindFilters: Record<ProjectKind, boolean>;
  showExternal: boolean;
}

export function buildElements(graph: DepmapGraph, groupByRepo: boolean): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];
  const collapsedPackages = new Map<string, string>();

  graph.packages.forEach((pkg) => {
    if (pkg.producedBy) collapsedPackages.set(pkg.id, pkg.producedBy);
  });

  if (groupByRepo) {
    graph.repos.forEach((repo) => {
      elements.push({ data: { id: repo.id, label: repo.name, type: "repo" }, classes: "n-repo" });
    });
  }

  graph.projects.forEach((project) => {
    const kinds = effectiveProjectKinds(project.kinds);
    elements.push({
      data: {
        id: project.id,
        label: project.name,
        type: "project",
        kinds: kinds.join(" "),
        parent: groupByRepo ? project.repo : undefined,
      },
      classes: ["n-project", ...kinds.map((kind) => `kind-${kind}`)].join(" "),
    });
  });

  graph.packages.forEach((pkg) => {
    if (collapsedPackages.has(pkg.id)) return;

    elements.push({
      data: { id: pkg.id, label: pkg.name, type: "package", classification: pkg.classification || "unknown" },
      classes: `n-package pkg-${pkg.classification || "unknown"}`,
    });
  });

  graph.edges.forEach((edge, index) => {
    if (edge.kind === "solutionContains") return;

    const source = collapsedPackages.get(edge.from) || edge.from;
    const target = collapsedPackages.get(edge.to) || edge.to;
    if (source === target) return;

    elements.push({ data: { id: `e${index}`, source, target, kind: edge.kind }, classes: `e-${edge.kind}` });
  });

  return elements;
}

export function runLayout(cy: cytoscape.Core | null, layout: LayoutId): void {
  if (!cy) return;

  const config: cytoscape.LayoutOptions =
    layout === "fcose"
      ? ({ name: "fcose", animate: false, nodeRepulsion: 6200, idealEdgeLength: 120, packComponents: true, gravity: 0.16, fit: true, padding: 52 } as cytoscape.LayoutOptions)
      : layout === "concentric"
        ? { name: "concentric", animate: false, fit: true, padding: 52, concentric: (node: cytoscape.NodeSingular) => node.degree(), levelWidth: () => 2 }
      : ({ name: "dagre", rankDir: "LR", ranker: "network-simplex", nodeSep: 34, rankSep: 110, edgeSep: 28, nodeDimensionsIncludeLabels: true, fit: true, padding: 52 } as cytoscape.LayoutOptions);

  cy.layout(config).run();
}

export function applyVisibility(cy: cytoscape.Core | null, filterState: FilterState, _searchText: string): void {
  if (!cy) return;

  const { kindFilters, showExternal } = filterState;

  cy.batch(() => {
    cy.nodes().forEach((node) => {
      if (node.hasClass("n-repo")) return;

      const type = node.data("type");
      let visible = true;

      if (type === "project") {
        const kinds = String(node.data("kinds") || "").split(/\s+/).filter(Boolean) as ProjectKind[];
        visible = effectiveProjectKinds(kinds).some((kind) => kindFilters[kind] !== false);
      } else if (type === "package") {
        const classification = node.data("classification");
        if ((classification === "external" || classification === "unknown") && !showExternal) visible = false;
      }

      node.style("display", visible ? "element" : "none");
    });

    cy.edges().forEach((edge) => {
      const visible = edge.source().style("display") !== "none" && edge.target().style("display") !== "none";
      edge.style("display", visible ? "element" : "none");
    });

    cy.nodes(".n-repo").forEach((repo) => {
      const hasVisibleChildren = repo.children().filter((child) => child.style("display") !== "none").nonempty();
      repo.style("display", hasVisibleChildren ? "element" : "none");
    });
  });
}

export function applySelection(cy: cytoscape.Core | null, model: GraphModel | null, selectionId: string | null): void {
  if (!cy) return;

  cy.elements().removeClass("dim hilite ancestor descendant");
  cy.elements().unselect();
  if (!selectionId || !model?.nodesById[selectionId]) return;

  const ancestors = model.reverseReach(selectionId);
  const descendants = model.forwardReach(selectionId);
  const linked = new Set([selectionId, ...ancestors, ...descendants]);

  cy.nodes().forEach((node) => {
    if (node.style("display") === "none" || node.hasClass("n-repo")) return;
    node.addClass(linked.has(node.id()) ? "hilite" : "dim");
  });

  cy.edges().forEach((edge) => {
    if (edge.style("display") === "none") return;
    edge.addClass(linked.has(edge.source().id()) && linked.has(edge.target().id()) ? "hilite" : "dim");
  });

  ancestors.forEach((id) => cy.getElementById(id).addClass("ancestor"));
  descendants.forEach((id) => cy.getElementById(id).addClass("descendant"));
  cy.getElementById(selectionId).select();
}
