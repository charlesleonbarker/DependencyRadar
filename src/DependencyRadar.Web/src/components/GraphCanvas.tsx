import { useEffect, useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeFcose from "cytoscape-fcose";
import type { DependencyRadarGraph, MonitorStatus } from "../api/types";
import type { GraphModel } from "../domain/graphModel";
import { applyDensity, applyNodeScale, applySelection, applySidebarHover, applyVisibility, buildElements, fitGraph, fitSelection, restoreCompoundParents, type FilterState, type LayoutId, runLayout, type ViewOptions } from "../graph/cytoscapeModel";
import { graphStyleFromElement } from "../graph/graphStyle";

cytoscape.use(cytoscapeFcose);
cytoscape.use(cytoscapeDagre);

const NODE_SCALE_BASELINE = 1.75;

interface GraphCanvasProps {
  graph: DependencyRadarGraph | null;
  model: GraphModel | null;
  selectionId: string | null;
  hoverPathIds: string[][] | null;
  viewportResetKey: number;
  onSelectionChange(selectionId: string | null): void;
  layout: LayoutId;
  layoutRunKey: number;
  groupByRepo: boolean;
  filterState: FilterState;
  viewOptions: ViewOptions;
  searchText: string;
  status: MonitorStatus | null;
  leftInset?: number;
  styleKey?: string;
}

export function GraphCanvas({
  graph,
  model,
  selectionId,
  hoverPathIds,
  viewportResetKey,
  onSelectionChange,
  layout,
  layoutRunKey,
  groupByRepo,
  filterState,
  viewOptions,
  searchText: _searchText,
  status,
  leftInset = 0,
  styleKey,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const modelRef = useRef<GraphModel | null>(model);
  const lastSelectionFitKeyRef = useRef<string | null>(null);
  const lastDensityRef = useRef(viewOptions.density);
  const lastViewportResetKeyRef = useRef(0);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    if (!graph || !containerRef.current) return undefined;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(graph, groupByRepo),
      wheelSensitivity: 0.35,
      style: graphStyleFromElement(containerRef.current),
      layout: { name: "grid" },
    });

    cy.on("tap", "node", (event) => {
      const target = event.target;
      onSelectionChange(target.id());
    });
    cy.on("tap", (event) => {
      if (event.target === cy) onSelectionChange(null);
    });
    cy.edges().unselectify();
    cyRef.current = cy;
    applyVisibility(cy, filterState);
    applyNodeScale(cy, NODE_SCALE_BASELINE);
    runLayout(cy, layout, viewOptions);
    applySelection(cy, model, selectionId);
    applySidebarHover(cy, model, hoverPathIds);
    fitSelectionOnce(cy, model, selectionId, leftInset, lastSelectionFitKeyRef);
    lastDensityRef.current = viewOptions.density;

    return () => {
      cy.destroy();
      cyRef.current = null;
      lastSelectionFitKeyRef.current = null;
      lastDensityRef.current = viewOptions.density;
    };
  }, [graph, groupByRepo]);

  useLayoutEffect(() => {
    const cy = cyRef.current;
    if (!cy || !containerRef.current) return;

    cy.style(graphStyleFromElement(containerRef.current)).update();
    applySelection(cy, model, selectionId);
    applySidebarHover(cy, model, hoverPathIds);
  }, [styleKey, model, selectionId, hoverPathIds]);

  useEffect(() => {
    const previousDensity = lastDensityRef.current;
    const nextDensity = viewOptions.density;
    applyDensity(cyRef.current, previousDensity, nextDensity);
    lastDensityRef.current = nextDensity;
  }, [viewOptions.density]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    restoreCompoundParents(cy);
    applyVisibility(cy, filterState);
    runLayout(cy, layout, viewOptions);
    applySelection(cy, model, selectionId);
    applySidebarHover(cy, model, hoverPathIds);
    lastSelectionFitKeyRef.current = null;
    fitSelectionOnce(cy, model, selectionId, leftInset, lastSelectionFitKeyRef);
    lastDensityRef.current = viewOptions.density;
  }, [filterState, layout, layoutRunKey, graph, groupByRepo]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applySelection(cy, model, selectionId);
    fitSelectionOnce(cy, model, selectionId, leftInset, lastSelectionFitKeyRef);
  }, [model, selectionId, leftInset]);

  useEffect(() => {
    applySidebarHover(cyRef.current, model, hoverPathIds);
  }, [model, hoverPathIds]);

  useEffect(() => {
    if (viewportResetKey === 0 || viewportResetKey === lastViewportResetKeyRef.current) return;
    lastViewportResetKeyRef.current = viewportResetKey;
    lastSelectionFitKeyRef.current = null;
    fitGraph(cyRef.current, leftInset);
  }, [viewportResetKey, leftInset]);

  if (!graph) {
    return (
      <div className="empty-state">
        <div className="empty-card">
          <h2>Loading dependency graph</h2>
          <p>{status?.lastError ? `The monitor is in error: ${status.lastError}` : "Scanning repositories and preparing the map."}</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="graph-surface" />;
}

function fitSelectionOnce(
  cy: cytoscape.Core | null,
  model: GraphModel | null,
  selectionId: string | null,
  leftInset: number,
  lastFitKeyRef: MutableRefObject<string | null>,
): void {
  if (!selectionId) {
    lastFitKeyRef.current = null;
    return;
  }

  if (leftInset === 0) return;

  const fitKey = `${selectionId}:${leftInset}`;
  if (lastFitKeyRef.current === fitKey) return;

  lastFitKeyRef.current = fitKey;
  fitSelection(cy, model, selectionId, leftInset);
}
