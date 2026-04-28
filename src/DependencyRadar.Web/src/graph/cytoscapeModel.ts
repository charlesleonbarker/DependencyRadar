import type cytoscape from "cytoscape";
import type { DependencyRadarGraph, ProjectKind } from "../api/types";
import type { GraphModel } from "../domain/graphModel";
import { toTitleCase } from "../domain/graphModel";
import { effectiveProjectKinds } from "../domain/projectKinds";

export type LayoutId = "dagre" | "fcose" | "concentric";

export interface ViewOptions {
  density: number;
}

export const DEFAULT_VIEW_OPTIONS: ViewOptions = {
  density: 0.5,
};

export interface FilterState {
  kindFilters: Record<ProjectKind, boolean>;
  repoFilters: Record<string, boolean>;
  showExternal: boolean;
  focusIds: Set<string> | null;
}

export function buildElements(graph: DependencyRadarGraph, groupByRepo: boolean): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];
  const collapsedPackages = new Map<string, string>();

  graph.packages.forEach((pkg) => {
    if (pkg.producedBy) collapsedPackages.set(pkg.id, pkg.producedBy);
  });

  if (groupByRepo) {
    graph.repos.forEach((repo) => {
      elements.push({ data: { id: repo.id, label: toTitleCase(repo.name), type: "repo" }, classes: "n-repo" });
    });
  }

  graph.projects.forEach((project) => {
    const kinds = effectiveProjectKinds(project.kinds);
    elements.push({
      data: {
        id: project.id,
        label: project.name,
        type: "project",
        baseWidth: 48,
        baseHeight: 32,
        kinds: kinds.join(" "),
        parent: groupByRepo ? project.repo : undefined,
      },
      classes: ["n-project", ...kinds.map((kind) => `kind-${kind}`)].join(" "),
    });
  });

  graph.packages.forEach((pkg) => {
    if (collapsedPackages.has(pkg.id)) return;

    elements.push({
      data: { id: pkg.id, label: pkg.name, type: "package", baseWidth: 30, baseHeight: 30, classification: pkg.classification || "unknown" },
      classes: `n-package pkg-${pkg.classification || "unknown"}`,
    });
  });

  graph.edges.forEach((edge, index) => {
    if (edge.kind === "solutionContains") return;

    const source = collapsedPackages.get(edge.from) || edge.from;
    const target = collapsedPackages.get(edge.to) || edge.to;
    if (source === target) return;

    elements.push({ data: { id: `e${index}`, source, target, kind: edge.kind, version: edge.version }, classes: `e-${edge.kind}` });
  });

  return elements;
}

export function applyNodeScale(cy: cytoscape.Core | null, scale: number): void {
  if (!cy) return;

  cy.batch(() => {
    cy.nodes(":not(.n-repo)").forEach((node) => {
      const baseWidth = Number(node.data("baseWidth")) || 30;
      const baseHeight = Number(node.data("baseHeight")) || 30;
      node.style({
        width: baseWidth * scale,
        height: baseHeight * scale,
      });
    });
  });
}

export function restoreCompoundParents(cy: cytoscape.Core | null): void {
  if (!cy) return;
  cy.nodes().forEach((node) => {
    const savedParent = node.data("_sp") as string | undefined;
    if (savedParent) {
      node.move({ parent: savedParent });
      node.removeData("_sp");
    }
  });
}

export function runLayout(cy: cytoscape.Core | null, layout: LayoutId, viewOptions: ViewOptions = DEFAULT_VIEW_OPTIONS): void {
  if (!cy) return;

  restoreCompoundParents(cy);

  const allVisible = cy.elements().not(".is-filtered");

  // Ensure every edge in the layout set has both endpoints present — dagre throws
  // "g.node(...) is undefined" on large compound graphs when this invariant breaks.
  const visibleNodeIds = new Set(allVisible.nodes().map((n) => n.id()));
  const eles = allVisible.filter((ele) => {
    if (!ele.isEdge()) return true;
    return visibleNodeIds.has(ele.source().id()) && visibleNodeIds.has(ele.target().id());
  });

  const density = densityOptions(viewOptions.density);
  const config: cytoscape.LayoutOptions =
    layout === "fcose"
      ? ({ name: "fcose", eles, animate: false, nodeRepulsion: density.nodeRepulsion, idealEdgeLength: density.idealEdgeLength, packComponents: true, gravity: 0.14, fit: true, padding: density.padding } as cytoscape.LayoutOptions)
      : layout === "concentric"
        ? ({ name: "concentric", eles, animate: false, fit: true, padding: density.padding, minNodeSpacing: density.minNodeSpacing, concentric: (node: cytoscape.NodeSingular) => node.indegree(false), levelWidth: () => 1 } as cytoscape.LayoutOptions)
      : ({ name: "dagre", eles, rankDir: "TB", ranker: "tight-tree", nodeSep: density.nodeSep, rankSep: density.rankSep, edgeSep: density.edgeSep, nodeDimensionsIncludeLabels: false, fit: true, padding: density.padding } as cytoscape.LayoutOptions);

  try {
    cy.layout(config).run();
  } catch {
    cy.fit();
  }
}

export function applyDensity(cy: cytoscape.Core | null, previousDensity: number, nextDensity: number): void {
  if (!cy) return;

  const previousScale = densityScale(previousDensity);
  const nextScale = densityScale(nextDensity);
  if (Math.abs(previousScale - nextScale) < 0.001) return;

  const visibleNodes = cy.nodes().not(".is-filtered, .n-repo");
  if (visibleNodes.empty()) return;

  const bounds = visibleNodes.boundingBox({ includeLabels: false, includeOverlays: false });
  const centerX = bounds.x1 + Math.max(1, bounds.w) / 2;
  const centerY = bounds.y1 + Math.max(1, bounds.h) / 2;
  const ratio = nextScale / previousScale;

  cy.batch(() => {
    visibleNodes.forEach((node) => {
      const position = node.position();
      node.position({
        x: centerX + (position.x - centerX) * ratio,
        y: centerY + (position.y - centerY) * ratio,
      });
    });
  });
}

function densityOptions(value: number): { idealEdgeLength: number; nodeRepulsion: number; minNodeSpacing: number; nodeSep: number; rankSep: number; edgeSep: number; padding: number } {
  const density = clamp(value, 0, 1);
  return {
    idealEdgeLength: lerp(10, 268, density),
    nodeRepulsion: lerp(110, 15750, density),
    minNodeSpacing: lerp(1, 100, density),
    nodeSep: lerp(1, 110, density),
    rankSep: lerp(6, 278, density),
    edgeSep: lerp(1, 78, density),
    padding: lerp(4, 127, density),
  };
}

function densityScale(value: number): number {
  return lerp(0.04, 2.07, clamp(value, 0, 1));
}

export function applyVisibility(cy: cytoscape.Core | null, filterState: FilterState): void {
  if (!cy) return;

  const { kindFilters, repoFilters, showExternal, focusIds } = filterState;

  cy.batch(() => {
    cy.nodes().forEach((node) => {
      if (node.hasClass("n-repo")) return;

      const type = node.data("type");
      let visible = true;

      if (type === "project") {
        const kinds = String(node.data("kinds") || "").split(/\s+/).filter(Boolean) as ProjectKind[];
        const repoId = String(node.data("parent") || "");
        visible = repoFilters[repoId] !== false && effectiveProjectKinds(kinds).some((kind) => kindFilters[kind] !== false);
        if (visible && focusIds) visible = focusIds.has(node.id());
      } else if (type === "package") {
        const classification = node.data("classification");
        if (classification !== "internal" && !showExternal) visible = false;
        if (visible && focusIds) visible = focusIds.has(node.id());
      }

      node.toggleClass("is-filtered", !visible);
    });

    // Second pass: hide packages with no visible project connections.
    // Project nodes are fully filtered by the pass above, so checking their .is-filtered
    // state here is correct even though edge filtering hasn't run yet.
    cy.nodes(".n-package").forEach((node) => {
      if (node.hasClass("is-filtered")) return;

      const visibleProjectLinks = node
        .connectedEdges()
        .connectedNodes()
        .filter((other) => other.id() !== node.id() && other.data("type") === "project" && !other.hasClass("is-filtered"));

      node.toggleClass("is-filtered", visibleProjectLinks.empty());
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

export function fitGraph(cy: cytoscape.Core | null, leftInset = 0): void {
  if (!cy) return;

  const visibleNodes = cy.nodes().not(".is-filtered, .n-repo");
  if (visibleNodes.nonempty()) {
    fitElementsInAvailableViewport(cy, visibleNodes, leftInset);
  }
}

export function applySelection(cy: cytoscape.Core | null, model: GraphModel | null, selectionId: string | null): void {
  if (!cy) return;

  restoreCompoundParents(cy);

  cy.elements().removeClass("dim hilite ancestor descendant");
  cy.elements().unselect();
  if (!selectionId || !model?.nodesById[selectionId]) return;

  const ancestors = model.reverseReach(selectionId);
  const descendants = model.forwardReach(selectionId);
  const graphSelectionId = model.graphIdForSelection(selectionId);
  const linked = new Set([selectionId, graphSelectionId, ...model.neighborhood(selectionId), ...ancestors, ...descendants]);

  cy.nodes().forEach((node) => {
    if (node.hasClass("is-filtered")) return;
    if (node.hasClass("n-repo")) {
      if (linked.has(node.id())) node.addClass("hilite");
      return;
    }
    node.addClass(linked.has(node.id()) ? "hilite" : "dim");
  });

  cy.nodes(".n-repo").forEach((repo) => {
    if (repo.hasClass("is-filtered")) return;
    const visibleChildren = repo.children().not(".is-filtered");
    const allDimmed = visibleChildren.nonempty() && visibleChildren.not(".dim").empty();
    if (allDimmed && !linked.has(repo.id())) repo.addClass("dim");
  });

  cy.edges().forEach((edge) => {
    if (edge.hasClass("is-filtered")) return;
    edge.addClass(linked.has(edge.source().id()) && linked.has(edge.target().id()) ? "hilite" : "dim");
  });

  ancestors.forEach((id) => cy.getElementById(id).addClass("ancestor"));
  descendants.forEach((id) => cy.getElementById(id).addClass("descendant"));
  cy.getElementById(graphSelectionId).select();

  // Move dimmed nodes out of their compound parent so the repo box shrinks
  // to only enclose the highlighted nodes. Saved parent is restored above on next call.
  cy.nodes(".dim").forEach((node) => {
    if (node.hasClass("n-repo")) return;
    const parentId = node.data("parent") as string | undefined;
    if (parentId) {
      node.data("_sp", parentId);
      node.move({ parent: null });
    }
  });
}

export function applySidebarHover(cy: cytoscape.Core | null, model: GraphModel | null, pathIds: string[][] | null): void {
  if (!cy) return;

  cy.elements().removeClass("sidebar-focus sidebar-muted");
  if (!model || !pathIds || pathIds.length === 0) return;

  const graphPaths = pathIds
    .map((path) => path.map((id) => model.graphIdForSelection(id)).filter((id, index, ids) => id && ids.indexOf(id) === index))
    .filter((path) => path.length > 0);
  if (graphPaths.length === 0) return;

  const routeSet = new Set(graphPaths.flat());
  const routePairs = new Set<string>();

  graphPaths.forEach((graphPathIds) => {
    graphPathIds.forEach((id) => {
      const node = cy.getElementById(id);
      const parent = node.parent();
      const parentNode = parent[0];
      if (parentNode) routeSet.add(parentNode.id());
    });

    const nonRepoPathIds = graphPathIds.filter((id) => {
      const node = cy.getElementById(id);
      return node.empty() || !node.hasClass("n-repo");
    });
    addRoutePairs(routePairs, graphPathIds);
    addRoutePairs(routePairs, nonRepoPathIds);
  });

  cy.nodes().forEach((node) => {
    if (node.hasClass("is-filtered")) return;
    node.addClass(routeSet.has(node.id()) ? "sidebar-focus" : "sidebar-muted");
  });

  cy.edges().forEach((edge) => {
    if (edge.hasClass("is-filtered")) return;
    const pair = `${edge.source().id()}->${edge.target().id()}`;
    const inRoute = routePairs.has(pair);
    edge.addClass(inRoute ? "sidebar-focus" : "sidebar-muted");
  });
}

function addRoutePairs(routePairs: Set<string>, pathIds: string[]): void {
  for (let index = 0; index < pathIds.length - 1; index += 1) {
    const source = pathIds[index];
    const target = pathIds[index + 1];
    routePairs.add(`${source}->${target}`);
    routePairs.add(`${target}->${source}`);
  }
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
    duration: 320,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(min: number, max: number, value: number): number {
  return min + (max - min) * value;
}
