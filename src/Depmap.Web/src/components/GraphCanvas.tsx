import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeFcose from "cytoscape-fcose";
import type { DepmapGraph, MonitorStatus } from "../api/types";
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
  graph: DepmapGraph | null;
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
  const [edgeTooltip, setEdgeTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

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
    cy.on("mouseover", "edge", (event) => {
      const text = edgeTooltipText(event.target, modelRef.current);
      if (!text) return;
      setEdgeTooltip({
        x: event.renderedPosition.x,
        y: event.renderedPosition.y,
        text,
      });
    });
    cy.on("mousemove", "edge", (event) => {
      setEdgeTooltip((current) => current ? { ...current, x: event.renderedPosition.x, y: event.renderedPosition.y } : current);
    });
    cy.on("mouseout", "edge", () => setEdgeTooltip(null));

    cy.edges().unselectify();
    cyRef.current = cy;
    cy.on("zoom", () => scaleFonts(cy));
    applyVisibility(cy, filterState);
    applyNodeScale(cy, nodeScale * NODE_SCALE_BASELINE);
    runLayout(cy, layout);
    scaleFonts(cy);
    applySelection(cy, model, selectionId);
    applySidebarHover(cy, model, hoverPathIds);
    fitSelection(cy, model, selectionId, leftInset);

    return () => {
      cy.destroy();
      cyRef.current = null;
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
    fitSelection(cy, model, selectionId, leftInset);
  }, [filterState, layout, layoutRunKey, graph, groupByRepo]);

  useEffect(() => {
    applyNodeScale(cyRef.current, nodeScale * NODE_SCALE_BASELINE);
  }, [nodeScale]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applySelection(cy, model, selectionId);
    fitSelection(cy, model, selectionId, leftInset);
  }, [model, selectionId, leftInset]);

  useEffect(() => {
    applySidebarHover(cyRef.current, model, hoverPathIds);
  }, [model, hoverPathIds]);

  useEffect(() => {
    if (viewportResetKey === 0) return;
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

  return (
    <>
      <div ref={containerRef} className="graph-surface" />
      {edgeTooltip ? (
        <div className="graph-tooltip" style={{ left: edgeTooltip.x, top: edgeTooltip.y }}>
          {edgeTooltip.text}
        </div>
      ) : null}
    </>
  );
}

function edgeTooltipText(edge: cytoscape.EdgeSingular, model: GraphModel | null): string {
  const kind = String(edge.data("kind") || "");
  const sourceName = model?.nodesById[edge.source().id()]?.name || edge.source().data("label") || "Source";
  const targetName = model?.nodesById[edge.target().id()]?.name || edge.target().data("label") || "Target";
  const version = String(edge.data("version") || "");

  if (kind === "producedBy") {
    return "This package is built by a project in your scanned repos, so package consumers are treated as downstream of that project.";
  }

  if (kind === "packageRef") {
    return `${sourceName} directly references package ${targetName}${version ? ` at ${version}` : ""}.`;
  }

  if (kind === "projectRef") {
    return `${sourceName} has a ProjectReference to ${targetName}.`;
  }

  return "";
}
