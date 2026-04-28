import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useState } from "react";
import type { DependencyRadarGraph, ProjectKind } from "../api/types";
import { GraphCanvas } from "../components/GraphCanvas";
import { buildModel } from "../domain/graphModel";
import { DEFAULT_KINDS } from "../domain/projectKinds";
import { DEFAULT_VIEW_OPTIONS, type FilterState, type LayoutId } from "../graph/cytoscapeModel";
import type { ColorSchemeId } from "../theme/colorSchemes";

const GRAPH: DependencyRadarGraph = {
  root: "/repos",
  repos: [
    { id: "repo_platform", name: "platform-common", path: "/repos/platform-common" },
    { id: "repo_orders", name: "commerce-orders", path: "/repos/commerce-orders" },
    { id: "repo_billing", name: "finance-billing", path: "/repos/finance-billing" },
    { id: "repo_admin", name: "admin-portal", path: "/repos/admin-portal" },
  ],
  solutions: [
    { id: "sln_platform", name: "Platform.Common", path: "/repos/platform-common/Platform.Common.sln", repo: "repo_platform" },
    { id: "sln_orders", name: "Commerce.Orders", path: "/repos/commerce-orders/Commerce.Orders.sln", repo: "repo_orders" },
    { id: "sln_billing", name: "Finance.Billing", path: "/repos/finance-billing/Finance.Billing.sln", repo: "repo_billing" },
    { id: "sln_admin", name: "Admin.Portal", path: "/repos/admin-portal/Admin.Portal.sln", repo: "repo_admin" },
  ],
  projects: [
    {
      id: "proj_platform_common",
      name: "Platform.Common",
      path: "/repos/platform-common/src/Platform.Common/Platform.Common.csproj",
      repo: "repo_platform",
      sdk: "Microsoft.NET.Sdk",
      tfms: ["net8.0"],
      kinds: ["library", "nuget-producing"],
      packageId: "Meridian.Platform.Common",
      version: "3.4.1",
    },
    {
      id: "proj_platform_testing",
      name: "Platform.Testing",
      path: "/repos/platform-common/src/Platform.Testing/Platform.Testing.csproj",
      repo: "repo_platform",
      sdk: "Microsoft.NET.Sdk",
      tfms: ["net8.0"],
      kinds: ["test", "nuget-producing"],
      packageId: "Meridian.Platform.Testing",
      version: "1.8.0",
    },
    {
      id: "proj_orders_api",
      name: "Commerce.Orders.Api",
      path: "/repos/commerce-orders/src/Commerce.Orders.Api/Commerce.Orders.Api.csproj",
      repo: "repo_orders",
      sdk: "Microsoft.NET.Sdk.Web",
      tfms: ["net8.0"],
      kinds: ["web"],
    },
    {
      id: "proj_orders_domain",
      name: "Commerce.Orders.Domain",
      path: "/repos/commerce-orders/src/Commerce.Orders.Domain/Commerce.Orders.Domain.csproj",
      repo: "repo_orders",
      sdk: "Microsoft.NET.Sdk",
      tfms: ["net8.0"],
      kinds: ["library"],
    },
    {
      id: "proj_orders_tests",
      name: "Commerce.Orders.Integration.Tests",
      path: "/repos/commerce-orders/tests/Commerce.Orders.Integration.Tests/Commerce.Orders.Integration.Tests.csproj",
      repo: "repo_orders",
      sdk: "Microsoft.NET.Sdk",
      tfms: ["net8.0"],
      kinds: ["test"],
    },
    {
      id: "proj_billing_worker",
      name: "Finance.Billing.Worker",
      path: "/repos/finance-billing/src/Finance.Billing.Worker/Finance.Billing.Worker.csproj",
      repo: "repo_billing",
      sdk: "Microsoft.NET.Sdk.Worker",
      tfms: ["net8.0"],
      kinds: ["service"],
    },
    {
      id: "proj_billing_domain",
      name: "Finance.Billing.Domain",
      path: "/repos/finance-billing/src/Finance.Billing.Domain/Finance.Billing.Domain.csproj",
      repo: "repo_billing",
      sdk: "Microsoft.NET.Sdk",
      tfms: ["net8.0"],
      kinds: ["library"],
    },
    {
      id: "proj_admin_web",
      name: "Admin.Portal.Web",
      path: "/repos/admin-portal/src/Admin.Portal.Web/Admin.Portal.Web.csproj",
      repo: "repo_admin",
      sdk: "Microsoft.NET.Sdk.BlazorWebAssembly",
      tfms: ["net8.0"],
      kinds: ["blazor", "web"],
    },
    {
      id: "proj_admin_bff",
      name: "Admin.Portal.Bff",
      path: "/repos/admin-portal/src/Admin.Portal.Bff/Admin.Portal.Bff.csproj",
      repo: "repo_admin",
      sdk: "Microsoft.NET.Sdk.Web",
      tfms: ["net8.0"],
      kinds: ["web"],
    },
  ],
  packages: [
    {
      id: "pkg_meridian_platform_common",
      name: "Meridian.Platform.Common",
      versions: ["3.3.0", "3.4.1"],
      classification: "internal",
      producedBy: "proj_platform_common",
    },
    {
      id: "pkg_meridian_platform_testing",
      name: "Meridian.Platform.Testing",
      versions: ["1.8.0"],
      classification: "internal",
      producedBy: "proj_platform_testing",
    },
    { id: "pkg_serilog", name: "Serilog.AspNetCore", versions: ["8.0.1"], classification: "unknown" },
    { id: "pkg_polly", name: "Polly", versions: ["8.4.0"], classification: "unknown" },
    { id: "pkg_dapper", name: "Dapper", versions: ["2.1.35"], classification: "unknown" },
  ],
  edges: [
    { from: "sln_platform", to: "proj_platform_common", kind: "solutionContains" },
    { from: "sln_platform", to: "proj_platform_testing", kind: "solutionContains" },
    { from: "sln_orders", to: "proj_orders_api", kind: "solutionContains" },
    { from: "sln_orders", to: "proj_orders_domain", kind: "solutionContains" },
    { from: "sln_orders", to: "proj_orders_tests", kind: "solutionContains" },
    { from: "sln_billing", to: "proj_billing_worker", kind: "solutionContains" },
    { from: "sln_billing", to: "proj_billing_domain", kind: "solutionContains" },
    { from: "sln_admin", to: "proj_admin_web", kind: "solutionContains" },
    { from: "sln_admin", to: "proj_admin_bff", kind: "solutionContains" },
    { from: "proj_orders_api", to: "proj_orders_domain", kind: "projectRef" },
    { from: "proj_orders_tests", to: "proj_orders_api", kind: "projectRef" },
    { from: "proj_billing_worker", to: "proj_billing_domain", kind: "projectRef" },
    { from: "proj_admin_web", to: "proj_admin_bff", kind: "projectRef" },
    { from: "proj_admin_bff", to: "proj_orders_api", kind: "projectRef" },
    { from: "proj_orders_domain", to: "pkg_meridian_platform_common", kind: "packageRef", version: "3.4.1" },
    { from: "proj_billing_domain", to: "pkg_meridian_platform_common", kind: "packageRef", version: "3.3.0" },
    { from: "proj_admin_bff", to: "pkg_meridian_platform_common", kind: "packageRef", version: "3.4.1" },
    { from: "proj_orders_tests", to: "pkg_meridian_platform_testing", kind: "packageRef", version: "1.8.0" },
    { from: "pkg_meridian_platform_common", to: "proj_platform_common", kind: "producedBy" },
    { from: "pkg_meridian_platform_testing", to: "proj_platform_testing", kind: "producedBy" },
    { from: "proj_orders_api", to: "pkg_serilog", kind: "packageRef", version: "8.0.1" },
    { from: "proj_billing_worker", to: "pkg_polly", kind: "packageRef", version: "8.4.0" },
    { from: "proj_billing_domain", to: "pkg_dapper", kind: "packageRef", version: "2.1.35" },
  ],
};

const ALL_KINDS: Record<ProjectKind, boolean> = Object.fromEntries(
  DEFAULT_KINDS.map((kind) => [kind, true]),
) as Record<ProjectKind, boolean>;

const ALL_REPOS: Record<string, boolean> = Object.fromEntries(
  GRAPH.repos.map((repo) => [repo.id, true]),
);

/** Named project-kind filter states exposed as Storybook controls. */
type GraphKindPreset = "all" | "runtime-only" | "tests-hidden";

/** Named repository filter states exposed as Storybook controls. */
type GraphRepoPreset = "all" | "commerce-only" | "hide-admin";

/** Named hover routes that exercise Impact Panel path highlighting. */
type HoverPathPreset = "none" | "internal-package-route" | "external-package-route";

interface GraphStoryProps {
  /** Layout algorithm used by Cytoscape for this graph run. */
  layout: LayoutId;
  /** Node id selected when the story loads. */
  selectionId?: string | null;
  /** Shows compound repository boxes around project nodes. */
  groupByRepo?: boolean;
  /** Shows external/unknown NuGet package nodes. */
  showExternal?: boolean;
  /** Project-kind filter preset applied to visible project nodes. */
  kindPreset?: GraphKindPreset;
  /** Repository filter preset applied to visible project nodes. */
  repoPreset?: GraphRepoPreset;
  /** Predefined Impact Panel hover path for route-focus states. */
  hoverPathPreset?: HoverPathPreset;
  /** Layout spacing, from compact to spacious. */
  density?: number;
  /** Simulated left overlay width used by viewport fitting logic. */
  leftInset?: number;
  /** Color scheme used by graph and app chrome tokens. */
  colorScheme?: ColorSchemeId;
}

function kindFiltersForPreset(preset: GraphKindPreset): Record<ProjectKind, boolean> {
  if (preset === "runtime-only") {
    return { ...ALL_KINDS, library: false, test: false, "nuget-producing": false };
  }

  if (preset === "tests-hidden") {
    return { ...ALL_KINDS, test: false };
  }

  return ALL_KINDS;
}

function repoFiltersForPreset(preset: GraphRepoPreset): Record<string, boolean> {
  if (preset === "commerce-only") {
    return { ...ALL_REPOS, repo_platform: false, repo_billing: false, repo_admin: false };
  }

  if (preset === "hide-admin") {
    return { ...ALL_REPOS, repo_admin: false };
  }

  return ALL_REPOS;
}

function hoverPathForPreset(preset: HoverPathPreset): string[][] | null {
  if (preset === "internal-package-route") {
    return [["proj_platform_common", "pkg_meridian_platform_common", "proj_orders_domain", "proj_orders_api"]];
  }

  if (preset === "external-package-route") {
    return [["proj_billing_worker", "proj_billing_domain", "pkg_dapper"]];
  }

  return null;
}

function GraphStory({
  layout,
  selectionId: initialSelectionId = null,
  groupByRepo = true,
  showExternal = false,
  kindPreset = "all",
  repoPreset = "all",
  hoverPathPreset = "none",
  density = DEFAULT_VIEW_OPTIONS.density,
  leftInset = 0,
  colorScheme = "dark",
}: GraphStoryProps) {
  const model = useMemo(() => buildModel(GRAPH), []);
  const [selectionId, setSelectionId] = useState<string | null>(initialSelectionId);
  useEffect(() => {
    setSelectionId(initialSelectionId);
  }, [initialSelectionId]);

  const filterState = useMemo<FilterState>(
    () => ({
      kindFilters: kindFiltersForPreset(kindPreset),
      repoFilters: repoFiltersForPreset(repoPreset),
      showExternal,
      focusIds: null,
    }),
    [kindPreset, repoPreset, showExternal],
  );
  const hoverPathIds = useMemo(() => hoverPathForPreset(hoverPathPreset), [hoverPathPreset]);

  return (
    <div className="app-shell" data-color-scheme={colorScheme}>
      <main className="canvas">
        <div className="canvas-inner">
          <div className="canvas-stage">
            <GraphCanvas
              graph={GRAPH}
              model={model}
              selectionId={selectionId}
              hoverPathIds={hoverPathIds}
              viewportResetKey={0}
              onSelectionChange={setSelectionId}
              layout={layout}
              layoutRunKey={0}
              groupByRepo={groupByRepo}
              filterState={filterState}
              viewOptions={{ density }}
              searchText=""
              status={{ state: "ready" }}
              leftInset={leftInset}
              styleKey={colorScheme}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

const meta: Meta<typeof GraphStory> = {
  title: "Graph / GraphCanvas",
  component: GraphStory,
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true,
    },
  },
  argTypes: {
    layout: {
      control: "radio",
      options: ["fcose", "dagre", "concentric"],
    },
    selectionId: {
      control: "select",
      options: [null, ...GRAPH.projects.map((project) => project.id), ...GRAPH.packages.map((pkg) => pkg.id)],
    },
    groupByRepo: { control: "boolean" },
    showExternal: { control: "boolean" },
    kindPreset: {
      control: "radio",
      options: ["all", "runtime-only", "tests-hidden"],
    },
    repoPreset: {
      control: "radio",
      options: ["all", "commerce-only", "hide-admin"],
    },
    hoverPathPreset: {
      control: "radio",
      options: ["none", "internal-package-route", "external-package-route"],
    },
    density: {
      control: { type: "range", min: 0, max: 1, step: 0.05 },
    },
    leftInset: {
      control: { type: "range", min: 0, max: 520, step: 20 },
    },
    colorScheme: {
      control: "select",
      options: ["dark", "light", "okabe-ito"],
    },
  },
  args: {
    layout: "fcose",
    selectionId: null,
    groupByRepo: true,
    showExternal: false,
    kindPreset: "all",
    repoPreset: "all",
    hoverPathPreset: "none",
    ...DEFAULT_VIEW_OPTIONS,
    leftInset: 0,
    colorScheme: "dark",
  },
};
export default meta;

type Story = StoryObj<typeof GraphStory>;

export const ClusterMap: Story = {
  name: "Cluster map — grouped repos",
};

export const DependencyPaths: Story = {
  name: "Dependency paths — left to right",
  args: { layout: "dagre" },
};

export const MostReferenced: Story = {
  name: "Most referenced — concentric",
  args: { layout: "concentric" },
};

export const SelectedInternalPackageProducer: Story = {
  name: "Selection — internal NuGet producer",
  args: { selectionId: "proj_platform_common" },
};

export const ExternalPackagesVisible: Story = {
  name: "Filters — external packages visible",
  args: { showExternal: true },
};

export const HoveredImpactPath: Story = {
  name: "Impact Panel hover — route focus",
  args: {
    selectionId: "proj_platform_common",
    hoverPathPreset: "internal-package-route",
  },
};

export const Ungrouped: Story = {
  name: "Repositories hidden",
  args: { groupByRepo: false, showExternal: true },
};
