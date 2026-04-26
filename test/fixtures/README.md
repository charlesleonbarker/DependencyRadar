# Fixture estate

This folder is the synthetic multi-repo test estate for Dependency Radar.

Run the backend against it:

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5001 dotnet run --project src/DependencyRadar.Service
```

Run the frontend separately:

```bash
npm install --prefix src/DependencyRadar.Web
npm run dev --prefix src/DependencyRadar.Web
```

Then open `http://localhost:5173`.
