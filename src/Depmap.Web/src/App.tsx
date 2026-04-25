import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function selectionUrl(selectionId: string | null): string {
  const url = new URL(window.location.href);
  if (selectionId) url.searchParams.set("node", selectionId);
  else url.searchParams.delete("node");
  return `${url.pathname}${url.search}${url.hash}`;
}

function selectionFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("node");
}

export function App() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [graph, setGraph] = useState<DepmapGraph | null>(null);
  const [error, setError] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutId>("dagre");
  const [searchText, setSearchText] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [kindFilters, setKindFilters] = useState(defaultKindFilters);
  const [showPackages, setShowPackages] = useState(false);
  const historyReady = useRef(false);

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

  const setSelectionFromHistory = useCallback((id: string | null) => {
    setSelectionId(id);
  }, []);

  const replaceSelectionHistory = useCallback((id: string | null) => {
    window.history.replaceState({ selectionId: id }, "", selectionUrl(id));
  }, []);

  const selectNode = useCallback((id: string | null) => {
    setSelectionId(id);
    const nextUrl = selectionUrl(id);
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState({ selectionId: id }, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    const initialSelectionId = selectionFromUrl();
    setSelectionFromHistory(initialSelectionId);
    replaceSelectionHistory(initialSelectionId);
    historyReady.current = true;

    const handlePopState = (event: PopStateEvent) => {
      const nextSelectionId = typeof event.state?.selectionId === "string" ? event.state.selectionId : selectionFromUrl();
      setSelectionFromHistory(nextSelectionId);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [replaceSelectionHistory, setSelectionFromHistory]);

  useEffect(() => {
    if (selectionId && model && !model.nodesById[selectionId]) {
      setSelectionId(null);
      if (historyReady.current) replaceSelectionHistory(null);
    }
  }, [model, replaceSelectionHistory, selectionId]);

  useEffect(() => {
    if (selectionId && model?.nodesById[selectionId]?.type === "package" && !model.collapsedPackageTargets[selectionId]) {
      setShowPackages(true);
    }
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
  const filterState: FilterState = useMemo(() => ({ kindFilters, showExternal: showPackages }), [kindFilters, showPackages]);

  return (
    <>
      <div className="app-shell">
        <div className="left-workspace">
          <SearchFilterDock
            searchText={searchText}
            setSearchText={setSearchText}
            suggestions={model?.suggestions || []}
            onSuggestionSelect={(id) => {
              if (model?.nodesById[id]?.type === "package" && !model.collapsedPackageTargets[id]) {
                setShowPackages(true);
              }
              selectNode(id);
              setFilterOpen(false);
            }}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            kindFilters={kindFilters}
            setKindFilters={setKindFilters}
            showPackages={showPackages}
            setShowPackages={setShowPackages}
          />
          <SelectionPopover
            selection={selection}
            onClose={() => selectNode(null)}
            onSelect={selectNode}
          />
        </div>

        <main className="canvas">
          <div className="canvas-inner">
            <div className="top-info-dock">
              <button className="ghost-button top-info-button" type="button" title="Help, key, monitor, and license information" onClick={() => setHelpOpen(true)}>
                Info
              </button>
            </div>
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
                leftInset={selection ? 560 : 0}
              />
            </div>

            <BottomControls layout={layout} setLayout={setLayout} />
            {error ? <div className="map-status map-status-error"><strong>Frontend error</strong><span>{error}</span></div> : null}
          </div>
        </main>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} eyebrow="Dependency Radar" title=".NET Impact Radar">
        <HelpContent status={status} counts={counts} onRescan={rescan} rescanning={rescanning} />
      </Modal>
    </>
  );
}
