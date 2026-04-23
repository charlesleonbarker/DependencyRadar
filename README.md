# Depmap

A tool for visualizing and impact-analyzing the dependency web across a folder of .NET repositories.

Points it at a folder of git repos, walks every `.sln` / `.csproj`, classifies projects (test / web / blazor / service / library / nuget-producing), detects internal NuGets (matched against packable projects in the scan), and produces a single self-contained `depmap.html` artifact with an interactive graph and a "tests to run / deployables to smoke-test" impact panel.

## Why it exists

Microservice-sized .NET estates end up with dozens of repos sharing internal NuGet packages. When someone updates a common package, answering "what might break?" and "what should we test?" is tedious and error-prone. This tool closes the loop: pick the project or package that changed, see the reverse-BFS blast radius, and get a list of the test projects transitively affected.

See [DESIGN.md](DESIGN.md) for the full architecture and data model.

## Quick start

```bash
# Build
dotnet build

# Scan the included fixtures and open the resulting HTML in a browser
dotnet run --project src/Depmap -- scan test/fixtures --output test/fixtures/depmap.html

# Run tests
dotnet test
```

Point `scan` at any folder of .NET repos. The output is a single HTML file — open it directly, upload it as a CI artifact, or commit it.

## Projects

- `src/Depmap.Core` — reusable parsing, discovery, graph-building, and JSON serialization.
- `src/Depmap` — CLI that scans on demand and emits the self-contained HTML artifact.
- `src/Depmap.Service` — long-running backend that watches configured roots, rescans on change, and serves the current graph over HTTP.

## CLI

```text
depmap scan <rootFolder> [options]
 
Options:
  --output <path>       Path for the self-contained HTML artifact (default: depmap.html)
  --json <path>         Also emit the raw graph as JSON to this path
  --include-transitive  Include transitive NuGet edges from project.assets.json when present (default: true)
  --no-transitive       Disable transitive NuGet edges
  --ignore <glob>       Glob(s) of paths to skip (may be repeated)
  --quiet               Suppress progress output
```

## Service

Configure watched roots in [src/Depmap.Service/appsettings.json](/Users/charles/Documents/Claude/Projects/dependancyMap/src/Depmap.Service/appsettings.json) under `Depmap:Roots`, then run:

```bash
dotnet run --project src/Depmap.Service
```

Endpoints:

- `GET /api/status` — monitor state, last scan time, and graph counts
- `GET /api/graph` — current graph JSON for a frontend to consume

Rider shared run configs are checked in under [.run](/Users/charles/Documents/Claude/Projects/dependancyMap/.run):

- `Depmap Full Stack (Fixtures)` — runs `Depmap.Service` in `Development` against `test/fixtures`
- `Depmap Scan Fixtures` — generates the fixture HTML/JSON snapshot with the CLI

## Docker

The live app can also run in a container. The image publishes `Depmap.Service` and serves the frontend and backend together on port `8080`.

Build the image:

```bash
docker build -t depmap .
```

Run it with your repo estate mounted at `/repos`:

```bash
docker run --rm -p 8080:8080 -v /path/to/repos:/repos depmap
```

If you want a different mount point, override `Depmap__Roots__0`:

```bash
docker run --rm -p 8080:8080 \
  -e Depmap__Roots__0=/workspace \
  -v /path/to/repos:/workspace \
  depmap
```

Then open [http://localhost:8080](http://localhost:8080).

## Repository layout

```
src/Depmap/             scanner CLI + embedded viewer assets
test/Depmap.Tests/      xunit unit tests
test/fixtures/          synthetic multi-repo fixture — scan this to sanity-check the tool
```

## Notes

- The viewer uses [Cytoscape.js](https://js.cytoscape.org/) + [fcose](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose). By default the built HTML loads these from unpkg. To produce a truly offline-capable artifact, drop the minified builds into `src/Depmap/Viewer/` and they'll be inlined automatically (the `.csproj` picks them up conditionally):
  - `cytoscape.min.js`
  - `cytoscape-fcose.min.js`
  - (optional) `cytoscape-dagre.min.js`
- Multi-targeted projects are represented as a single node; their dependency edges are the union across target frameworks. TFM-level ambiguity is surfaced as `unknown` rather than guessed.
- Packages whose producer is not found in the scanned folder are classified `unknown`. The tool never calls nuget.org or any feed.

## License

Internal tool. No licensing decisions have been made yet.
