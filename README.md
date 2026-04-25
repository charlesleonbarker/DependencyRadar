# Dependency Radar

Dependency Radar is a local-first .NET dependency impact tool made by Charlie Barker.

It visualizes dependency relationships across a folder of .NET repositories and helps developers and testers understand what needs retesting when a project or package changes.

Source: [github.com/charlesleonbarker/Depmap](https://github.com/charlesleonbarker/Depmap)

- `DependencyRadar.Service` watches configured roots, rescans on change, and exposes the current graph over HTTP.
- `DependencyRadar.Web` is a separate React app that consumes that API and renders the map.
- `DependencyRadar.Core` contains the shared parsing, discovery, graph-building, and JSON serialization logic.

See [DESIGN.md](DESIGN.md) for the architecture and data model.

## Quick start

```bash
dotnet build
dotnet test
```

## Projects

- `src/Depmap.Core` — shared parsing, discovery, graph building, JSON serialization.
- `src/Depmap.Service` — backend API and folder monitoring.
- `src/Depmap.Web` — standalone React frontend.

The source folders keep their original `Depmap.*` paths for now, while the product, namespaces, assembly names, Docker image, and deployment surface use `Dependency Radar`.

## Backend

Configure watched roots in [src/Depmap.Service/appsettings.json](/Users/charles/Documents/Claude/Projects/dependancyMap/src/Depmap.Service/appsettings.json) under `DependencyRadar:Roots`, then run:

```bash
dotnet run --project src/Depmap.Service
```

If `localhost:5000` is occupied on your machine, use another port:

```bash
ASPNETCORE_URLS=http://localhost:5001 dotnet run --project src/Depmap.Service
```

API surface:

- `GET /api/status`
- `GET /api/graph`
- `POST /api/rescan`
- `GET /api/updates`

The backend is API-only. It does not host the frontend.

## Frontend

Run the frontend separately:

```bash
npm install --prefix src/Depmap.Web
npm run dev --prefix src/Depmap.Web
```

By default Vite runs on `http://localhost:5173` and proxies `/api/*` to `http://localhost:5001`.

If you want the frontend to target a different backend directly, set `VITE_API_BASE_URL`:

```bash
VITE_API_BASE_URL=http://localhost:5001 npm run dev --prefix src/Depmap.Web
```

## Local development

Run backend and frontend as separate processes:

```bash
ASPNETCORE_URLS=http://localhost:5001 dotnet run --project src/Depmap.Service
npm install --prefix src/Depmap.Web
npm run dev --prefix src/Depmap.Web
```

## VS Code

Shared VS Code launch and task config is in [.vscode](/Users/charles/Documents/Claude/Projects/dependancyMap/.vscode):

- `Dependency Radar: Backend (.NET)` — builds and debugs `DependencyRadar.Service` on `http://localhost:5001`
- `Dependency Radar: Web (Chrome)` — starts Vite on `http://localhost:5173` and opens the React app
- `Dependency Radar: Full Stack` — starts both launch targets together

## Rider

Shared run configs are in [.run](/Users/charles/Documents/Claude/Projects/dependancyMap/.run):

- `Dependency Radar Backend (Fixtures)` — runs the backend in `Development` against `test/fixtures`

## Docker

The checked-in [Dockerfile](/Users/charles/Documents/Claude/Projects/dependancyMap/Dockerfile) builds the backend only.

Build:

```bash
docker build -t dependency-radar .
```

Run:

```bash
docker run --rm -p 8080:8080 -v /path/to/repos:/repos dependency-radar
```

If you want a different mount point, override `DependencyRadar__Roots__0`:

```bash
docker run --rm -p 8080:8080 \
  -e DependencyRadar__Roots__0=/workspace \
  -v /path/to/repos:/workspace \
  dependency-radar
```

The frontend is not served by this container. Point your separately running frontend at `http://localhost:8080`.

## Repository layout

```text
src/Depmap.Core/        shared scanner logic
src/Depmap.Service/     backend API
src/Depmap.Web/         React frontend
test/Depmap.Tests/      xunit unit tests
test/fixtures/          synthetic multi-repo fixture estate
```

## Notes

- Multi-targeted projects are represented as a single node; dependency edges are the union across TFMs.
- Packages whose producer cannot be resolved locally remain `unknown`.
- The tool never calls nuget.org or any external metadata service.

## License

Dependency Radar is licensed under the MIT License. See [LICENSE](/Users/charles/Documents/Claude/Projects/dependancyMap/LICENSE).
