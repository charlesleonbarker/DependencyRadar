import type { DependencyRadarGraph, GraphEdge, PackageNode, ProjectNode, RepoNode } from "../api/types";
import { buildModel, describeSelection, type SelectionDetails } from "../domain/graphModel";

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function repo(id: string, name: string, path = `/repos/${name}`): RepoNode {
  return { id, name, path };
}

function project(
  id: string,
  name: string,
  repoId: string,
  kinds: ProjectNode["kinds"],
  extra: Partial<ProjectNode> = {},
): ProjectNode {
  return {
    id,
    name,
    assemblyName: `Meridian.${name}`,
    path: `/repos/${repoId}/src/${name}/${name}.csproj`,
    repo: repoId,
    kinds,
    sdk: kinds?.includes("web")
      ? "Microsoft.NET.Sdk.Web"
      : kinds?.includes("blazor")
        ? "Microsoft.NET.Sdk.BlazorWebAssembly"
        : kinds?.includes("service")
          ? "Microsoft.NET.Sdk.Worker"
          : "Microsoft.NET.Sdk",
    tfms: ["net8.0"],
    ...extra,
  };
}

function pkg(
  id: string,
  name: string,
  classification: PackageNode["classification"],
  producedBy: string | undefined,
  versions: string[],
): PackageNode {
  return { id, name, classification, producedBy, versions };
}

function producedBy(pkgId: string, projId: string): GraphEdge {
  return { from: pkgId, to: projId, kind: "producedBy" };
}

function packageRef(fromProjId: string, toPkgId: string, version?: string): GraphEdge {
  return { from: fromProjId, to: toPkgId, kind: "packageRef", version };
}

function projectRef(fromId: string, toId: string): GraphEdge {
  return { from: fromId, to: toId, kind: "projectRef" };
}

function makeGraph(parts: {
  repos: RepoNode[];
  projects: ProjectNode[];
  packages: PackageNode[];
  edges: GraphEdge[];
}): DependencyRadarGraph {
  return { repos: parts.repos, solutions: [], projects: parts.projects, packages: parts.packages, edges: parts.edges };
}

function select(graph: DependencyRadarGraph, nodeId: string): SelectionDetails {
  const model = buildModel(graph);
  const result = describeSelection(model, nodeId);
  if (!result) throw new Error(`No selection for ${nodeId}`);
  return result;
}

// ---------------------------------------------------------------------------
// Fixture 1: Shared NuGet-producing library with many consumers
// Shows: Affected Tests, Affected Deployments, version pills, Direct Package badges
// ---------------------------------------------------------------------------

const R_PLATFORM = "repo_platform";
const R_ORDERS = "repo_orders";
const R_BILLING = "repo_billing";

const P_PLATFORM_CORE = "proj_platform_core";
const P_ORDERS_API = "proj_orders_api";
const P_ORDERS_TESTS = "proj_orders_tests";
const P_BILLING_WORKER = "proj_billing_worker";
const P_BILLING_TESTS = "proj_billing_tests";

const PKG_PLATFORM_CORE = "pkg_platform_core";
const PKG_SERILOG = "pkg_serilog";
const PKG_XUNIT = "pkg_xunit";

const sharedLibraryGraph = makeGraph({
  repos: [repo(R_PLATFORM, "platform-core"), repo(R_ORDERS, "orders-service"), repo(R_BILLING, "billing-service")],
  projects: [
    project(P_PLATFORM_CORE, "Platform.Core.Common", R_PLATFORM, ["library", "nuget-producing"], { version: "2.1.0", packageId: "Meridian.Platform.Core.Common" }),
    project(P_ORDERS_API, "Commerce.Orders.Api", R_ORDERS, ["web"]),
    project(P_ORDERS_TESTS, "Commerce.Orders.Integration.Tests", R_ORDERS, ["test"]),
    project(P_BILLING_WORKER, "Finance.Billing.Worker", R_BILLING, ["service"]),
    project(P_BILLING_TESTS, "Finance.Billing.Integration.Tests", R_BILLING, ["test"]),
  ],
  packages: [
    pkg(PKG_PLATFORM_CORE, "Meridian.Platform.Core.Common", "internal", P_PLATFORM_CORE, ["2.1.0"]),
    pkg(PKG_SERILOG, "Serilog.AspNetCore", "unknown", undefined, ["8.0.1"]),
    pkg(PKG_XUNIT, "xunit", "unknown", undefined, ["2.6.2"]),
  ],
  edges: [
    producedBy(PKG_PLATFORM_CORE, P_PLATFORM_CORE),
    packageRef(P_ORDERS_API, PKG_PLATFORM_CORE, "2.1.0"),
    packageRef(P_ORDERS_API, PKG_SERILOG, "8.0.1"),
    packageRef(P_ORDERS_TESTS, PKG_PLATFORM_CORE, "2.1.0"),
    packageRef(P_ORDERS_TESTS, PKG_XUNIT, "2.6.2"),
    packageRef(P_BILLING_WORKER, PKG_PLATFORM_CORE, "2.1.0"),
    packageRef(P_BILLING_TESTS, PKG_PLATFORM_CORE, "2.1.0"),
    packageRef(P_BILLING_TESTS, PKG_XUNIT, "2.6.2"),
  ],
});

export const sharedLibrarySelection = select(sharedLibraryGraph, P_PLATFORM_CORE);

// ---------------------------------------------------------------------------
// Fixture 2: Version drift — same package consumed at 3 different versions
// Shows: version drift badge, per-consumer version pills, 3-way drift
// ---------------------------------------------------------------------------

const R_PORTAL = "repo_portal";
const R_LEGACY = "repo_legacy";

const P_COMMON = "proj_common";
const P_ORDERS_DOMAIN = "proj_orders_domain";
const P_PORTAL_CORE = "proj_portal_core";
const P_PORTAL_LEGACY = "proj_portal_legacy";
const P_PLATFORM_TESTS2 = "proj_platform_tests";

const PKG_COMMON = "pkg_common";

const versionDriftGraph = makeGraph({
  repos: [repo(R_PLATFORM, "platform-core"), repo(R_ORDERS, "orders-service"), repo(R_PORTAL, "admin-portal"), repo(R_LEGACY, "legacy-portal")],
  projects: [
    project(P_COMMON, "Platform.Core.Common", R_PLATFORM, ["library", "nuget-producing"], { version: "1.5.0", packageId: "Meridian.Platform.Core.Common" }),
    project(P_ORDERS_DOMAIN, "Commerce.Orders.Domain", R_ORDERS, ["library"]),
    project(P_PORTAL_CORE, "Admin.Portal.Core", R_PORTAL, ["library"]),
    project(P_PORTAL_LEGACY, "Admin.Portal.Legacy", R_LEGACY, ["library"], { tfms: ["net6.0"] }),
    project(P_PLATFORM_TESTS2, "Platform.Core.Common.Tests", R_PLATFORM, ["test"]),
  ],
  packages: [
    pkg(PKG_COMMON, "Meridian.Platform.Core.Common", "internal", P_COMMON, ["1.1.0", "1.3.0", "1.5.0"]),
  ],
  edges: [
    producedBy(PKG_COMMON, P_COMMON),
    packageRef(P_ORDERS_DOMAIN, PKG_COMMON, "1.5.0"),
    packageRef(P_PORTAL_CORE, PKG_COMMON, "1.3.0"),
    packageRef(P_PORTAL_LEGACY, PKG_COMMON, "1.1.0"),
    packageRef(P_PLATFORM_TESTS2, PKG_COMMON, "1.5.0"),
  ],
});

export const versionDriftSelection = select(versionDriftGraph, P_COMMON);

// ---------------------------------------------------------------------------
// Fixture 3: God object — crosses 5 bounded contexts, all stale versions, zero consumers
// Shows: deep All Dependencies list, all stale version pills, no consumers
// ---------------------------------------------------------------------------

const R_IDENTITY = "repo_identity";
const R_ANALYTICS = "repo_analytics";
const R_BILLING2 = "repo_billing2";

const P_ADMIN_CORE = "proj_admin_core";
const P_IDENTITY_CONTRACTS = "proj_identity_contracts";
const P_ANALYTICS_CONTRACTS = "proj_analytics_contracts";
const P_ORDERS_CONTRACTS = "proj_orders_contracts";
const P_BILLING_CONTRACTS = "proj_billing_contracts";
const P_PLATFORM_COMMON = "proj_platform_common";

const PKG_IDENTITY = "pkg_identity";
const PKG_ANALYTICS = "pkg_analytics";
const PKG_ORDERS = "pkg_orders";
const PKG_BILLING = "pkg_billing";
const PKG_PLATFORM_COMMON = "pkg_platform_common";

const godObjectGraph = makeGraph({
  repos: [
    repo(R_PORTAL, "admin-portal"),
    repo(R_IDENTITY, "meridian-identity-service"),
    repo(R_ANALYTICS, "meridian-reporting-analytics"),
    repo(R_ORDERS, "meridian-commerce-orders"),
    repo(R_BILLING2, "meridian-finance-billing"),
    repo(R_PLATFORM, "meridian-platform-core"),
  ],
  projects: [
    project(P_ADMIN_CORE, "Admin.Portal.Core", R_PORTAL, ["library"]),
    project(P_IDENTITY_CONTRACTS, "Identity.Service.Contracts", R_IDENTITY, ["library", "nuget-producing"], { version: "2.0.0" }),
    project(P_ANALYTICS_CONTRACTS, "Reporting.Analytics.Contracts", R_ANALYTICS, ["library", "nuget-producing"], { version: "1.0.0" }),
    project(P_ORDERS_CONTRACTS, "Commerce.Orders.Contracts", R_ORDERS, ["library", "nuget-producing"], { version: "1.4.0" }),
    project(P_BILLING_CONTRACTS, "Finance.Billing.Contracts", R_BILLING2, ["library", "nuget-producing"], { version: "1.0.0" }),
    project(P_PLATFORM_COMMON, "Platform.Core.Common", R_PLATFORM, ["library", "nuget-producing"], { version: "1.5.0" }),
  ],
  packages: [
    pkg(PKG_IDENTITY, "Meridian.Identity.Service.Contracts", "internal", P_IDENTITY_CONTRACTS, ["1.5.0", "2.0.0"]),
    pkg(PKG_ANALYTICS, "Meridian.Reporting.Analytics.Contracts", "internal", P_ANALYTICS_CONTRACTS, ["0.9.0", "1.0.0"]),
    pkg(PKG_ORDERS, "Meridian.Commerce.Orders.Contracts", "internal", P_ORDERS_CONTRACTS, ["1.2.0", "1.4.0"]),
    pkg(PKG_BILLING, "Meridian.Finance.Billing.Contracts", "internal", P_BILLING_CONTRACTS, ["0.8.0", "1.0.0"]),
    pkg(PKG_PLATFORM_COMMON, "Meridian.Platform.Core.Common", "internal", P_PLATFORM_COMMON, ["1.1.0", "1.3.0", "1.5.0"]),
  ],
  edges: [
    producedBy(PKG_IDENTITY, P_IDENTITY_CONTRACTS),
    producedBy(PKG_ANALYTICS, P_ANALYTICS_CONTRACTS),
    producedBy(PKG_ORDERS, P_ORDERS_CONTRACTS),
    producedBy(PKG_BILLING, P_BILLING_CONTRACTS),
    producedBy(PKG_PLATFORM_COMMON, P_PLATFORM_COMMON),
    packageRef(P_ADMIN_CORE, PKG_IDENTITY, "1.5.0"),
    packageRef(P_ADMIN_CORE, PKG_ANALYTICS, "0.9.0"),
    packageRef(P_ADMIN_CORE, PKG_ORDERS, "1.2.0"),
    packageRef(P_ADMIN_CORE, PKG_BILLING, "0.8.0"),
    packageRef(P_ADMIN_CORE, PKG_PLATFORM_COMMON, "1.3.0"),
  ],
});

export const godObjectSelection = select(godObjectGraph, P_ADMIN_CORE);

// ---------------------------------------------------------------------------
// Fixture 4: Orphaned library — no consumers, net6.0, external + internal deps
// Shows: empty Consumers section, TFM label, external packages visible
// ---------------------------------------------------------------------------

const P_LEGACY = "proj_legacy";
const P_PLATFORM_COMMON2 = "proj_platform_common2";
const PKG_COMMON2 = "pkg_common2";
const PKG_NEWTONSOFT = "pkg_newtonsoft";

const orphanedGraph = makeGraph({
  repos: [repo(R_LEGACY, "admin-portal"), repo(R_PLATFORM, "platform-core")],
  projects: [
    project(P_LEGACY, "Admin.Portal.Legacy", R_LEGACY, ["library"], { tfms: ["net6.0"], sdk: "Microsoft.NET.Sdk" }),
    project(P_PLATFORM_COMMON2, "Platform.Core.Common", R_PLATFORM, ["library", "nuget-producing"], { version: "1.5.0" }),
  ],
  packages: [
    pkg(PKG_COMMON2, "Meridian.Platform.Core.Common", "internal", P_PLATFORM_COMMON2, ["1.5.0"]),
    pkg(PKG_NEWTONSOFT, "Newtonsoft.Json", "unknown", undefined, ["13.0.1"]),
  ],
  edges: [
    producedBy(PKG_COMMON2, P_PLATFORM_COMMON2),
    packageRef(P_LEGACY, PKG_COMMON2, "1.1.0"),
    packageRef(P_LEGACY, PKG_NEWTONSOFT, "13.0.1"),
  ],
});

export const orphanedSelection = select(orphanedGraph, P_LEGACY);
export const orphanedSelectionWithExternal: SelectionDetails = { ...orphanedSelection };

// ---------------------------------------------------------------------------
// Fixture 5: Test project accidentally marked nuget-producing
// Shows: dual kind pills (test + nuget-producing), direct project dependency
// ---------------------------------------------------------------------------

const R_ADMIN2 = "repo_admin2";
const P_WEB = "proj_web";
const P_WEB_TESTS = "proj_web_tests";
const PKG_WEBASSEMBLY = "pkg_webassembly";

const testNugetProducingGraph = makeGraph({
  repos: [repo(R_ADMIN2, "admin-portal")],
  projects: [
    project(P_WEB, "Admin.Portal.Web", R_ADMIN2, ["blazor"], { sdk: "Microsoft.NET.Sdk.BlazorWebAssembly" }),
    project(P_WEB_TESTS, "Admin.Portal.Web.Tests", R_ADMIN2, ["test", "nuget-producing"]),
  ],
  packages: [
    pkg(PKG_WEBASSEMBLY, "Microsoft.AspNetCore.Components.WebAssembly", "unknown", undefined, ["8.0.0"]),
  ],
  edges: [
    projectRef(P_WEB_TESTS, P_WEB),
    packageRef(P_WEB, PKG_WEBASSEMBLY, "8.0.0"),
  ],
});

export const testNugetProducingSelection = select(testNugetProducingGraph, P_WEB_TESTS);

// ---------------------------------------------------------------------------
// Fixture 6: Selecting an internal package node — shows "Open producer" banner
// Shows: producedByProject banner, consumers, packageRef version pills
// ---------------------------------------------------------------------------

const P_PLATFORM_CORE2 = "proj_platform_core2";
const P_ORDERS_API2 = "proj_orders_api2";
const P_ORDERS_TESTS2 = "proj_orders_tests2";
const P_BILLING_WORKER2 = "proj_billing_worker2";
const PKG_CORE2 = "pkg_core2";
const PKG_XUNIT2 = "pkg_xunit2";

const internalPackageGraph = makeGraph({
  repos: [repo(R_PLATFORM, "platform-core"), repo(R_ORDERS, "orders-service"), repo(R_BILLING, "billing-service")],
  projects: [
    project(P_PLATFORM_CORE2, "Platform.Core.Common", R_PLATFORM, ["library", "nuget-producing"], { version: "3.1.0", packageId: "Meridian.Platform.Core.Common" }),
    project(P_ORDERS_API2, "Commerce.Orders.Api", R_ORDERS, ["web"]),
    project(P_ORDERS_TESTS2, "Commerce.Orders.Tests", R_ORDERS, ["test"]),
    project(P_BILLING_WORKER2, "Finance.Billing.Worker", R_BILLING, ["service"]),
  ],
  packages: [
    pkg(PKG_CORE2, "Meridian.Platform.Core.Common", "internal", P_PLATFORM_CORE2, ["3.1.0"]),
    pkg(PKG_XUNIT2, "xunit", "unknown", undefined, ["2.6.2"]),
  ],
  edges: [
    producedBy(PKG_CORE2, P_PLATFORM_CORE2),
    packageRef(P_ORDERS_API2, PKG_CORE2, "3.1.0"),
    packageRef(P_ORDERS_TESTS2, PKG_CORE2, "3.1.0"),
    packageRef(P_ORDERS_TESTS2, PKG_XUNIT2, "2.6.2"),
    packageRef(P_BILLING_WORKER2, PKG_CORE2, "3.1.0"),
  ],
});

export const internalPackageNodeSelection = select(internalPackageGraph, PKG_CORE2);

// ---------------------------------------------------------------------------
// Fixture 7: External / unknown package
// Shows: classification label, unknown package node display
// ---------------------------------------------------------------------------

const P_ORDERS_INFRA = "proj_orders_infra";
const PKG_POLLY = "pkg_polly";
const PKG_NEWTONSOFT2 = "pkg_newtonsoft2";

const externalPackageGraph = makeGraph({
  repos: [repo(R_ORDERS, "orders-service")],
  projects: [
    project(P_ORDERS_INFRA, "Commerce.Orders.Infrastructure", R_ORDERS, ["library"]),
  ],
  packages: [
    pkg(PKG_POLLY, "Polly", "unknown", undefined, ["8.4.0"]),
    pkg(PKG_NEWTONSOFT2, "Newtonsoft.Json", "unknown", undefined, ["13.0.3"]),
  ],
  edges: [
    packageRef(P_ORDERS_INFRA, PKG_POLLY, "8.4.0"),
    packageRef(P_ORDERS_INFRA, PKG_NEWTONSOFT2, "13.0.3"),
  ],
});

export const externalPackageSelection = select(externalPackageGraph, PKG_POLLY);

// ---------------------------------------------------------------------------
// Fixture 8: Repo selection — all admin-portal projects, cross-repo consumers
// Shows: repo Projects section, Affected Tests/Deployments from other repos
// ---------------------------------------------------------------------------

const R_ADMIN_PORTAL = "repo_admin_portal";
const R_PLATFORM3 = "repo_platform3";
const R_ORDERS3 = "repo_orders3";

const P_ADMIN_CORE3 = "proj_admin_core3";
const P_ADMIN_BFF = "proj_admin_bff";
const P_ADMIN_WEB = "proj_admin_web";
const P_ADMIN_LEGACY = "proj_admin_legacy";
const P_ADMIN_UTILITIES = "proj_admin_utilities";
const P_ADMIN_WEB_TESTS = "proj_admin_web_tests";
const P_ADMIN_CORE_TESTS = "proj_admin_core_tests";
const P_ADMIN_INTEGRATION = "proj_admin_integration";

const PKG_ADMIN_CONTRACTS = "pkg_admin_contracts";

const repoSelectionGraph = makeGraph({
  repos: [
    repo(R_ADMIN_PORTAL, "admin-portal"),
    repo(R_PLATFORM3, "platform-core"),
    repo(R_ORDERS3, "orders-service"),
  ],
  projects: [
    project(P_ADMIN_CORE3, "Admin.Portal.Core", R_ADMIN_PORTAL, ["library"]),
    project(P_ADMIN_BFF, "Admin.Portal.Bff", R_ADMIN_PORTAL, ["web"]),
    project(P_ADMIN_WEB, "Admin.Portal.Web", R_ADMIN_PORTAL, ["blazor"]),
    project(P_ADMIN_LEGACY, "Admin.Portal.Legacy", R_ADMIN_PORTAL, ["library"], { tfms: ["net6.0"] }),
    project(P_ADMIN_UTILITIES, "Admin.Portal.Utilities", R_ADMIN_PORTAL, ["library"]),
    project(P_ADMIN_WEB_TESTS, "Admin.Portal.Web.Tests", R_ADMIN_PORTAL, ["test", "nuget-producing"]),
    project(P_ADMIN_CORE_TESTS, "Admin.Portal.Core.Tests", R_ADMIN_PORTAL, ["test"]),
    project(P_ADMIN_INTEGRATION, "Admin.Portal.Integration.Tests", R_ADMIN_PORTAL, ["test"]),
  ],
  packages: [
    pkg(PKG_ADMIN_CONTRACTS, "Meridian.Admin.Portal.Contracts", "internal", P_ADMIN_CORE3, ["1.0.0"]),
  ],
  edges: [
    producedBy(PKG_ADMIN_CONTRACTS, P_ADMIN_CORE3),
    projectRef(P_ADMIN_BFF, P_ADMIN_CORE3),
    projectRef(P_ADMIN_WEB_TESTS, P_ADMIN_WEB),
    projectRef(P_ADMIN_CORE_TESTS, P_ADMIN_CORE3),
    projectRef(P_ADMIN_INTEGRATION, P_ADMIN_BFF),
    projectRef(P_ADMIN_INTEGRATION, P_ADMIN_CORE3),
    projectRef(P_ADMIN_INTEGRATION, P_ADMIN_UTILITIES),
    projectRef(P_ADMIN_UTILITIES, P_ADMIN_CORE3),
  ],
});

export const repoSelection = select(repoSelectionGraph, R_ADMIN_PORTAL);

// ---------------------------------------------------------------------------
// Fixture 9: Production code referencing test helper (bad practice)
// Shows: test-classified package in All Dependencies
// ---------------------------------------------------------------------------

const R_ADMIN3 = "repo_admin3";
const P_ADMIN_UTILS2 = "proj_admin_utils2";
const P_ADMIN_CORE4 = "proj_admin_core4";
const P_TESTING_PLATFORM = "proj_testing_platform";
const PKG_TESTING_ABSTRACTIONS = "pkg_testing_abstractions";
const PKG_CORE_ABSTRACTIONS = "pkg_core_abstractions";

const prodTestRefGraph = makeGraph({
  repos: [repo(R_ADMIN3, "admin-portal"), repo(R_PLATFORM, "platform-core"), repo("repo_testing", "platform-testing")],
  projects: [
    project(P_ADMIN_UTILS2, "Admin.Portal.Utilities", R_ADMIN3, ["library"]),
    project(P_ADMIN_CORE4, "Admin.Portal.Core", R_ADMIN3, ["library"]),
    project(P_TESTING_PLATFORM, "Platform.Testing.Abstractions", "repo_testing", ["test", "nuget-producing"], { version: "1.0.0" }),
  ],
  packages: [
    pkg(PKG_TESTING_ABSTRACTIONS, "Meridian.Platform.Testing.Abstractions", "internal", P_TESTING_PLATFORM, ["1.0.0"]),
    pkg(PKG_CORE_ABSTRACTIONS, "Meridian.Platform.Core.Abstractions", "internal", undefined, ["1.0.0"]),
  ],
  edges: [
    producedBy(PKG_TESTING_ABSTRACTIONS, P_TESTING_PLATFORM),
    projectRef(P_ADMIN_UTILS2, P_ADMIN_CORE4),
    packageRef(P_ADMIN_UTILS2, PKG_TESTING_ABSTRACTIONS, "1.0.0"),
    packageRef(P_ADMIN_UTILS2, PKG_CORE_ABSTRACTIONS, "1.0.0"),
  ],
});

export const prodTestRefSelection = select(prodTestRefGraph, P_ADMIN_UTILS2);

// ---------------------------------------------------------------------------
// Fixture 10: Multi-route multi-version — same consumer reached two ways,
// each route pinned to a different package version
// Shows: per-route version chips in the detail card
// ---------------------------------------------------------------------------

const R_INFRA = "repo_infra";
const R_SVC = "repo_svc";

const P_COMMON_MV = "proj_common_mv";
const P_DOMAIN_MV = "proj_domain_mv";
const P_API_MV = "proj_api_mv";
const P_WORKER_MV = "proj_worker_mv";
const P_TESTS_MV = "proj_tests_mv";

const PKG_COMMON_MV = "pkg_common_mv";

const multiVersionRouteGraph = makeGraph({
  repos: [repo(R_INFRA, "platform-infrastructure"), repo(R_SVC, "commerce-service")],
  projects: [
    project(P_COMMON_MV, "Platform.Infrastructure.Common", R_INFRA, ["library", "nuget-producing"], {
      version: "4.2.0",
      packageId: "Meridian.Platform.Infrastructure.Common",
    }),
    project(P_DOMAIN_MV, "Commerce.Service.Domain", R_SVC, ["library"]),
    project(P_API_MV, "Commerce.Service.Api", R_SVC, ["web"]),
    project(P_WORKER_MV, "Commerce.Service.Worker", R_SVC, ["service"]),
    project(P_TESTS_MV, "Commerce.Service.Integration.Tests", R_SVC, ["test"]),
  ],
  packages: [
    pkg(PKG_COMMON_MV, "Meridian.Platform.Infrastructure.Common", "internal", P_COMMON_MV, ["3.8.0", "4.2.0"]),
  ],
  edges: [
    producedBy(PKG_COMMON_MV, P_COMMON_MV),
    // Domain uses the older version
    packageRef(P_DOMAIN_MV, PKG_COMMON_MV, "3.8.0"),
    // Api uses the current version directly AND depends on Domain
    packageRef(P_API_MV, PKG_COMMON_MV, "4.2.0"),
    projectRef(P_API_MV, P_DOMAIN_MV),
    // Worker also depends on Domain (inherits the older indirect version)
    projectRef(P_WORKER_MV, P_DOMAIN_MV),
    // Tests reference Api
    projectRef(P_TESTS_MV, P_API_MV),
  ],
});

export const multiVersionRouteSelection = select(multiVersionRouteGraph, P_COMMON_MV);
