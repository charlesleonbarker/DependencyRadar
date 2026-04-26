import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DependencyRadarGraph, GraphSummary, MonitorStatus, ProjectKind } from "./api/types";
import { apiUrl, fetchGraph, fetchStatus } from "./api/client";
import { BottomControls } from "./components/BottomControls";
import { GraphCanvas } from "./components/GraphCanvas";
import { HelpContent } from "./components/HelpContent";
import { Modal } from "./components/Modal";
import { SearchFilterDock } from "./components/SearchFilterDock";
import { SelectionPopover } from "./components/SelectionPopover";
import { buildModel, describeSelection, type GraphModel } from "./domain/graphModel";
import { DEFAULT_KINDS } from "./domain/projectKinds";
import type { FilterState, LayoutId } from "./graph/cytoscapeModel";

const defaultKindFilters = Object.fromEntries(DEFAULT_KINDS.map((kind) => [kind, true])) as Record<ProjectKind, boolean>;

function selectionUrl(selectionId: string | null, model: GraphModel | null): string {
  const url = new URL(window.location.href);
  const node = selectionId ? model?.nodesById[selectionId] : null;
  if (selectionId) url.searchParams.set("node", node?.name ?? selectionId);
  else url.searchParams.delete("node");
  return `${url.pathname}${url.search}${url.hash}`;
}

function selectionFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("node");
}

function resolveSelectionFromUrlValue(model: GraphModel, value: string): string | null {
  if (model.nodesById[value]) return value;
  const lower = value.toLowerCase();
  const match = Object.values(model.nodesById).find((node) => node.name.toLowerCase() === lower);
  return match?.id ?? null;
}

export function App() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [graph, setGraph] = useState<DependencyRadarGraph | null>(null);
  const [error, setError] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [hoverPathIds, setHoverPathIds] = useState<string[][] | null>(null);
  const [layout, setLayout] = useState<LayoutId>("dagre");
  const [layoutRunKey, setLayoutRunKey] = useState(0);
  const [nodeScale, setNodeScale] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [kindFilters, setKindFilters] = useState(defaultKindFilters);
  const [repoFilters, setRepoFilters] = useState<Record<string, boolean>>({});
  const [showPackages, setShowPackages] = useState(false);
  const [viewportResetKey, setViewportResetKey] = useState(0);
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

  const setSelectionFromHistory = useCallback((id: string | null) => {
    setSelectionId(id);
  }, []);

  const replaceSelectionHistory = useCallback((id: string | null) => {
    window.history.replaceState({ selectionId: id }, "", selectionUrl(id, model));
  }, [model]);

  const selectNode = useCallback((id: string | null) => {
    setSelectionId(id);
    const nextUrl = selectionUrl(id, model);
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState({ selectionId: id }, "", nextUrl);
    }
  }, [model]);
  const closeSelection = useCallback(() => {
    selectNode(null);
    setHoverPathIds(null);
    setViewportResetKey((key) => key + 1);
  }, [selectNode]);

  const chooseLayout = useCallback((nextLayout: LayoutId) => {
    setLayout(nextLayout);
    setLayoutRunKey((key) => key + 1);
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
      const resolvedId = resolveSelectionFromUrlValue(model, selectionId);
      setSelectionId(resolvedId);
      if (historyReady.current) replaceSelectionHistory(resolvedId);
    }
  }, [model, replaceSelectionHistory, selectionId]);

  useEffect(() => {
    if (selectionId && model?.nodesById[selectionId]?.type === "package" && !model.collapsedPackageTargets[selectionId]) {
      setShowPackages(true);
    }
  }, [model, selectionId]);

  useEffect(() => {
    if (!graph) return;
    setRepoFilters((current) => {
      const next = Object.fromEntries(graph.repos.map((repo) => [repo.id, current[repo.id] !== false]));
      return next;
    });
  }, [graph]);

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
  const filterState: FilterState = useMemo(() => ({ kindFilters, repoFilters, showExternal: showPackages }), [kindFilters, repoFilters, showPackages]);

  return (
    <>
      <div className="app-shell">
        <div className="left-workspace">
          <SearchFilterDock
            searchText={searchText}
            setSearchText={setSearchText}
            suggestions={model?.suggestions || []}
            repos={graph?.repos || []}
            compactRepoFilter={Boolean(selection)}
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
            repoFilters={repoFilters}
            setRepoFilters={setRepoFilters}
            showPackages={showPackages}
            setShowPackages={setShowPackages}
          />
          <SelectionPopover
            selection={selection}
            showExternal={showPackages}
            onClose={closeSelection}
            onSelect={selectNode}
            onHoverPath={setHoverPathIds}
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
                hoverPathIds={hoverPathIds}
                viewportResetKey={viewportResetKey}
                onSelectionChange={selectNode}
                layout={layout}
                layoutRunKey={layoutRunKey}
                groupByRepo
                filterState={filterState}
                searchText={searchText}
                status={status}
                nodeScale={nodeScale}
                leftInset={selection ? 560 : 0}
              />
            </div>

            <BottomControls layout={layout} nodeScale={nodeScale} setLayout={chooseLayout} setNodeScale={setNodeScale} />
            {error ? <div className="map-status map-status-error"><strong>Frontend error</strong><span>{error}</span></div> : null}
          </div>
        </main>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} eyebrow="Dependency Radar" title=".NET Impact Visualiser">
        <HelpContent status={status} counts={counts} />
      </Modal>
    </>
  );
}
