import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import type { ProjectKind, RepoNode } from "../api/types";
import { SearchFilterDock } from "../components/SearchFilterDock";
import type { SearchSuggestion } from "../domain/graphModel";
import { DEFAULT_KINDS } from "../domain/projectKinds";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const REPOS: RepoNode[] = [
  { id: "repo_platform", name: "platform-core", path: "/repos/platform-core" },
  { id: "repo_orders", name: "orders-service", path: "/repos/orders-service" },
  { id: "repo_billing", name: "billing-service", path: "/repos/billing-service" },
  { id: "repo_identity", name: "identity-service", path: "/repos/identity-service" },
  { id: "repo_analytics", name: "reporting-analytics", path: "/repos/reporting-analytics" },
  { id: "repo_portal", name: "admin-portal", path: "/repos/admin-portal" },
];

const SUGGESTIONS: SearchSuggestion[] = [
  { id: "proj_platform_core", label: "Platform.Core.Common", sublabel: "package Meridian.Platform.Core.Common", kinds: ["library", "nuget-producing"], type: "project" },
  { id: "proj_orders_api", label: "Commerce.Orders.Api", sublabel: undefined, kinds: ["web"], type: "project" },
  { id: "proj_orders_tests", label: "Commerce.Orders.Integration.Tests", kinds: ["test"], type: "project" },
  { id: "proj_billing_worker", label: "Finance.Billing.Worker", kinds: ["service"], type: "project" },
  { id: "proj_admin_web", label: "Admin.Portal.Web", kinds: ["blazor"], type: "project" },
  { id: "proj_admin_core", label: "Admin.Portal.Core", kinds: ["library"], type: "project" },
  { id: "proj_admin_utils", label: "Admin.Portal.Utilities", kinds: ["library"], type: "project" },
  { id: "proj_identity_contracts", label: "Identity.Service.Contracts", sublabel: "package Meridian.Identity.Service.Contracts", kinds: ["library", "nuget-producing"], type: "project" },
  { id: "proj_analytics_contracts", label: "Reporting.Analytics.Contracts", sublabel: "package Meridian.Reporting.Analytics.Contracts", kinds: ["library", "nuget-producing"], type: "project" },
  ...REPOS.map((r) => ({ id: r.id, label: r.name, type: "repo" as const })),
  { id: "pkg_polly", label: "Polly", sublabel: "unknown — v8.4.0", type: "package" },
  { id: "pkg_xunit", label: "xunit", sublabel: "unknown — v2.6.2", type: "package" },
  { id: "pkg_serilog", label: "Serilog.AspNetCore", sublabel: "unknown — v8.0.1", type: "package" },
];

const ALL_KINDS: Record<ProjectKind, boolean> = Object.fromEntries(
  DEFAULT_KINDS.map((k) => [k, true]),
) as Record<ProjectKind, boolean>;

const ALL_REPOS: Record<string, boolean> = Object.fromEntries(
  REPOS.map((r) => [r.id, true]),
);

/** Named project-kind filter states exposed as Storybook controls. */
type KindPreset = "all" | "without-tests-libraries";

/** Named repository filter states exposed as Storybook controls. */
type RepoPreset = "all" | "hide-reporting-admin";

interface SearchFilterDockStoryProps {
  /** Initial query text shown in the search input. */
  initialSearch: string;
  /** Opens the filter panel when the story loads. */
  initialFilterOpen: boolean;
  /** Preset for project-type filter coverage. */
  kindPreset: KindPreset;
  /** Preset for repository filter coverage. */
  repoPreset: RepoPreset;
  /** Shows external NuGet package nodes in the filter state. */
  initialShowPackages: boolean;
  /** Uses the compact repository filter variant shown while a node is selected. */
  compactRepoFilter: boolean;
}

function kindFiltersForPreset(preset: KindPreset): Record<ProjectKind, boolean> {
  if (preset === "without-tests-libraries") {
    return { ...ALL_KINDS, test: false, library: false };
  }

  return ALL_KINDS;
}

function repoFiltersForPreset(preset: RepoPreset): Record<string, boolean> {
  if (preset === "hide-reporting-admin") {
    return { ...ALL_REPOS, repo_portal: false, repo_analytics: false };
  }

  return ALL_REPOS;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof Controlled> = {
  title: "Search & Filter / SearchFilterDock",
  component: Controlled,
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true,
    },
  },
  argTypes: {
    initialSearch: { control: "text" },
    initialFilterOpen: { control: "boolean" },
    kindPreset: {
      control: "radio",
      options: ["all", "without-tests-libraries"],
    },
    repoPreset: {
      control: "radio",
      options: ["all", "hide-reporting-admin"],
    },
    initialShowPackages: { control: "boolean" },
    compactRepoFilter: { control: "boolean" },
  },
  args: {
    initialSearch: "",
    initialFilterOpen: false,
    kindPreset: "all",
    repoPreset: "all",
    initialShowPackages: false,
    compactRepoFilter: false,
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "16px", width: "min(720px, calc(100vw - 32px))" }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

// ---------------------------------------------------------------------------
// Controlled wrapper — makes stories interactive
// ---------------------------------------------------------------------------

function Controlled({
  initialSearch = "",
  initialFilterOpen = false,
  kindPreset = "all",
  repoPreset = "all",
  initialShowPackages = false,
  compactRepoFilter = false,
}: SearchFilterDockStoryProps) {
  const [searchText, setSearchText] = useState(initialSearch);
  const [filterOpen, setFilterOpen] = useState(initialFilterOpen);
  const [kindFilters, setKindFilters] = useState(kindFiltersForPreset(kindPreset));
  const [repoFilters, setRepoFilters] = useState(repoFiltersForPreset(repoPreset));
  const [showPackages, setShowPackages] = useState(initialShowPackages);

  useEffect(() => {
    setSearchText(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setFilterOpen(initialFilterOpen);
  }, [initialFilterOpen]);

  useEffect(() => {
    setKindFilters(kindFiltersForPreset(kindPreset));
  }, [kindPreset]);

  useEffect(() => {
    setRepoFilters(repoFiltersForPreset(repoPreset));
  }, [repoPreset]);

  useEffect(() => {
    setShowPackages(initialShowPackages);
  }, [initialShowPackages]);

  return (
    <SearchFilterDock
      searchText={searchText}
      setSearchText={setSearchText}
      suggestions={SUGGESTIONS}
      onSuggestionSelect={() => {}}
      repos={REPOS}
      compactRepoFilter={compactRepoFilter}
      filterOpen={filterOpen}
      setFilterOpen={setFilterOpen}
      kindFilters={kindFilters}
      setKindFilters={setKindFilters}
      repoFilters={repoFilters}
      setRepoFilters={setRepoFilters}
      showPackages={showPackages}
      setShowPackages={setShowPackages}
    />
  );
}

type Story = StoryObj<typeof Controlled>;

// ---------------------------------------------------------------------------
// Default — closed, no text
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — closed",
};

// ---------------------------------------------------------------------------
// Search open — shows all grouped suggestions
// ---------------------------------------------------------------------------

export const SearchAllSuggestions: Story = {
  name: "Search — all suggestions on focus",
};

// ---------------------------------------------------------------------------
// Search with typed query
// ---------------------------------------------------------------------------

export const SearchWithQuery: Story = {
  name: "Search — typed query matches",
  args: { initialSearch: "orders" },
};

// ---------------------------------------------------------------------------
// Search with no matches
// ---------------------------------------------------------------------------

export const SearchNoResults: Story = {
  name: "Search — no results",
  args: { initialSearch: "zzznomatch" },
};

// ---------------------------------------------------------------------------
// Filter panel open — all kinds active, all repos active
// ---------------------------------------------------------------------------

export const FilterOpen: Story = {
  name: "Filter — open, all active",
  args: { initialFilterOpen: true },
};

// ---------------------------------------------------------------------------
// Filter — some project kinds toggled off
// ---------------------------------------------------------------------------

export const FilterSomeKindsOff: Story = {
  name: "Filter — tests and libraries off",
  args: { initialFilterOpen: true, kindPreset: "without-tests-libraries" },
};

// ---------------------------------------------------------------------------
// Filter — external packages toggle on
// ---------------------------------------------------------------------------

export const FilterWithPackages: Story = {
  name: "Filter — external packages visible",
  args: { initialFilterOpen: true, initialShowPackages: true },
};

// ---------------------------------------------------------------------------
// Filter — some repos hidden
// ---------------------------------------------------------------------------

export const FilterSomeReposOff: Story = {
  name: "Filter — some repos hidden",
  args: { initialFilterOpen: true, repoPreset: "hide-reporting-admin" },
};

// ---------------------------------------------------------------------------
// Compact mode — active when a node is selected
// ---------------------------------------------------------------------------

export const CompactRepoFilter: Story = {
  name: "Filter — compact mode (node selected)",
  args: { initialFilterOpen: true, compactRepoFilter: true },
};
