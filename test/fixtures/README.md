# Fixtures

A larger synthetic set of .NET "repos" shaped like a realistic microservice estate, intended to exercise the scanner end-to-end across more complex project and package chains.

Run from the repo root:

```bash
dotnet run --project src/Depmap -- scan test/fixtures --output test/fixtures/depmap.html
```

Open `test/fixtures/depmap.html` in a browser.

## What's here

```text
fixtures/
├── common-libs/              core internal NuGets
├── platform-foundation/      internal package chain above common-libs
├── shared-testing/           internal testing helpers consumed by test projects
├── orders-service/           service repo consuming Acme.Common directly
├── customers-portal/         Blazor WASM frontend consuming Acme.Logging
├── workers/                  worker service consuming Acme.Common and Acme.Logging
├── inventory-platform/       mixed web/worker/test consumers of several internal packages
├── notifications-suite/      internal package producer consumed elsewhere
└── storefront/               downstream UI/BFF consumer of newer internal packages
```

## Fixture highlights

- `Acme.Common` and `Acme.Logging` are still the foundational internal packages.
- `Acme.Contracts` adds a cross-repo `ProjectReference` back to `Acme.Common`.
- `Acme.FeatureFlags` depends on both `Acme.Contracts` and the internal `Acme.Logging` package.
- `Acme.Testing` and `Acme.TestHost` create internal test-helper packages that only test projects consume.
- `Acme.Notifications` is a later-stage internal package produced in `notifications-suite` and consumed by `inventory-platform` and `storefront`.
- `Inventory.Api` and `Storefront.Bff` include synthetic `project.assets.json` files to exercise transitive package edge handling.

## Expected graph characteristics

- Several internal package chains should now exist:
  - `Acme.Common -> Acme.Contracts -> Acme.FeatureFlags`
  - `Acme.Contracts -> Acme.Testing -> Acme.TestHost`
  - `Acme.Contracts + Acme.Logging -> Acme.Notifications`
- Reverse-BFS from `Acme.Common` should spread far beyond the original four repos and reach consumers through:
  - direct `ProjectReference` edges
  - internal package `producedBy` edges
  - cross-repo internal package consumption
  - test projects that depend on internal test-helper packages
- Unknown packages such as `Newtonsoft.Json`, `FluentAssertions`, `Polly`, `Serilog.AspNetCore`, `Yarp.ReverseProxy`, and the synthetic transitive packages should remain clearly unresolved in the graph.

This fixture is intentionally scanner-focused rather than build-focused. The goal is to give the graph builder a richer estate to walk.
