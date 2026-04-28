import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { DEFAULT_VIEW_OPTIONS, type FilterState, type LayoutId, type ViewOptions } from "./graph/cytoscapeModel";
import { ColorSchemeSelect } from "./components/ColorSchemeSelect";
import type { ColorSchemeId } from "./theme/colorSchemes";
import { readColorSchemeCookie, writeColorSchemeCookie } from "./theme/colorSchemes";

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
  const [layout, setLayout] = useState<LayoutId>("fcose");
  const [layoutRunKey, setLayoutRunKey] = useState(0);
  const [viewOptions, setViewOptions] = useState<ViewOptions>(DEFAULT_VIEW_OPTIONS);
  const [groupByRepo, setGroupByRepo] = useState(true);
  const [colorScheme, setColorSchemeState] = useState<ColorSchemeId>(() => readColorSchemeCookie());
  const [searchText, setSearchText] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [kindFilters, setKindFilters] = useState(defaultKindFilters);
  const [repoFilters, setRepoFilters] = useState<Record<string, boolean>>({});
  const [showPackages, setShowPackages] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [viewportResetKey, setViewportResetKey] = useState(0);
  const [selectionFitInset, setSelectionFitInset] = useState(0);
  const historyReady = useRef(false);

  const setColorScheme = useCallback((nextScheme: ColorSchemeId) => {
    setColorSchemeState(nextScheme);
    writeColorSchemeCookie(nextScheme);
  }, []);

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
    if (id && model?.nodesById[id]?.type === "repo") {
      setGroupByRepo(true);
    }
    setSelectionId(id);
    const nextUrl = selectionUrl(id, model);
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.pushState({ selectionId: id }, "", nextUrl);
    }
  }, [model]);
  const closeSelection = useCallback(() => {
    selectNode(null);
    setHoverPathIds(null);
    setFocusMode(false);
    setViewportResetKey((key) => key + 1);
    setSelectionFitInset(0);
  }, [selectNode]);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => !prev);
  }, []);

  const chooseLayout = useCallback((nextLayout: LayoutId) => {
    setLayout(nextLayout);
    setLayoutRunKey((key) => key + 1);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.colorScheme = colorScheme;
  }, [colorScheme]);

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
    if (!selection) {
      setSelectionFitInset(0);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSelectionFitInset(664), 320);
    return () => window.clearTimeout(timeoutId);
  }, [selection]);

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
  const focusIds = useMemo<Set<string> | null>(() => {
    if (!focusMode || !selectionId || !model) return null;
    const graphSelectionId = model.graphIdForSelection(selectionId);
    const ancestors = model.reverseReach(selectionId);
    const descendants = model.forwardReach(selectionId);
    return new Set([selectionId, graphSelectionId, ...model.neighborhood(selectionId), ...ancestors, ...descendants]);
  }, [focusMode, selectionId, model]);

  const filterState: FilterState = useMemo(
    () => ({ kindFilters, repoFilters, showExternal: showPackages, focusIds }),
    [kindFilters, repoFilters, showPackages, focusIds],
  );

  return (
    <>
      <div className="app-shell" data-color-scheme={colorScheme}>
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
            kindFilters={kindFilters}
            focusMode={focusMode}
            onClose={closeSelection}
            onFocusToggle={toggleFocusMode}
            onSelect={selectNode}
            onHoverPath={setHoverPathIds}
          />
        </div>

        <main className="canvas">
          <div className="canvas-inner">
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
                groupByRepo={groupByRepo}
                filterState={filterState}
                viewOptions={viewOptions}
                searchText={searchText}
                status={status}
                leftInset={selectionFitInset}
                styleKey={colorScheme}
              />
            </div>

            <BottomControls layout={layout} groupByRepo={groupByRepo} viewOptions={viewOptions} setLayout={chooseLayout} setGroupByRepo={setGroupByRepo} setViewOptions={setViewOptions} onHelpOpen={() => setHelpOpen(true)} />
            {error ? <div className="map-status map-status-error"><strong>Frontend error</strong><span>{error}</span></div> : null}
          </div>
        </main>
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        eyebrow="Dependency Radar"
        title=".NET Impact Visualiser"
        headerSlot={<ColorSchemeSelect value={colorScheme} onChange={setColorScheme} />}
      >
        <HelpContent status={status} counts={counts} />
      </Modal>
    </>
  );
}
