# Dependency Radar - Current Design

Dependency Radar is split into three components:

1. `DependencyRadar.Core`
   Local-only discovery, parsing, classification, graph building, and graph JSON serialization.

2. `DependencyRadar.Service`
   ASP.NET Core backend that watches configured roots, debounces file changes, rescans via `DependencyRadar.Core`, keeps the latest graph in memory, and exposes it over HTTP.

3. `DependencyRadar.Web`
   React + Cytoscape frontend that runs separately from the backend and consumes the HTTP API.

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

- `src/Depmap.Core/`
  Shared scanner logic and source of truth for discovery, parsing, graph construction, and JSON shape.

- `src/Depmap.Service/`
  Always-on backend API.

- `src/Depmap.Web/`
  Frontend source.

- `test/Depmap.Tests/`
  Unit tests against `DependencyRadar.Core`.

The source folders retain their original `Depmap.*` names for now. Namespaces, assemblies, configuration, deployment labels, and user-facing copy use `DependencyRadar` / Dependency Radar.

## Backend responsibilities

- Read configured scan roots from configuration.
- Create `FileSystemWatcher` instances for those roots.
- Treat watcher events as invalidation signals, not incremental graph edits.
- Debounce bursts of changes.
- Rescan deterministically through `DependencyRadar.Core`.
- Keep the latest graph JSON and summary in memory.
- Expose scan state and graph data over HTTP.
- Emit SSE updates when the graph version changes.
- Optionally emit display-only shortened paths by removing configured `DisplayPathPrefixes`.

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
- Maintain search, filters, layout, focus, and selection state
- Compute blast radius, affected tests, and deployables client-side
- Surface direct vs indirect consumers/dependencies and package version drift from the local graph data.

`DependencyRadar.Web` should stay thin on domain logic. Graph semantics remain owned by the shared model and API contract.

## Data model

### Nodes

| Kind      | Identity                | Attributes                                                             |
|-----------|-------------------------|------------------------------------------------------------------------|
| Repo      | folder path             | name, path                                                             |
| Solution  | `.sln` absolute path    | name, repo                                                             |
| Project   | `.csproj` absolute path | name, assembly name, SDK, TFMs, classification, package ID if packable |
| Package   | package ID              | versions seen, classification, produced-by project if internal         |

Repo, solution, and project JSON may include `displayPath` alongside the raw `path`. `displayPath` is presentation-only and must not be used for graph identity or file IO.

### Project classification

Derived locally from `.csproj` content:

- base `Microsoft.NET.Sdk` projects
- test projects
- `Microsoft.NET.Sdk.Web` projects
- Blazor WebAssembly projects
- Worker SDK or hosted-service projects
- packable NuGet projects

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
- list consumers grouped by repo
- list internal dependencies grouped by repo
- list external or unknown package dependencies at the bottom only when the package filter is enabled
- label relationships consistently as `direct`, `indirect`, or `dual source`
- show direct and indirect sections separately where that improves scanability
- highlight packages where more than one local version is seen

Internal NuGet package dependencies should be presented as the producer project when the package can be resolved locally. For sidebar depth, path labels, and hover paths, treat the internal package and its producing project as the same dependency target; do not show an extra "via package" hop or make the package and producer look like duplicate primary dependencies. Keep the referenced package version visible where the direct package-reference edge provides it.

## Storage

For the current scope, the latest graph snapshot is the product. The service keeps it in memory.

A database becomes justified only if we need:

- historical snapshots
- graph diffs across time
- audit trails
- multi-user state
- saved views or annotations
