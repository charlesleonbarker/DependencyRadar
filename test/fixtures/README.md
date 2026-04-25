# Fixture estate

This folder is the synthetic multi-repo test estate for Dependency Radar.

Run the backend against it:

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5001 dotnet run --project src/Depmap.Service
```

Run the frontend separately:

```bash
npm install --prefix src/Depmap.Web
npm run dev --prefix src/Depmap.Web
```

Then open `http://localhost:5173`.
