# Dependency Radar

Dependency Radar is a local-first .NET dependency impact tool made by Charlie Barker.

It visualizes dependency relationships across a folder of .NET repositories and helps developers and testers understand what needs retesting or redeploying when a project or NuGet package changes.

Source: [github.com/charlesleonbarker/DependencyRadar](https://github.com/charlesleonbarker/DependencyRadar)

- `DependencyRadar.Service` watches configured roots, rescans on change, and exposes the current graph over HTTP.
- `DependencyRadar.Web` is a separate React app that consumes that API and renders the map.
- `DependencyRadar.Core` contains the shared parsing, discovery, graph-building, and JSON serialization logic.

See [DESIGN.md](DESIGN.md) for the architecture and data model.

## Quick start

```bash
dotnet build
dotnet test
npm install --prefix src/DependencyRadar.Web
npm run typecheck --prefix src/DependencyRadar.Web
```

## Projects

- `src/DependencyRadar.Core` — shared parsing, discovery, graph building, JSON serialization.
- `src/DependencyRadar.Service` — backend API and folder monitoring.
- `src/DependencyRadar.Web` — standalone React frontend.

Source folders, namespaces, assembly names, Docker image, and deployment surface all use `DependencyRadar` / Dependency Radar.

## Backend

Configure watched roots in [src/DependencyRadar.Service/appsettings.json](src/DependencyRadar.Service/appsettings.json) under `DependencyRadar:Roots`, then run:

```bash
dotnet run --project src/DependencyRadar.Service
```

If `localhost:5000` is occupied on your machine, use another port:

```bash
ASPNETCORE_URLS=http://localhost:5001 dotnet run --project src/DependencyRadar.Service
```

API surface:

- `GET /api/status`
- `GET /api/graph`
- `POST /api/rescan`
- `GET /api/updates`

In local development the frontend and backend run as separate processes. In the Docker image, the published React app is copied into the service `wwwroot` and the API plus UI are served from the same port.

`POST /api/rescan` is primarily for diagnostics and development; normal refreshes come from file-watcher-driven rescans.

Useful backend configuration:

- `DependencyRadar:Roots` — folders to scan.
- `DependencyRadar:IgnoreGlobs` — local ignore patterns for discovery.
- `DependencyRadar:NamePrefixes` — display-only prefixes to strip from repo, solution, and project names. Stable IDs and paths are unchanged.
- `DependencyRadar:DebounceMilliseconds` — watcher debounce interval.

## Frontend

Run the frontend separately:

```bash
npm install --prefix src/DependencyRadar.Web
npm run dev --prefix src/DependencyRadar.Web
```

By default Vite runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:5001`.

If you want the frontend to target a different backend directly, set `VITE_API_BASE_URL`:

```bash
VITE_API_BASE_URL=http://localhost:5001 npm run dev --prefix src/DependencyRadar.Web
```

Frontend behavior:

- The search box opens on focus and shows all repos, projects, and external package suggestions before typing.
- Filters can hide project types, external packages, and repositories. Repository filters have All/None controls.
- The default graph layout is **Cluster Map**. Other graph modes are **Dependency Paths** and **Most Referenced**.
- The **Repositories** graph toggle shows or hides repo grouping boxes. Selecting a repo turns repo grouping back on.
- The Impact Panel lists Affected Tests, Affected Deployments, All Consumers, All Dependencies, and External packages.
- Impact Panel sections are collapsible; Affected Tests and Affected Deployments are expanded by default.
- Relationship badges distinguish **Direct Project**, **Direct Package**, and **Indirect Package** paths.
- Internal NuGet packages are consolidated onto the producing project in the graph and Impact Panel. Version pills show locally observed package versions used on relationships; hover a pill to see which project is consuming which version.
- Help, graph controls, and version pills use tooltips; dock-control tooltips render in a portal so they are not clipped by control containers.

## Local development

Run backend and frontend as separate processes:

```bash
ASPNETCORE_URLS=http://localhost:5001 dotnet run --project src/DependencyRadar.Service
npm install --prefix src/DependencyRadar.Web
npm run dev --prefix src/DependencyRadar.Web
```

## VS Code

Shared VS Code launch and task config is in [.vscode](.vscode):

- `Dependency Radar: Backend (.NET)` — builds and debugs `DependencyRadar.Service` on `http://localhost:5001`
- `Dependency Radar: Web (Chrome)` — starts Vite on `http://localhost:5173` and opens the React app
- `Dependency Radar: Full Stack` — starts both launch targets together

## Rider

Shared run configs are in [.run](.run):

- `Dependency Radar Backend (Fixtures)` — runs the backend in `Development` against `test/fixtures`

## Docker

The checked-in [Dockerfile](Dockerfile) builds the React frontend, publishes the .NET backend, and serves both from the same container on port `8080`.

Build:

```bash
docker build -t dependency-radar .
```

Run:

```bash
docker run --rm -p 8080:8080 -v /path/to/repos:/repos dependency-radar
```

Open `http://localhost:8080` for the UI. The API is served from the same origin under `/api`.

If you want a different mount point, override `DependencyRadar__Roots__0`:

```bash
docker run --rm -p 8080:8080 \
  -e DependencyRadar__Roots__0=/workspace \
  -v /path/to/repos:/workspace \
  dependency-radar
```

If `/repos` is empty or not mounted, the container scans the bundled fixture estate.

Kubernetes-style environment variables use ASP.NET Core's double-underscore syntax:

```yaml
env:
  - name: DependencyRadar__Roots__0
    value: /repos
  - name: DependencyRadar__NamePrefixes__0
    value: Meridian.
```

## Repository layout

```text
src/DependencyRadar.Core/        shared scanner logic
src/DependencyRadar.Service/     backend API
src/DependencyRadar.Web/         React frontend
test/DependencyRadar.Tests/      xunit unit tests
test/fixtures/          synthetic multi-repo fixture estate
```

## Notes

- Multi-targeted projects are represented as a single node; dependency edges are the union across TFMs.
- Packages whose producer cannot be resolved locally remain `unknown`.
- Internal NuGet packages use a `producedBy` edge from package ID to the scanned project that builds it. This closes the internal NuGet loop for impact analysis. The UI treats the producing project as the primary node rather than rendering duplicate package/project nodes.
- Package-reference edges include the locally observed version string when available, allowing the UI to trace consumed versions through the Impact Panel.
- The tool never calls nuget.org or any external metadata service.

## License

Dependency Radar is licensed under the MIT License. See [LICENSE](LICENSE).
