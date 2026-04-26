import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeFcose from "cytoscape-fcose";
import type { DependencyRadarGraph, MonitorStatus } from "../api/types";
import type { GraphModel } from "../domain/graphModel";
import { applyNodeScale, applySelection, applySidebarHover, applyVisibility, buildElements, fitGraph, fitSelection, type FilterState, type LayoutId, runLayout } from "../graph/cytoscapeModel";
import { GRAPH_STYLE } from "../graph/graphStyle";

cytoscape.use(cytoscapeFcose);
cytoscape.use(cytoscapeDagre);

const SCREEN_FONT = 13;
const NODE_SCALE_BASELINE = 1.75;

function scaleFonts(cy: cytoscape.Core) {
  const z = cy.zoom();
  cy.batch(() => {
    cy.nodes(":not(.n-repo)").style("font-size", SCREEN_FONT / z);
  });
}

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
  searchText: string;
  status: MonitorStatus | null;
  nodeScale: number;
  leftInset?: number;
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
  searchText: _searchText,
  status,
  nodeScale,
  leftInset = 0,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const modelRef = useRef<GraphModel | null>(model);
  const lastSelectionFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    if (!graph || !containerRef.current) return undefined;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(graph, groupByRepo),
      wheelSensitivity: 0.18,
      style: GRAPH_STYLE,
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
    cy.on("zoom", () => scaleFonts(cy));
    applyVisibility(cy, filterState);
    applyNodeScale(cy, nodeScale * NODE_SCALE_BASELINE);
    runLayout(cy, layout);
    scaleFonts(cy);
    applySelection(cy, model, selectionId);
    applySidebarHover(cy, model, hoverPathIds);
    fitSelectionOnce(cy, model, selectionId, leftInset, lastSelectionFitKeyRef);

    return () => {
      cy.destroy();
      cyRef.current = null;
      lastSelectionFitKeyRef.current = null;
    };
  }, [graph, groupByRepo]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyVisibility(cy, filterState);
    runLayout(cy, layout);
    scaleFonts(cy);
    applySelection(cy, model, selectionId);
    applySidebarHover(cy, model, hoverPathIds);
    lastSelectionFitKeyRef.current = null;
    fitSelectionOnce(cy, model, selectionId, leftInset, lastSelectionFitKeyRef);
  }, [filterState, layout, layoutRunKey, graph, groupByRepo]);

  useEffect(() => {
    applyNodeScale(cyRef.current, nodeScale * NODE_SCALE_BASELINE);
  }, [nodeScale]);

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
    if (viewportResetKey === 0) return;
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

  const fitKey = `${selectionId}:${leftInset}`;
  if (lastFitKeyRef.current === fitKey) return;

  lastFitKeyRef.current = fitKey;
  fitSelection(cy, model, selectionId, leftInset);
}
