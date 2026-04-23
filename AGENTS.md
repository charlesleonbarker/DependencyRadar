# Agent notes

Context for AI agents working in this repo. Written for Depmap specifically, but the guidance translates to any similar tooling work here.

## What this repo is

Depmap — a .NET 8 CLI + static HTML viewer that maps the dependency web across a folder of .NET git repositories and answers *"what needs retesting if this package changes?"* via reverse-BFS blast-radius analysis.

The full architecture is in [`DESIGN.md`](DESIGN.md). Start there before making non-trivial changes.

## Build / test / run

```bash
dotnet build
dotnet test
dotnet run --project src/Depmap -- scan test/fixtures --output test/fixtures/depmap.html
```

The compiled scanner becomes `depmap` (Exe output). The fixture in `test/fixtures/` is a synthetic 4-repo sample — run the scanner against it for end-to-end smoke tests.

## Repo layout

```
src/Depmap/             scanner CLI + embedded viewer assets (viewer.html/css/js)
test/Depmap.Tests/      xunit unit tests (uses InternalsVisibleTo → scanner internals)
test/fixtures/          synthetic 4-repo .NET estate for end-to-end verification
DESIGN.md               full design doc; source of truth for architecture decisions
README.md               user-facing README
```

## Locked-in design decisions — do not re-litigate without explicit user sign-off

1. **No metadata fetching.** The scanner never calls nuget.org, GitHub, or any network endpoint. Classification is purely local (file contents in the scanned folder).
2. **Unknowns are first-class.** When something can't be resolved locally (a package producer, a TFM-specific dep divergence, a missing `project.assets.json`), the node/edge is tagged `unknown` rather than guessed. Do not add fallback heuristics that silently resolve ambiguity.
3. **Multi-TFM projects = one node.** Dependency sets are the union across target frameworks. Per-TFM divergence is surfaced as `unknown`.
4. **No test-runner output.** The viewer lists affected test project paths; it does not generate `dotnet test` commands.
5. **Artifact is one self-contained HTML file.** No server, no build step on the viewer side. The scanner inlines CSS, JS, graph JSON, and (optionally) Cytoscape bundles into a single `depmap.html`.
6. **The produced-by edge is load-bearing.** It's the `Package → producing Project` edge that closes the cross-repo loop. Breaking this edge makes the tool pointless for its primary use case — treat it as critical.

## Conventions specific to this repo

- `src/Depmap/` has `TreatWarningsAsErrors=true` and `Nullable=enable`. CI will fail on nullability warnings — be deliberate about `?`, `!`, and `??`.
- Types are `internal` by default; `InternalsVisibleTo("Depmap.Tests")` in `AssemblyInfo.cs` exposes them to tests. Do not make things `public` just to test them.
- Parsers deliberately avoid `Microsoft.Build` — text/XML parsing is enough and dodges MSBuild's resolution requirements when running outside a real build. Do not reach for `Microsoft.Build.Evaluation` without a discussion.
- Viewer is vanilla JS + Cytoscape.js. No framework, no bundler, no package.json. Keep it that way unless the tradeoff becomes compelling.
- Stable node IDs come from `GraphBuilder.IdFor(kind, raw)` — a prefix + short SHA-256 of case-normalized input. Anything that persists or compares node IDs must go through this.

## When extending the scanner

- Parse edge cases: test new csproj shapes via `ProjectParserTests`, not by running the fixture. Fixture tests are for integration.
- New edge kinds: add to `EdgeKind`, extend `GraphJsonWriter.EdgeKindToJson`, extend viewer styles in `viewer.js` (`.e-<kind>` selector). All three must move together or rendering silently breaks.
- New project classifications: add a flag to `ProjectClassification`, teach `Classifier.Classify`, teach `GraphJsonWriter.SplitClassification`, and add a viewer style + filter checkbox. Drive via tests first.

## Environment notes

- If working inside Cowork (or any sandbox without a .NET SDK), you cannot run `dotnet build` — rely on a careful read of the code plus the existing test suite. The user compiles on their machine.
- `bin/` and `obj/` are gitignored; if they appear in the workspace it's because the user's IDE/tooling is restoring in the background. Leave them alone.

## User context

The primary user is a senior .NET engineer working with a microservice estate of roughly 40–50 repos. Frame explanations at that level — no need to define PackageReference, Sdk types, or MSBuild properties. Clarifying questions up front are welcome; exhaustive back-and-forth is not.
