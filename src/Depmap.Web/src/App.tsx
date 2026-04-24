import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { DepmapGraph, GraphSummary, MonitorStatus, ProjectKind } from "./api/types";
import { apiUrl, fetchGraph, fetchStatus, requestRescan } from "./api/client";
import { BottomControls } from "./components/BottomControls";
import { GraphCanvas } from "./components/GraphCanvas";
import { HelpContent } from "./components/HelpContent";
import { Modal } from "./components/Modal";
import { SearchFilterDock } from "./components/SearchFilterDock";
import { SelectionPopover } from "./components/SelectionPopover";
import { buildModel, describeSelection } from "./domain/graphModel";
import { DEFAULT_KINDS } from "./domain/projectKinds";
import type { FilterState, LayoutId } from "./graph/cytoscapeModel";

const defaultKindFilters = Object.fromEntries(DEFAULT_KINDS.map((kind) => [kind, true])) as Record<ProjectKind, boolean>;

export function App() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [graph, setGraph] = useState<DepmapGraph | null>(null);
  const [error, setError] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutId>("dagre");
  const [showExternal, setShowExternal] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [kindFilters, setKindFilters] = useState(defaultKindFilters);

  const model = useMemo(() => (graph ? buildModel(graph) : null), [graph]);
  const selection = useMemo(() => (model ? describeSelection(model, selectionId) : null), [model, selectionId]);

  const syncFromBackend = useCallback(async () => {
    const nextStatus = await fetchStatus();
    startTransition(() => setStatus(nextStatus));

    if (nextStatus.state === "ready") {
      const nextGraph = await fetchGraph();
      if (nextGraph) startTransition(() => setGraph(nextGraph));
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      await syncFromBackend();
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }, [syncFromBackend]);

  const rescan = useCallback(async () => {
    setRescanning(true);
    try {
      await requestRescan();
      await syncFromBackend();
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRescanning(false);
    }
  }, [syncFromBackend]);

  const selectNode = useCallback((id: string | null) => {
    setSelectionId(id);
  }, []);

  useEffect(() => {
    if (selectionId && model && !model.nodesById[selectionId]) setSelectionId(null);
  }, [model, selectionId]);

  useEffect(() => {
    refresh();
    const source = new EventSource(apiUrl("/api/updates"));
    source.addEventListener("status", () => {
      syncFromBackend().catch((nextError) => setError(nextError instanceof Error ? nextError.message : String(nextError)));
    });
    return () => source.close();
  }, [refresh, syncFromBackend]);

  const counts: GraphSummary = status?.summary || {
    repoCount: graph?.repos.length || 0,
    solutionCount: graph?.solutions.length || 0,
    projectCount: graph?.projects.length || 0,
    packageCount: graph?.packages.length || 0,
    edgeCount: graph?.edges.length || 0,
  };
  const filterState: FilterState = { kindFilters, showExternal };

  return (
    <>
      <div className="app-shell">
        <div className="app-title">.NET Dependency Map</div>
        <SearchFilterDock
          searchText={searchText}
          setSearchText={setSearchText}
          suggestions={model?.suggestions || []}
          onSuggestionSelect={(id) => {
            selectNode(id);
            setFilterOpen(false);
          }}
          filterOpen={filterOpen}
          setFilterOpen={setFilterOpen}
          kindFilters={kindFilters}
          setKindFilters={setKindFilters}
          showExternal={showExternal}
          setShowExternal={setShowExternal}
        />

        <main className="canvas">
          <div className="canvas-inner">
            <div className="canvas-stage">
              <GraphCanvas
                graph={graph}
                model={model}
                selectionId={selectionId}
                onSelectionChange={selectNode}
                layout={layout}
                groupByRepo
                filterState={filterState}
                searchText={searchText}
                status={status}
              />
            </div>

            <BottomControls layout={layout} setLayout={setLayout} onHelp={() => setHelpOpen(true)} />
            {error ? <div className="map-status map-status-error"><strong>Frontend error</strong><span>{error}</span></div> : null}
            <SelectionPopover
              selection={selection}
              onClose={() => setSelectionId(null)}
              onSelect={selectNode}
            />
          </div>
        </main>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} eyebrow="Help" title="How to read .NET Dependency Map">
        <HelpContent status={status} counts={counts} onRescan={rescan} rescanning={rescanning} />
      </Modal>
    </>
  );
}
