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

  const eles = cy.elements().not(".is-filtered");
  const config: cytoscape.LayoutOptions =
    layout === "fcose"
      ? ({ name: "fcose", eles, animate: false, nodeRepulsion: 6800, idealEdgeLength: 142, packComponents: true, gravity: 0.14, fit: true, padding: 64 } as cytoscape.LayoutOptions)
      : layout === "concentric"
        ? ({ name: "concentric", eles, animate: false, fit: true, padding: 64, minNodeSpacing: 42, concentric: (node: cytoscape.NodeSingular) => node.indegree(false), levelWidth: () => 1 } as cytoscape.LayoutOptions)
      : ({ name: "dagre", eles, rankDir: "LR", ranker: "network-simplex", nodeSep: 46, rankSep: 132, edgeSep: 36, nodeDimensionsIncludeLabels: true, fit: true, padding: 64 } as cytoscape.LayoutOptions);

  cy.layout(config).run();
}

export function applyVisibility(cy: cytoscape.Core | null, filterState: FilterState): void {
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

      node.toggleClass("is-filtered", !visible);
    });

    cy.edges().forEach((edge) => {
      const visible = !edge.source().hasClass("is-filtered") && !edge.target().hasClass("is-filtered");
      edge.toggleClass("is-filtered", !visible);
    });

    cy.nodes(".n-repo").forEach((repo) => {
      const hasVisibleChildren = repo.children().not(".is-filtered").nonempty();
      repo.toggleClass("is-filtered", !hasVisibleChildren);
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
  const graphSelectionId = model.graphIdForSelection(selectionId);
  const linked = new Set([selectionId, graphSelectionId, ...ancestors, ...descendants]);

  cy.nodes().forEach((node) => {
    if (node.hasClass("is-filtered") || node.hasClass("n-repo")) return;
    node.addClass(linked.has(node.id()) ? "hilite" : "dim");
  });

  cy.nodes(".n-repo").forEach((repo) => {
    if (repo.hasClass("is-filtered")) return;
    const visibleChildren = repo.children().not(".is-filtered");
    const allDimmed = visibleChildren.nonempty() && visibleChildren.not(".dim").empty();
    if (allDimmed) repo.addClass("dim");
  });

  cy.edges().forEach((edge) => {
    if (edge.hasClass("is-filtered")) return;
    edge.addClass(linked.has(edge.source().id()) && linked.has(edge.target().id()) ? "hilite" : "dim");
  });

  ancestors.forEach((id) => cy.getElementById(id).addClass("ancestor"));
  descendants.forEach((id) => cy.getElementById(id).addClass("descendant"));
  cy.getElementById(graphSelectionId).select();
}

export function fitSelection(cy: cytoscape.Core | null, model: GraphModel | null, selectionId: string | null, leftInset = 0): void {
  if (!cy || !selectionId || !model?.nodesById[selectionId]) return;

  const graphSelectionId = model.graphIdForSelection(selectionId);
  const ids = new Set([graphSelectionId, ...model.neighborhood(selectionId).map((id) => model.graphIdForSelection(id))]);
  const visibleNodes = cy
    .nodes()
    .filter((node) => ids.has(node.id()) && !node.hasClass("is-filtered") && !node.hasClass("n-repo"));

  if (visibleNodes.nonempty()) {
    fitElementsInAvailableViewport(cy, visibleNodes, leftInset);
    return;
  }

  const selected = cy.getElementById(graphSelectionId);
  if (selected.nonempty()) {
    fitElementsInAvailableViewport(cy, selected, leftInset);
  }
}

function fitElementsInAvailableViewport(
  cy: cytoscape.Core,
  elements: cytoscape.CollectionReturnValue,
  leftInset: number,
): void {
  const padding = 96;
  const viewportWidth = cy.width();
  const viewportHeight = cy.height();
  const usableLeft = Math.min(leftInset, viewportWidth * 0.7);
  const usableWidth = Math.max(240, viewportWidth - usableLeft);
  const usableHeight = Math.max(240, viewportHeight);
  const bounds = elements.boundingBox({ includeLabels: true, includeOverlays: false });

  const boundsWidth = Math.max(1, bounds.w);
  const boundsHeight = Math.max(1, bounds.h);
  const zoom = clamp(
    Math.min((usableWidth - padding * 2) / boundsWidth, (usableHeight - padding * 2) / boundsHeight),
    cy.minZoom(),
    cy.maxZoom(),
  );
  const boundsCenterX = bounds.x1 + boundsWidth / 2;
  const boundsCenterY = bounds.y1 + boundsHeight / 2;
  const viewportCenterX = usableLeft + usableWidth / 2;
  const viewportCenterY = viewportHeight / 2;

  cy.animate({
    zoom,
    pan: {
      x: viewportCenterX - boundsCenterX * zoom,
      y: viewportCenterY - boundsCenterY * zoom,
    },
    duration: 220,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
