# Dependency Radar - Current Design

Dependency Radar is split into three components:

1. `DependencyRadar.Core`
   Local-only discovery, parsing, classification, graph building, and graph JSON serialization.

2. `DependencyRadar.Service`
   ASP.NET Core backend that watches configured roots, debounces file changes, rescans via `DependencyRadar.Core`, keeps the latest graph in memory, and exposes it over HTTP.

3. `DependencyRadar.Web`
   React + Cytoscape frontend. It runs separately from the backend in development. The Docker image builds it and serves the static output from `DependencyRadar.Service` so UI and API share one port.

## Architecture

```text
┌────────────────────┐
│ watched repo roots │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│DependencyRadar.Svc │
│ watch + debounce   │
│ scan + expose API  │
└───────┬─────┬──────┘
        │     │
        │     └───────────────┐
        ▼                     ▼
┌───────────────┐      ┌───────────────┐
│ current graph │      │DependencyRadar│
│ in memory     │      │ React + Vite  │
└───────────────┘      └───────────────┘
```

The stable boundary is the graph JSON contract produced by `DependencyRadar.Core` and exposed by `DependencyRadar.Service`.

## Project layout

- `src/DependencyRadar.Core/`
  Shared scanner logic and source of truth for discovery, parsing, graph construction, and JSON shape.

- `src/DependencyRadar.Service/`
  Always-on backend API.

- `src/DependencyRadar.Web/`
  Frontend source.

- `test/DependencyRadar.Tests/`
  Unit tests against `DependencyRadar.Core`.

Source folders, namespaces, assemblies, configuration, deployment labels, and user-facing copy all use `DependencyRadar` / Dependency Radar.

## Backend responsibilities

- Read configured scan roots from configuration.
- Create `FileSystemWatcher` instances for those roots.
- Treat watcher events as invalidation signals, not incremental graph edits.
- Debounce bursts of changes.
- Rescan deterministically through `DependencyRadar.Core`.
- Keep the latest graph JSON and summary in memory.
- Expose scan state and graph data over HTTP.
- Emit SSE updates when the graph version changes.
- Apply display-only name prefix stripping from configured `NamePrefixes` for repo, solution, and project labels. Stable IDs and raw paths are unchanged.

Current API:

- `GET /api/status`
- `GET /api/graph`
- `POST /api/rescan`
- `GET /api/updates`

The frontend should rely on watcher-driven scans for normal use. `POST /api/rescan` remains useful for diagnostics and development, but it is not a primary UI workflow.

## Frontend responsibilities

- Fetch `GET /api/status` and `GET /api/graph`
- Subscribe to `GET /api/updates`
- Rehydrate the graph into lookup maps and adjacency lists in the browser
- Render the graph with Cytoscape
- Maintain search, filters, layout, repo grouping, focus, and selection state
- Compute blast radius, affected tests, and deployables client-side
- Surface relationship categories, consumers/dependencies, and locally observed NuGet package versions from the graph data.
- Keep the Impact Panel synchronized with graph filters.

`DependencyRadar.Web` should stay thin on domain logic. Graph semantics remain owned by the shared model and API contract.

## Data model

### Nodes

| Kind      | Identity                | Attributes                                                             |
|-----------|-------------------------|------------------------------------------------------------------------|
| Repo      | folder path             | name, path                                                             |
| Solution  | `.sln` absolute path    | name, repo                                                             |
| Project   | `.csproj` absolute path | name, assembly name, SDK, TFMs, classification, NuGet package ID if one is produced |
| Package   | package ID              | versions seen, classification, produced-by project if internal         |

Repo, solution, and project JSON may include `displayPath` alongside the raw `path`. `displayPath` is presentation-only and must not be used for graph identity or file IO.

### Project classification

Derived locally from `.csproj` content:

- base `Microsoft.NET.Sdk` projects
- test projects
- `Microsoft.NET.Sdk.Web` projects
- Blazor WebAssembly projects
- Worker SDK or hosted-service projects
- NuGet package-producing projects

A project can hold multiple classifications.

The JSON classification keys remain compact and stable (`library`, `test`, `web`, `blazor`, `service`, `nuget-producing`), but the UI should use .NET SDK/project-type labels rather than generic labels such as "library" or "service".

### Edges

- `Solution -> Project` (`solutionContains`)
- `Project -> Project` (`projectRef`)
- `Project -> Package` (`packageRef`)
- `Package -> Project` (`producedBy`)

The `producedBy` edge is the critical edge that closes the internal NuGet loop.

## Scanner rules

1. No metadata fetching.
   No nuget.org, GitHub, or any external lookups.

2. Unknowns are first-class.
   If something cannot be resolved locally, it stays `unknown` rather than guessed.

3. Multi-TFM projects stay single-node.
   Dependencies are unioned across TFMs. Divergence is surfaced as uncertainty, not split nodes.

4. The service rescans.
   File watcher events do not mutate the graph directly. They trigger a debounced rescan.

## Parsing strategy

- `.sln`
  Regex parse `Project(...) = ...` lines. Avoid `Microsoft.Build`.

- `.csproj`
  XML parse metadata, `ProjectReference`, `PackageReference`, packability, and classification hints.

- Git repo detection
  Walk ancestors looking for `.git`.

## Impact analysis

Browser-side and graph-based:

```text
impact(node) = reverseBFS(node)
tests(node) = impacted project nodes classified as test
deployables(node) = impacted project nodes classified as web or service
```

Selecting a node should:

- highlight upstream blast radius
- highlight downstream dependencies
- show compact, recognisable labels for the selected node instead of a bulky details table
- show an Impact Panel with collapsible sections:
  - Affected Tests
  - Affected Deployments
  - All Consumers
  - All Dependencies
  - External packages, only when external package visibility is enabled
- keep Affected Tests and Affected Deployments expanded by default
- list consumers and dependencies grouped by repo
- label relationships as `Direct Project`, `Direct Package`, or `Indirect Package`
- show consumed package versions on relationship rows, with tooltips explaining which project consumes which version
- show all locally consumed versions for a selected NuGet package-producing project in its header
- keep Impact Panel project lists consistent with active graph type filters

Internal NuGet package dependencies should be presented as the producer project when the package can be resolved locally. For graph nodes, Impact Panel depth, path labels, search aliases, and hover paths, treat the internal package and its producing project as the same dependency target; do not show an extra "via package" hop or make the package and producer look like duplicate primary dependencies. Keep referenced package versions visible where package-reference edges provide them.

## Frontend interaction model

- Search opens on focus and shows all suggestions before the user types.
- Search suggestions include repos, projects, and external/unresolved packages. Internal package IDs appear as aliases for their producing project.
- Project type, repository, and external package filters affect the graph. Project type filters also affect Impact Panel lists.
- The default graph layout is Cluster Map (`fcose`). Dependency Paths (`dagre`) and Most Referenced (`concentric`) remain available.
- The Repositories toggle shows or hides repo grouping boxes. Selecting a repo turns grouping back on.
- Graph control tooltips render through a portal so dock/panel overflow does not clip them.

## Storage

For the current scope, the latest graph snapshot is the product. The service keeps it in memory.

A database becomes justified only if we need:

- historical snapshots
- graph diffs across time
- audit trails
- multi-user state
- saved views or annotations
