import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeFcose from "cytoscape-fcose";
import type { DepmapGraph, MonitorStatus } from "../api/types";
import type { GraphModel } from "../domain/graphModel";
import { applySelection, applyVisibility, buildElements, fitSelection, type FilterState, type LayoutId, runLayout } from "../graph/cytoscapeModel";
import { GRAPH_STYLE } from "../graph/graphStyle";

cytoscape.use(cytoscapeFcose);
cytoscape.use(cytoscapeDagre);

const SCREEN_FONT = 13;

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
  onSelectionChange(selectionId: string | null): void;
  layout: LayoutId;
  groupByRepo: boolean;
  filterState: FilterState;
  searchText: string;
  status: MonitorStatus | null;
  leftInset?: number;
}

export function GraphCanvas({
  graph,
  model,
  selectionId,
  onSelectionChange,
  layout,
  groupByRepo,
  filterState,
  searchText: _searchText,
  status,
  leftInset = 0,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

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
      if (target.hasClass("n-repo")) return;
      onSelectionChange(target.id());
    });
    cy.on("tap", (event) => {
      if (event.target === cy) onSelectionChange(null);
    });

    cy.edges().unselectify();
    cy.nodes(".n-repo").unselectify();
    cyRef.current = cy;
    cy.on("zoom", () => scaleFonts(cy));
    applyVisibility(cy, filterState);
    runLayout(cy, layout);
    scaleFonts(cy);
    applySelection(cy, model, selectionId);
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
    fitSelection(cy, model, selectionId, leftInset);
  }, [filterState, layout, graph, groupByRepo]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applySelection(cy, model, selectionId);
    fitSelection(cy, model, selectionId, leftInset);
  }, [model, selectionId, leftInset]);

  if (!graph) {
    return (
      <div className="empty-state">
        <div className="empty-card">
          <h2>Waiting for the first graph</h2>
          <p>{status?.lastError ? `The monitor is in error: ${status.lastError}` : "Configure service roots, let the first scan complete, and the map will appear here."}</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="graph-surface" />;
}
