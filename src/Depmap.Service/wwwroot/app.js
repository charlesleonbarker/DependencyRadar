import React, { createElement as h, startTransition, useDeferredValue, useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import cytoscape from "https://esm.sh/cytoscape@3.28.1";
import cytoscapeFcose from "https://esm.sh/cytoscape-fcose@2.2.0";
import cytoscapeDagre from "https://esm.sh/cytoscape-dagre@2.5.0";

cytoscape.use(cytoscapeFcose);
cytoscape.use(cytoscapeDagre);

const DEFAULT_KINDS = ["library", "test", "web", "blazor", "service", "nuget-producing"];

const GRAPH_STYLE = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      color: "#2a1f16",
      "font-size": 11,
      "font-family": "Avenir Next, Trebuchet MS, Segoe UI, sans-serif",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 6,
      "background-color": "#c4b29b",
      width: 30,
      height: 30,
      "border-width": 1,
      "border-color": "rgba(53, 35, 19, 0.25)",
    },
  },
  {
    selector: ".n-repo",
    style: {
      shape: "round-rectangle",
      "background-opacity": 0.08,
      "background-color": "#b84d21",
      "border-style": "dashed",
      "text-valign": "top",
      "text-halign": "left",
      "font-size": 18,
      "font-family": "Iowan Old Style, Palatino Linotype, Book Antiqua, serif",
      color: "#5e331c",
      padding: "18px",
      "text-margin-x": 12,
      "text-margin-y": 12,
    },
  },
  {
    selector: ".n-project",
    style: {
      shape: "round-rectangle",
      "background-color": "#b9ac9d",
      width: 46,
      height: 30,
    },
  },
  { selector: ".kind-library", style: { "background-color": "#c1b2a0" } },
  { selector: ".kind-test", style: { "background-color": "#8f7ce0" } },
  { selector: ".kind-web", style: { "background-color": "#cc9630" } },
  { selector: ".kind-blazor", style: { "background-color": "#b95d87" } },
  { selector: ".kind-service", style: { "background-color": "#3d948b" } },
  {
    selector: ".kind-nuget-producing",
    style: {
      "border-color": "#596748",
      "border-width": 3,
    },
  },
  {
    selector: ".n-package",
    style: {
      shape: "diamond",
      width: 28,
      height: 28,
    },
  },
  { selector: ".pkg-internal", style: { "background-color": "#596748", color: "#20311a" } },
  { selector: ".pkg-unknown", style: { "background-color": "#907f6e", opacity: 0.84 } },
  { selector: ".pkg-external", style: { "background-color": "#907f6e", opacity: 0.84 } },
  {
    selector: "edge",
    style: {
      width: 1.3,
      "line-color": "rgba(70, 51, 31, 0.28)",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "rgba(70, 51, 31, 0.28)",
      "curve-style": "bezier",
      "arrow-scale": 0.8,
    },
  },
  {
    selector: ".e-projectRef",
    style: {
      "line-color": "#1f756d",
      "target-arrow-color": "#1f756d",
    },
  },
  {
    selector: ".e-packageRef",
    style: {
      "line-color": "#b84d21",
      "target-arrow-color": "#b84d21",
    },
  },
  {
    selector: ".e-packageRefTransitive",
    style: {
      "line-color": "#947a5d",
      "target-arrow-color": "#947a5d",
      "line-style": "dashed",
    },
  },
  {
    selector: ".e-producedBy",
    style: {
      "line-color": "#596748",
      "target-arrow-color": "#596748",
      "line-style": "dotted",
    },
  },
  { selector: ".dim", style: { opacity: 0.12 } },
  { selector: ".soft-dim", style: { opacity: 0.24 } },
  { selector: ".hilite", style: { opacity: 1 } },
  {
    selector: ".ancestor",
    style: {
      "border-color": "#b84d21",
      "border-width": 4,
    },
  },
  {
    selector: ".descendant",
    style: {
      "border-color": "#1f756d",
      "border-width": 4,
    },
  },
  {
    selector: ":selected",
    style: {
      "border-color": "#221d16",
      "border-width": 4,
    },
  },
];

function buildModel(graph) {
  const nodesById = Object.create(null);
  const reposById = Object.create(null);
  const projectsById = Object.create(null);
  const packagesById = Object.create(null);
  const reverseAdj = Object.create(null);
  const forwardAdj = Object.create(null);

  graph.repos.forEach((repo) => {
    reposById[repo.id] = repo;
    nodesById[repo.id] = { ...repo, type: "repo" };
  });
  graph.solutions.forEach((solution) => {
    nodesById[solution.id] = { ...solution, type: "solution" };
  });
  graph.projects.forEach((project) => {
    projectsById[project.id] = project;
    nodesById[project.id] = { ...project, type: "project" };
  });
  graph.packages.forEach((pkg) => {
    packagesById[pkg.id] = pkg;
    nodesById[pkg.id] = { ...pkg, type: "package" };
  });

  graph.edges.forEach((edge) => {
    (reverseAdj[edge.to] = reverseAdj[edge.to] || []).push(edge);
    (forwardAdj[edge.from] = forwardAdj[edge.from] || []).push(edge);
  });

  function walk(startId, adjacency, nextKey) {
    const seen = Object.create(null);
    const queue = [startId];
    seen[startId] = true;

    while (queue.length > 0) {
      const current = queue.shift();
      const edges = adjacency[current] || [];
      for (const edge of edges) {
        const next = edge[nextKey];
        if (!seen[next]) {
          seen[next] = true;
          queue.push(next);
        }
      }
    }

    delete seen[startId];
    return Object.keys(seen);
  }

  return {
    graph,
    nodesById,
    reposById,
    projectsById,
    packagesById,
    reverseReach(startId) {
      return walk(startId, reverseAdj, "from");
    },
    forwardReach(startId) {
      return walk(startId, forwardAdj, "to");
    },
  };
}

function groupProjectsByRepo(projects, reposById) {
  const groups = new Map();
  for (const project of projects) {
    const repoName = reposById[project.repo]?.name || "Unknown repo";
    if (!groups.has(repoName)) {
      groups.set(repoName, []);
    }
    groups.get(repoName).push(project);
  }

  return Array.from(groups.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([repoName, repoProjects]) => ({
      repoName,
      projects: repoProjects.sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

function describeSelection(model, selectionId) {
  if (!selectionId) {
    return null;
  }

  const node = model.nodesById[selectionId];
  if (!node) {
    return null;
  }

  const ancestors = model.reverseReach(selectionId);
  const descendants = model.forwardReach(selectionId);
  const impactedProjects = ancestors
    .map((id) => model.projectsById[id])
    .filter(Boolean);

  const tests = impactedProjects.filter((project) => (project.kinds || []).includes("test"));
  const deployables = impactedProjects.filter((project) => {
    const kinds = project.kinds || [];
    return kinds.includes("web") || kinds.includes("service");
  });

  return {
    node,
    ancestors,
    descendants,
    tests: groupProjectsByRepo(tests, model.reposById),
    deployables: groupProjectsByRepo(deployables, model.reposById),
  };
}

function formatDate(value) {
  if (!value) {
    return "Not yet scanned";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function buildElements(graph, groupByRepo) {
  const elements = [];

  if (groupByRepo) {
    graph.repos.forEach((repo) => {
      elements.push({
        data: {
          id: repo.id,
          label: repo.name,
        },
        classes: "n-repo",
      });
    });
  }

  graph.projects.forEach((project) => {
    const kinds = project.kinds && project.kinds.length > 0 ? project.kinds : ["library"];
    elements.push({
      data: {
        id: project.id,
        label: project.name,
        type: "project",
        kinds: kinds.join(" "),
        repo: project.repo,
        parent: groupByRepo ? project.repo : undefined,
      },
      classes: ["n-project"].concat(kinds.map((kind) => `kind-${kind}`)).join(" "),
    });
  });

  graph.packages.forEach((pkg) => {
    elements.push({
      data: {
        id: pkg.id,
        label: pkg.name,
        type: "package",
        classification: pkg.classification,
      },
      classes: `n-package pkg-${pkg.classification}`,
    });
  });

  graph.edges.forEach((edge, index) => {
    if (edge.kind === "solutionContains") {
      return;
    }

    elements.push({
      data: {
        id: `e${index}`,
        source: edge.from,
        target: edge.to,
        kind: edge.kind,
      },
      classes: `e-${edge.kind}`,
    });
  });

  return elements;
}

function runLayout(cy, layout) {
  if (!cy) {
    return;
  }

  let config;
  if (layout === "fcose") {
    config = {
      name: "fcose",
      animate: false,
      nodeRepulsion: 6200,
      idealEdgeLength: 110,
      packComponents: true,
      gravity: 0.16,
    };
  } else if (layout === "dagre") {
    config = {
      name: "dagre",
      rankDir: "LR",
      nodeSep: 26,
      rankSep: 80,
      edgeSep: 18,
    };
  } else {
    config = {
      name: "concentric",
      animate: false,
      concentric(node) {
        return node.degree();
      },
      levelWidth() {
        return 2;
      },
    };
  }

  cy.layout(config).run();
}

function applyFilters(cy, filterState, searchText) {
  if (!cy) {
    return;
  }

  const { kindFilters, showExternal, showTransitive } = filterState;
  const query = searchText.trim().toLowerCase();

  cy.batch(() => {
    cy.nodes().forEach((node) => {
      const type = node.data("type");
      let visible = true;

      if (type === "project") {
        const kinds = (node.data("kinds") || "").split(/\s+/).filter(Boolean);
        const effectiveKinds = kinds.length > 0 ? kinds : ["library"];
        visible = effectiveKinds.some((kind) => kindFilters[kind] !== false);
      } else if (type === "package") {
        const classification = node.data("classification");
        if ((classification === "external" || classification === "unknown") && !showExternal) {
          visible = false;
        }
      }

      node.style("display", visible ? "element" : "none");
      node.removeClass("soft-dim");
      if (visible && query) {
        const label = String(node.data("label") || "").toLowerCase();
        if (!label.includes(query)) {
          node.addClass("soft-dim");
        }
      }
    });

    cy.edges().forEach((edge) => {
      let visible = true;
      if (edge.data("kind") === "packageRefTransitive" && !showTransitive) {
        visible = false;
      }

      if (edge.source().style("display") === "none" || edge.target().style("display") === "none") {
        visible = false;
      }

      edge.style("display", visible ? "element" : "none");
    });
  });
}

function applySelection(cy, model, selectionId) {
  if (!cy) {
    return;
  }

  cy.elements().removeClass("dim hilite ancestor descendant");
  cy.elements().unselect();

  if (!selectionId || !model?.nodesById[selectionId]) {
    return;
  }

  const ancestors = model.reverseReach(selectionId);
  const descendants = model.forwardReach(selectionId);
  const keep = new Set([selectionId, ...ancestors, ...descendants]);

  cy.nodes().forEach((node) => {
    if (keep.has(node.id())) {
      node.addClass("hilite");
    } else {
      node.addClass("dim");
    }
  });

  cy.edges().forEach((edge) => {
    if (keep.has(edge.source().id()) && keep.has(edge.target().id())) {
      edge.addClass("hilite");
    } else {
      edge.addClass("dim");
    }
  });

  ancestors.forEach((id) => {
    const node = cy.getElementById(id);
    if (node.nonempty()) {
      node.addClass("ancestor");
    }
  });

  descendants.forEach((id) => {
    const node = cy.getElementById(id);
    if (node.nonempty()) {
      node.addClass("descendant");
    }
  });

  const selectedNode = cy.getElementById(selectionId);
  if (selectedNode.nonempty()) {
    selectedNode.select();
    cy.animate(
      {
        center: { eles: selectedNode },
        zoom: Math.max(cy.zoom(), 0.9),
      },
      { duration: 220 },
    );
  }
}

function GraphCanvas({ graph, model, selectionId, onSelectionChange, layout, groupByRepo, filterState, searchText, status }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!graph || !containerRef.current) {
      return undefined;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(graph, groupByRepo),
      wheelSensitivity: 0.18,
      style: GRAPH_STYLE,
      layout: { name: "grid" },
    });

    cy.on("tap", "node", (event) => {
      const target = event.target;
      if (target.hasClass("n-repo")) {
        return;
      }

      onSelectionChange(target.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        onSelectionChange(null);
      }
    });

    cyRef.current = cy;
    runLayout(cy, layout);
    applyFilters(cy, filterState, searchText);
    applySelection(cy, model, selectionId);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph, groupByRepo]);

  useEffect(() => {
    runLayout(cyRef.current, layout);
  }, [layout]);

  useEffect(() => {
    applyFilters(cyRef.current, filterState, searchText);
  }, [filterState, searchText]);

  useEffect(() => {
    applySelection(cyRef.current, model, selectionId);
  }, [model, selectionId]);

  if (!graph) {
    return h(
      "div",
      { className: "empty-state" },
      h(
        "div",
        { className: "empty-card" },
        h("h2", null, "Waiting for the first graph"),
        h(
          "p",
          null,
          status?.lastError
            ? `The monitor is in error: ${status.lastError}`
            : "Configure service roots, let the first scan complete, and the graph will appear here.",
        ),
      ),
    );
  }

  return h(
    React.Fragment,
    null,
    h(
      "div",
      { className: "canvas-overlay" },
      h(
        "div",
        { className: "overlay-card" },
        h("p", { className: "overlay-title" }, "Live graph"),
        h(
          "p",
          { className: "overlay-body" },
          `${graph.repos.length} repos, ${graph.projects.length} projects, ${graph.packages.length} packages, ${graph.edges.length} edges`,
        ),
      ),
      h(
        "div",
        { className: "overlay-card" },
        h("p", { className: "overlay-title" }, "Last scan"),
        h("p", { className: "overlay-body" }, formatDate(graph.scannedAt)),
      ),
    ),
    h("div", { ref: containerRef, className: "graph-surface" }),
  );
}

function StatCard({ label, value }) {
  return h(
    "div",
    { className: "stat-card" },
    h("span", { className: "stat-label" }, label),
    h("span", { className: "stat-value" }, value),
  );
}

function Toggle({ checked, onChange, title, note }) {
  return h(
    "label",
    { className: "toggle" },
    h("input", { type: "checkbox", checked, onChange: (event) => onChange(event.target.checked) }),
    h(
      "span",
      { className: "toggle-copy" },
      h("span", { className: "toggle-title" }, title),
      note ? h("span", { className: "toggle-note" }, note) : null,
    ),
  );
}

function SelectionPanel({ selection, onJump }) {
  if (!selection) {
    return h(
      "section",
      { className: "panel" },
      h("h2", { className: "panel-title" }, "Selection"),
      h("p", { className: "muted" }, "Pick a project or package in the graph to inspect its blast radius."),
    );
  }

  const { node } = selection;
  const details = [];

  details.push(["Type", node.type]);
  details.push(["Name", node.name || node.label]);
  if (node.type === "project") {
    details.push(["SDK", node.sdk || "Unknown"]);
    details.push(["Kinds", (node.kinds || []).join(", ") || "library"]);
    details.push(["TFMs", (node.tfms || []).join(", ") || "Unknown"]);
    details.push(["Package ID", node.packageId || "Not packable"]);
    details.push(["Path", node.path || "Unknown"]);
  } else if (node.type === "package") {
    details.push(["Classification", node.classification || "unknown"]);
    details.push(["Versions", (node.versions || []).join(", ") || "Unknown"]);
    details.push(["Produced by", node.producedBy || "Not resolved"]);
  }

  return h(
    "section",
    { className: "panel" },
    h("h2", { className: "panel-title" }, "Selection"),
    node.type === "project"
      ? h(
          "div",
          { className: "pill-row" },
          (node.kinds && node.kinds.length > 0 ? node.kinds : ["library"]).map((kind) =>
            h("span", { key: kind, className: `pill ${kind}` }, kind),
          ),
        )
      : null,
    h(
      "div",
      { className: "details-grid" },
      details.map(([label, value]) =>
        h(
          "div",
          { className: "details-row", key: label },
          h("div", { className: "details-label" }, label),
          h("div", { className: "details-value" }, value),
        ),
      ),
    ),
    h(
      "div",
      { className: "button-row", style: { marginTop: "12px" } },
      h(
        "button",
        { className: "button", type: "button", onClick: () => onJump(node.id) },
        "Center on selection",
      ),
    ),
  );
}

function ImpactSection({ title, groups, onSelect }) {
  return h(
    "section",
    { className: "panel" },
    h("h2", { className: "panel-title" }, title),
    groups.length === 0
      ? h("p", { className: "muted" }, "No impacted projects in this category.")
      : h(
          "div",
          { className: "impact-group-list" },
          groups.map((group) =>
            h(
              "div",
              { key: group.repoName, className: "impact-group" },
              h(
                "div",
                { className: "impact-title" },
                h("span", null, group.repoName),
                h("span", { className: "pill" }, group.projects.length),
              ),
              h(
                "ul",
                { className: "impact-items" },
                group.projects.map((project) =>
                  h(
                    "li",
                    { key: project.id },
                    h(
                      "button",
                      {
                        className: "impact-link",
                        type: "button",
                        onClick: () => onSelect(project.id),
                      },
                      project.name,
                      h("small", null, project.path),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
  );
}

function App() {
  const [status, setStatus] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");
  const [selectionId, setSelectionId] = useState(null);
  const [layout, setLayout] = useState("fcose");
  const [groupByRepo, setGroupByRepo] = useState(true);
  const [showExternal, setShowExternal] = useState(true);
  const [showTransitive, setShowTransitive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionState, setConnectionState] = useState("connecting");
  const [searchText, setSearchText] = useState("");
  const [kindFilters, setKindFilters] = useState(() =>
    Object.fromEntries(DEFAULT_KINDS.map((kind) => [kind, true])),
  );

  const deferredSearchText = useDeferredValue(searchText);
  const model = graph ? buildModel(graph) : null;
  const selection = model ? describeSelection(model, selectionId) : null;

  useEffect(() => {
    if (selectionId && model && !model.nodesById[selectionId]) {
      setSelectionId(null);
    }
  }, [model, selectionId]);

  async function fetchStatus() {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Status request failed with ${response.status}`);
    }

    return response.json();
  }

  async function fetchGraph() {
    const response = await fetch("/api/graph", { cache: "no-store" });
    if (!response.ok) {
      if (response.status === 503) {
        return null;
      }

      throw new Error(`Graph request failed with ${response.status}`);
    }

    return response.json();
  }

  async function refresh() {
    setIsRefreshing(true);
    try {
      const nextStatus = await fetchStatus();
      startTransition(() => setStatus(nextStatus));

      if (nextStatus.state === "ready") {
        const nextGraph = await fetchGraph();
        if (nextGraph) {
          startTransition(() => setGraph(nextGraph));
        }
      }

      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    refresh();

    const source = new EventSource("/api/updates");
    source.addEventListener("status", async (event) => {
      try {
        const nextStatus = JSON.parse(event.data);
        setConnectionState("live");
        startTransition(() => setStatus(nextStatus));

        if (nextStatus.state === "ready") {
          const nextGraph = await fetchGraph();
          if (nextGraph) {
            startTransition(() => setGraph(nextGraph));
          }
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    });

    source.onerror = () => {
      setConnectionState("reconnecting");
    };

    source.onopen = () => {
      setConnectionState("live");
    };

    return () => {
      source.close();
    };
  }, []);

  const counts = status?.summary || {
    repoCount: graph?.repos.length || 0,
    solutionCount: graph?.solutions.length || 0,
    projectCount: graph?.projects.length || 0,
    packageCount: graph?.packages.length || 0,
    edgeCount: graph?.edges.length || 0,
  };

  const filterState = { kindFilters, showExternal, showTransitive };

  return h(
    "div",
    { className: "app-shell" },
    h(
      "aside",
      { className: "sidebar" },
      h(
        "header",
        { className: "hero" },
        h("p", { className: "eyebrow" }, "Always-on dependency intelligence"),
        h("h1", { className: "title" }, "Depmap Live"),
        h(
          "p",
          { className: "subtitle" },
          "Watch repository roots, rescan on change, and keep impact analysis live in the browser.",
        ),
      ),
      h(
        "section",
        { className: "panel" },
        h("h2", { className: "panel-title" }, "Monitor"),
        h(
          "div",
          { className: "status-strip" },
          h(
            "div",
            { className: "status-topline" },
            h("span", { className: `status-chip ${status?.state || "idle"}` }, status?.state || "idle"),
            h(
              "button",
              { className: "button", type: "button", onClick: refresh, disabled: isRefreshing },
              isRefreshing ? "Refreshing..." : "Refresh now",
            ),
          ),
          h(
            "div",
            { className: "stats-grid" },
            h(StatCard, { label: "Repos", value: counts.repoCount || 0 }),
            h(StatCard, { label: "Projects", value: counts.projectCount || 0 }),
            h(StatCard, { label: "Packages", value: counts.packageCount || 0 }),
            h(StatCard, { label: "Edges", value: counts.edgeCount || 0 }),
          ),
          h("div", { className: "muted" }, `Last scan: ${formatDate(status?.lastScanAt || graph?.scannedAt)}`),
          h("div", { className: "muted" }, `Last change: ${formatDate(status?.lastChangeAt)}`),
          h("div", { className: "muted" }, `Update stream: ${connectionState}`),
        ),
      ),
      error
        ? h(
            "section",
            { className: "panel" },
            h("h2", { className: "panel-title" }, "Frontend error"),
            h("div", { className: "notice" }, error),
          )
        : null,
      status?.lastError
        ? h(
            "section",
            { className: "panel" },
            h("h2", { className: "panel-title" }, "Monitor error"),
            h("div", { className: "notice" }, status.lastError),
          )
        : null,
      h(
        "section",
        { className: "panel" },
        h("h2", { className: "panel-title" }, "Search"),
        h("input", {
          className: "search-input",
          type: "search",
          value: searchText,
          placeholder: "Project, package, repo...",
          onChange: (event) => setSearchText(event.target.value),
        }),
      ),
      h(
        "section",
        { className: "panel" },
        h("h2", { className: "panel-title" }, "Layout"),
        h(
          "div",
          { className: "layout-grid" },
          ["fcose", "dagre", "concentric"].map((mode) =>
            h(
              "button",
              {
                key: mode,
                className: `layout-button ${layout === mode ? "active" : ""}`,
                type: "button",
                onClick: () => setLayout(mode),
              },
              mode === "fcose" ? "Force" : mode === "dagre" ? "Flow" : "Concentric",
            ),
          ),
        ),
        h(Toggle, {
          checked: groupByRepo,
          onChange: setGroupByRepo,
          title: "Group projects by repo",
          note: "Use compound nodes so project clusters follow repository boundaries.",
        }),
      ),
      h(
        "section",
        { className: "panel" },
        h("h2", { className: "panel-title" }, "Filters"),
        h(
          "div",
          { className: "toggle-list" },
          DEFAULT_KINDS.map((kind) =>
            h(Toggle, {
              key: kind,
              checked: kindFilters[kind] !== false,
              onChange: (checked) => setKindFilters((current) => ({ ...current, [kind]: checked })),
              title: kind,
              note: kind === "nuget-producing" ? "Projects that publish internal packages." : null,
            }),
          ),
        ),
        h(Toggle, {
          checked: showExternal,
          onChange: setShowExternal,
          title: "Show external and unknown packages",
          note: "Hide unresolved package leaves to focus on internal flow.",
        }),
        h(Toggle, {
          checked: showTransitive,
          onChange: setShowTransitive,
          title: "Show transitive package edges",
          note: "Reveal `project.assets.json` derived relationships.",
        }),
      ),
      h(SelectionPanel, {
        selection,
        onJump: setSelectionId,
      }),
      h(ImpactSection, {
        title: "Tests to run",
        groups: selection?.tests || [],
        onSelect: setSelectionId,
      }),
      h(ImpactSection, {
        title: "Deployables to smoke-test",
        groups: selection?.deployables || [],
        onSelect: setSelectionId,
      }),
      h(
        "section",
        { className: "panel" },
        h("h2", { className: "panel-title" }, "Watched roots"),
        status?.roots?.length
          ? h(
              "ul",
              { className: "roots-list" },
              status.roots.map((root) => h("li", { key: root }, root)),
            )
          : h("p", { className: "muted" }, "No roots configured yet."),
      ),
    ),
    h(
      "main",
      { className: "canvas" },
      h(
        "div",
        { className: "canvas-inner" },
        h(
          "div",
          { className: "canvas-stage" },
          h(GraphCanvas, {
            graph,
            model,
            selectionId,
            onSelectionChange: setSelectionId,
            layout,
            groupByRepo,
            filterState,
            searchText: deferredSearchText,
            status,
          }),
        ),
      ),
    ),
  );
}

createRoot(document.getElementById("root")).render(h(App));
