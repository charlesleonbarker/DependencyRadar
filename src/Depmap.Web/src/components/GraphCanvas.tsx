import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import cytoscapeDagre from "cytoscape-dagre";
import cytoscapeFcose from "cytoscape-fcose";
import type { DepmapGraph, MonitorStatus } from "../api/types";
import type { GraphModel } from "../domain/graphModel";
import { applySelection, applyVisibility, buildElements, type FilterState, type LayoutId, runLayout } from "../graph/cytoscapeModel";
import { GRAPH_STYLE } from "../graph/graphStyle";

cytoscape.use(cytoscapeFcose);
cytoscape.use(cytoscapeDagre);

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
}

export function GraphCanvas({
  graph,
  model,
  selectionId,
  onSelectionChange,
  layout,
  groupByRepo,
  filterState,
  searchText,
  status,
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
    applyVisibility(cy, filterState, searchText);
    runLayout(cy, layout);
    applySelection(cy, model, selectionId);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph, groupByRepo]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyVisibility(cy, filterState, searchText);
    runLayout(cy, layout);
    if (selectionId) applySelection(cy, model, selectionId);
  }, [filterState, layout, model, selectionId, searchText]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applySelection(cy, model, selectionId);
  }, [model, selectionId]);

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
