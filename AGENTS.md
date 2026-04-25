# Agent notes

Context for AI agents working in this repo.

## What this repo is

Dependency Radar is a split .NET backend + React frontend for mapping the dependency web across a folder of .NET git repositories and answering *"what needs retesting if this package changes?"* via reverse-BFS blast-radius analysis.

The full architecture is in [`DESIGN.md`](DESIGN.md). Start there before making non-trivial changes.

## Build / test / run

```bash
dotnet build
dotnet test
dotnet run --project src/Depmap.Service
npm run dev --prefix src/Depmap.Web
```

The fixture estate in `test/fixtures/` is the main end-to-end smoke target.

## Repo layout

```text
src/Depmap.Core/        shared parsing, discovery, graph building, JSON serialization
src/Depmap.Service/     backend API + folder monitoring
src/Depmap.Web/         React frontend
test/Depmap.Tests/      xunit unit tests (uses InternalsVisibleTo -> scanner internals)
test/fixtures/          synthetic multi-repo .NET estate for end-to-end verification
DESIGN.md               full design doc; source of truth for architecture decisions
README.md               user-facing README
```

## Locked-in design decisions

1. **No metadata fetching.** The scanner never calls nuget.org, GitHub, or any network endpoint.
2. **Unknowns are first-class.** When something cannot be resolved locally, it stays `unknown` rather than guessed.
3. **Multi-TFM projects = one node.** Dependency sets are unioned across target frameworks.
4. **No test-runner output.** The UI lists affected test project paths; it does not generate `dotnet test` commands.
5. **Frontend and backend are separate runtimes.** `DependencyRadar.Service` is API-only. `DependencyRadar.Web` consumes that API and is not hosted by the backend.
6. **The produced-by edge is load-bearing.** `Package -> producing Project` closes the internal package loop.

## Conventions

- `src/Depmap.Core/` and `src/Depmap.Service/` use `TreatWarningsAsErrors=true` and `Nullable=enable`.
- Types are `internal` by default; `InternalsVisibleTo("DependencyRadar.Tests")` exposes scanner internals to tests.
- Parsers deliberately avoid `Microsoft.Build`.
- Frontend is React + Cytoscape in `src/Depmap.Web`. Keep domain logic thin there.
- Stable node IDs come from `GraphBuilder.IdFor(kind, raw)`.

## When extending the scanner

- Parse edge cases: add targeted parser tests instead of relying only on fixture runs.
- New edge kinds: update `EdgeKind`, JSON serialization, and frontend rendering together.
- New project classifications: update classifier, JSON shape, and frontend filters/styles together.

## Environment notes

- If the environment cannot run `dotnet build`, rely on careful code reading plus the existing tests.
- `bin/` and `obj/` are gitignored; leave IDE-generated artifacts alone.

## User context

The primary user is a senior .NET engineer working with a microservice estate of roughly 40-50 repos. Frame explanations at that level.
