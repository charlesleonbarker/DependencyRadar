# Dependency Radar TODO

Working notes for the next frontend/backend polish pass. The target user is a senior .NET engineer or architect who understands code but may not yet have a clear mental model of dependency blast radius, internal NuGet loops, or retesting implications.

Status legend:

- `[x]` done
- `[~]` mostly done, with a named follow-up
- `[ ]` still open

## P0 - Behaviour Bugs

### [x] Fix dependency-path layout button

Problem: the **Dependency Paths** button does not reliably switch to the dependency-path layout. It often redraws whichever layout was previously active, although it works from a fresh page load.

Likely area: `src/Depmap.Web/src/App.tsx`, `src/Depmap.Web/src/components/BottomControls.tsx`, `src/Depmap.Web/src/components/GraphCanvas.tsx`.

Acceptance:

- Clicking **Dependency Paths** always applies the dagre/dependency-path layout, regardless of the previous mode.
- Switching between **Dependency Paths**, **Cluster Map**, and **Most Referenced** is repeatable.
- The selected node, highlighted paths, and current filters survive layout changes.

### [x] Fix sidebar close behaviour when filters are open

Problem: when the filter/search panel is open, clicking the close control on the selection sidebar closes the filter panel instead of the sidebar.

Likely area: `src/Depmap.Web/src/App.tsx`, `src/Depmap.Web/src/components/SearchFilterDock.tsx`, `src/Depmap.Web/src/components/SelectionPopover.tsx`.

Acceptance:

- The sidebar close control only clears/closes the selected-node sidebar.
- The filter/search close control only closes the filter/search panel.
- Keyboard escape behaviour, if present, is intentional and documented in code or help copy.

### [x] Fix unreadable search/filter tag pills

Problem: some tag pills in search/filter UI render with a filled block style where the text has insufficient contrast.

Likely area: `src/Depmap.Web/src/components/SearchFilterDock.tsx`, `src/Depmap.Web/src/app.css`.

Acceptance:

- All project kind, node kind, and filter pills meet readable contrast in active, inactive, hover, and selected states.
- Long labels do not overflow or clip on narrow screens.

## P1 - Graph Semantics And Impact Clarity

### [x] Improve sidebar dependency depth presentation

Problem: **dependencies of dependencies** and **consumers of consumers** are hard to read in the sidebar. Internal package references should not look like an extra dependency hop when the producing project is known.

Goal: make the selected node's upstream and downstream relationships easier to scan as a dependency tree or grouped path list.

Likely area: `src/Depmap.Web/src/domain/graphModel.ts`, `src/Depmap.Web/src/components/SelectionPopover.tsx`.

Acceptance:

- For selected projects and packages, the sidebar clearly separates:
  - direct dependencies
  - indirect dependencies
  - direct consumers
  - indirect consumers
- Internal NuGet dependencies resolve visually to the producing project.
- Treat an internal package ID and its producing project as the same sidebar dependency target; do not show a separate `via package` hop.
- Hovering a row highlights the relevant path on the graph.

### [x] Explain "Produced by project"

Problem: the **Produced by project** edge appears in the graph but the product does not explain why it matters.

Context: this edge is load-bearing. It closes the loop between an internal NuGet package and the local project that creates it, allowing blast-radius analysis to connect package consumers back to source projects.

Acceptance:

- Help content includes a concise explanation of **Produced by project**.
- Edge tooltip explains: "This package is built by a project in your scanned repos, so consumers of the package are treated as downstream of that project."
- Sidebar copy avoids making the package and producer look like duplicate primary dependencies.

### [x] Add package versions and highlight version variation

Problem: package reference versions are not visible enough, and version drift is not highlighted.

Likely area: backend JSON shape if version data is missing; otherwise frontend rendering in `graphModel.ts`, `SelectionPopover.tsx`, and graph styling.

Acceptance:

- Package references show the version or version range seen locally.
- Packages with multiple versions across the estate are visibly marked in search/sidebar and optionally on graph nodes.
- The UI distinguishes exact version, floating/ranged version, and unknown version where that data exists.
- Add or update parser/graph tests if backend data shape changes.

### [x] Fix repository-to-package hover links

Status: implemented deterministic sidebar hover paths for project, repo, internal package, and external package rows. Verified against the fixture2 graph for repo-to-internal-package, repo-to-external-package, and project-to-internal-package paths after internal package node collapsing.

Problem: repo-to-package hover/path highlighting is not following the correct graph relationship.

Clarify expected behaviour before implementation:

- Hovering a package dependency from a repo or project context should highlight the path from the selected item to that package.
- For internal packages, the path should include the producing project where applicable.
- External packages should not imply an internal source project.

Acceptance:

- Hover paths are deterministic for project, repo, internal package, and external package nodes.
- No stale hover path remains after mouse leave or selection changes.

## P1 - Product Copy, Help, And Tooltips

### [x] Rewrite help for .NET developers and architects

Problem: **What this is**, **Using the map**, and **Reading the graph** should be clearer for .NET developers who need to reason about breaking changes, retesting, and deployment impact.

Likely area: `src/Depmap.Web/src/components/HelpContent.tsx`.

Acceptance:

- Explain the product in terms of local .NET repos, `.csproj`, `ProjectReference`, and `PackageReference`.
- Explain blast radius as "what may need retesting or redeploying if this node changes".
- Make clear that the UI lists affected test project paths and does not generate `dotnet test` commands.
- Explain unknowns: locally unresolved dependencies are shown as unknown rather than guessed.
- Avoid generic graph jargon where practical.

### [x] Add custom tooltips across important UI

Status: custom tooltip pattern exists for controls/badges and graph edges, including `producedBy`, package refs, and project refs.

Problem: native/browser tooltips are not enough, and many graph concepts need short explanations.

Likely area: shared tooltip component, `SelectionPopover.tsx`, `BottomControls.tsx`, `SearchFilterDock.tsx`, `HelpContent.tsx`, graph node/edge hover handling.

Acceptance:

- Add a reusable custom tooltip component/pattern.
- Tooltips exist for graph edge kinds, project/package classifications, layout controls, filters, rescan/status indicators, affected tests, deployables, `direct`, `indirect`, `dual source`, and `produced by`.
- Tooltip text explains the testing or architecture implication, not just the label.
- Tooltips are keyboard-accessible where the control is keyboard-focusable.

### [x] Add product title/logo and favicon

Problem: the main page needs stronger product identity above search.

Acceptance:

- Add **Dependency Radar** title/logo above the search/filter area.
- Add a simple `DR` favicon.
- Keep the main screen as the usable graph experience, not a landing page.
- Ensure the title does not crowd the graph on laptop-sized screens.

## P2 - UI Polish

### [x] Center repository names on graph nodes

Problem: repository node labels are not visually centered.

Likely area: `src/Depmap.Web/src/graph/graphStyle.ts`, `src/Depmap.Web/src/graph/cytoscapeModel.ts`.

Acceptance:

- Repository labels are centered and readable in all layouts.
- Long repository names wrap or truncate consistently without overlapping nearby nodes.

### [x] Make license list slimmer and more subdued

Problem: license/about content is too visually prominent.

Likely area: `src/Depmap.Web/src/components/HelpContent.tsx`, `src/Depmap.Web/src/app.css`.

Acceptance:

- License/source section is visually secondary to usage guidance.
- It remains easy to find and readable.

### [x] Wrap long package/change titles at periods

Problem: long titles such as package IDs or change labels should wrap at `.` boundaries where possible.

Acceptance:

- Long dotted identifiers wrap cleanly in sidebar/search/help surfaces.
- Wrapping does not break copy/paste of package IDs.
- Layout remains stable on narrow widths.

## P2 - Backend And Scan Workflow

### [x] Add backend prefix remover

Problem: local absolute paths may include noisy machine-specific prefixes that make graph labels and paths harder to read.

Clarify desired behaviour before implementation:

- Remove a configured path prefix from display paths only, while preserving stable internal IDs based on absolute paths.
- Support one or more prefixes through configuration.
- Never rewrite paths used for file IO.

Acceptance:

- API returns both stable/raw path where needed and display path where the UI should show a shorter value.
- Existing graph IDs remain stable.
- Add tests covering prefix removal on Unix-style and Windows-style paths if implemented in core/service.

### [x] Remove manual rescan button

Problem: rescans should happen automatically from file changes; the UI should not encourage manual rescans.

Context: the backend currently exposes `POST /api/rescan`. Decide whether to keep it for diagnostics while removing the primary UI button.

Acceptance:

- Remove or demote the rescan button from the main UI.
- Status still explains when the last scan ran and whether a scan is in progress.
- File watcher/SSE updates remain the normal refresh path.
- If `POST /api/rescan` remains, document it as diagnostic/development-only.

## P3 - Documentation

### [x] Update design and knowledge base

Status: `DESIGN.md`, `CLAUDE.md`, and `README.md` were updated for sidebar semantics, version drift, display paths, produced-by semantics, and rescan workflow.

Problem: product behaviour and terminology have moved ahead of the design/help documentation.

Acceptance:

- Update `DESIGN.md` after semantic changes, especially package version drift, dependency tree/sidebar behaviour, prefix display paths, and rescan workflow.
- Update any project knowledge-base docs once the help copy and terminology settle.
- Keep locked-in design decisions intact: no metadata fetching, unknowns are first-class, multi-TFM projects stay one node, and produced-by remains load-bearing.

## Implementation Notes

- Keep frontend domain logic thin. If graph semantics or JSON shape changes, update `src/Depmap.Core`, service API types, frontend API types, graph model, rendering, and tests together.
- Prefer targeted tests for scanner/parser changes. Use fixture estate smoke checks for end-to-end confidence.
- Preserve local-only behaviour: no NuGet, GitHub, or other network metadata fetching.
