# Depmap — Current Design

Depmap is now split into a reusable scanner core, an always-on backend service, and a browser UI.

The core job is unchanged: map dependency relationships across a folder of .NET repositories and answer "what needs retesting if this package or project changes?" using reverse reachability over the graph.

The delivery model has changed:

- The original CLI artifact still exists for CI and shareable snapshots.
- The primary application is now a long-running local service that watches configured folders, rescans when files change, and serves a frontend that updates automatically.

---

## Architecture

Three components, two run modes:

1. `Depmap.Core`
   Local-only discovery, parsing, classification, graph building, and JSON serialization.

2. `Depmap.Service`
   ASP.NET Core host that watches configured roots, debounces filesystem changes, rescans via `Depmap.Core`, keeps the current graph in memory, and exposes HTTP endpoints for the UI.

3. `Depmap` CLI
   On-demand scanner that still emits a self-contained `depmap.html` artifact for CI, sharing, and offline inspection.

```
┌────────────────────┐
│ watched repo roots │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│   Depmap.Service   │
│ watch + debounce   │
│ scan + serve API   │
└───────┬─────┬──────┘
        │     │
        │     └───────────────┐
        ▼                     ▼
┌───────────────┐      ┌───────────────┐
│ current graph │      │ React frontend│
│ in memory     │      │ + Cytoscape   │
└───────────────┘      └───────────────┘

Separate path:

┌───────────────┐      ┌──────────────┐      ┌───────────────┐
│ repos/ folder │ ───▶ │ Depmap CLI   │ ───▶ │  depmap.html  │
└───────────────┘      └──────────────┘      └───────────────┘
```

---

## Project layout

- `src/Depmap.Core/`
  Shared scanner logic. This is the source of truth for discovery, parsing, graph construction, and graph JSON.

- `src/Depmap/`
  CLI wrapper over `Depmap.Core`. Responsible for one-shot scans and static artifact generation.

- `src/Depmap.Service/`
  Always-on backend plus hosted frontend assets.

- `test/Depmap.Tests/`
  Unit tests against `Depmap.Core` internals.

---

## Run modes

### 1. Always-on application

`Depmap.Service` is the primary interactive mode.

Responsibilities:

- Read configured scan roots from configuration.
- Create `FileSystemWatcher` instances for those roots.
- Treat filesystem events as invalidation signals, not incremental graph edits.
- Debounce bursts of changes.
- Rescan deterministically through `Depmap.Core`.
- Keep the latest graph JSON and summary in memory.
- Notify connected browsers when the status or graph version changes.

Current API surface:

- `GET /api/status`
  Returns monitor state, configured roots, timestamps, version, last error, and graph counts.

- `GET /api/graph`
  Returns the current graph JSON.

- `GET /api/updates`
  Server-sent events stream used by the frontend to refresh when scans complete or monitor state changes.

### 2. Snapshot artifact

The CLI remains for:

- CI artifact generation
- offline inspection
- ad hoc scans
- check-in or sharing outside the service flow

The CLI should remain a thin layer over `Depmap.Core`.

---

## Data model

### Nodes

| Kind      | Identity                | Attributes                                                             |
|-----------|-------------------------|------------------------------------------------------------------------|
| Repo      | folder path             | name, path                                                             |
| Solution  | `.sln` absolute path    | name, repo                                                             |
| Project   | `.csproj` absolute path | name, assembly name, SDK, TFMs, classification, package ID if packable |
| Package   | package ID              | versions seen, classification, produced-by project if internal         |

### Project classification

Derived locally from `.csproj` content:

- `test`
- `web`
- `blazor`
- `service`
- `nuget-producing`
- `library`

A project can hold multiple classifications.

### Edges

- `Solution -> Project` (`solutionContains`)
- `Project -> Project` (`projectRef`)
- `Project -> Package` (`packageRef`)
- `Project -> Package` (`packageRefTransitive`)
- `Package -> Project` (`producedBy`)

The `producedBy` edge is still the load-bearing edge. It is what closes the cross-repo loop for internal NuGet producers and consumers.

---

## Scanner rules

These remain intentionally conservative:

1. No metadata fetching.
   No nuget.org, no GitHub, no external service lookups.

2. Unknowns are first-class.
   If something cannot be resolved locally, it stays `unknown` rather than guessed.

3. Multi-TFM projects stay single-node.
   Dependency sets are unioned across TFMs. Divergence is surfaced as uncertainty, not split into per-TFM nodes.

4. The service rescans.
   File watcher events do not mutate the graph directly. They trigger a debounced full rescan of configured roots.

5. The CLI artifact remains self-contained.
   The always-on app does not replace the need for a one-file export path.

---

## Parsing strategy

- `.sln`
  Regex parse `Project(...) = ...` lines. Avoid `Microsoft.Build`.

- `.csproj`
  XML parse project metadata, `ProjectReference`, `PackageReference`, packability, and classification hints.

- `project.assets.json`
  Best-effort read for transitive package references when present.

- Git repo detection
  Walk ancestors looking for `.git`.

---

## Frontend

The service hosts a React page that consumes the live backend.

Current frontend responsibilities:

- Fetch `GET /api/status` and `GET /api/graph`
- Subscribe to `GET /api/updates`
- Rehydrate the graph into lookup maps and adjacency lists in the browser
- Render the graph with Cytoscape
- Maintain search, filters, layout selection, repo grouping, and selection state
- Compute blast radius, affected tests, and deployables client-side
- Refresh automatically when a new scan version arrives

The frontend is intentionally thin on domain logic. The graph contract from `Depmap.Core` remains the stable boundary.

---

## Impact analysis

Still browser-side and graph-based:

```text
impact(node) = reverseBFS(node)
tests(node) = impacted project nodes classified as test
deployables(node) = impacted project nodes classified as web or service
```

Selecting a node should:

- highlight upstream blast radius
- highlight downstream dependencies
- show node details
- list affected tests grouped by repo
- list affected deployables grouped by repo

---

## Why the service keeps the graph in memory

For the current scope, the latest graph is the product.

An in-memory current snapshot is enough for:

- browser interaction
- live refresh
- status reporting
- simple operational behavior

A database becomes justified only if we need:

- historical snapshots
- graph diffs across time
- audit trails
- multi-user state
- saved views or annotations

Until then, adding a database would increase complexity without solving the main problem.

---

## Milestones

Completed:

1. Shared scanner core extracted into `Depmap.Core`
2. CLI refactored to consume the shared scanner
3. Always-on backend added with watch, debounce, scan, and JSON endpoints
4. React frontend hosted by the service and wired to live updates

Next likely steps:

1. Persist snapshot history for time-based diffing
2. Add richer frontend filtering and repo scoping
3. Add explicit health and diagnostics endpoints
4. Add frontend packaging if runtime CDN dependencies become a problem

---

## Tech stack summary

| Layer      | Choice                                                       |
|------------|--------------------------------------------------------------|
| Core       | .NET 8 class library, pure XML/text parsing                  |
| CLI        | .NET 8 console app                                           |
| Service    | ASP.NET Core minimal host + `FileSystemWatcher`              |
| Frontend   | React page hosted by ASP.NET Core, Cytoscape for graphing    |
| Live sync  | Server-sent events                                           |
| Artifact   | Single self-contained `depmap.html` from the CLI             |
