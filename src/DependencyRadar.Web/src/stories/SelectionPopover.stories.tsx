import type { Meta, StoryObj } from "@storybook/react";
import type { ProjectKind } from "../api/types";
import { SelectionPopover } from "../components/SelectionPopover";
import {
  externalPackageSelection,
  godObjectSelection,
  internalPackageNodeSelection,
  multiVersionRouteSelection,
  orphanedSelection,
  prodTestRefSelection,
  repoSelection,
  sharedLibrarySelection,
  testNugetProducingSelection,
  versionDriftSelection,
} from "./fixtures";

const ALL_KINDS: Record<ProjectKind, boolean> = {
  library: true,
  test: true,
  web: true,
  blazor: true,
  service: true,
  "nuget-producing": true,
};

const meta: Meta<typeof SelectionPopover> = {
  title: "Impact Panel / SelectionPopover",
  component: SelectionPopover,
  parameters: { layout: "fullscreen" },
  args: {
    showExternal: false,
    kindFilters: ALL_KINDS,
    onClose: () => {},
    onSelect: () => {},
    onHoverPath: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", justifyContent: "flex-end", height: "100vh", padding: "16px", boxSizing: "border-box" }}>
        <div style={{ width: "340px", height: "100%", overflowY: "auto" }}>
          <Story />
        </div>
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof SelectionPopover>;

// ---------------------------------------------------------------------------
// NuGet-producing library — all four Impact Panel sections populated
// ---------------------------------------------------------------------------

export const SharedLibrary: Story = {
  name: "Shared library — all sections",
  args: { selection: sharedLibrarySelection },
};

// ---------------------------------------------------------------------------
// Version drift — same library consumed at 3 different versions
// ---------------------------------------------------------------------------

export const VersionDrift: Story = {
  name: "Version drift — 3 consumers, 3 versions",
  args: { selection: versionDriftSelection },
};

// ---------------------------------------------------------------------------
// God object — Admin.Portal.Core crosses all bounded contexts
// Zero consumers, 5 stale-version dependencies
// ---------------------------------------------------------------------------

export const GodObject: Story = {
  name: "God object — cross-boundary, stale deps, no consumers",
  args: { selection: godObjectSelection },
};

// ---------------------------------------------------------------------------
// Orphaned library — net6.0, no consumers, shows empty sections + external deps
// ---------------------------------------------------------------------------

export const OrphanedLibrary: Story = {
  name: "Orphaned library — no consumers, net6.0",
  args: { selection: orphanedSelection },
};

export const OrphanedLibraryWithExternal: Story = {
  name: "Orphaned library — external packages visible",
  args: { selection: orphanedSelection, showExternal: true },
};

// ---------------------------------------------------------------------------
// Test + NuGet-producing — accidental IsPackable=true on a test project
// Shows dual kind pills, no consumers, one projectRef dependency
// ---------------------------------------------------------------------------

export const TestNugetProducing: Story = {
  name: "Anti-pattern — test project accidentally packable",
  args: { selection: testNugetProducingSelection },
};

// ---------------------------------------------------------------------------
// Internal package node — "Open producer" banner
// ---------------------------------------------------------------------------

export const InternalPackage: Story = {
  name: "Internal package — shows producer banner",
  args: { selection: internalPackageNodeSelection },
};

// ---------------------------------------------------------------------------
// External/unknown package node
// ---------------------------------------------------------------------------

export const ExternalPackage: Story = {
  name: "External package — unknown classification",
  args: { selection: externalPackageSelection },
};

// ---------------------------------------------------------------------------
// Repo selection — all 8 admin-portal projects shown in Projects section
// ---------------------------------------------------------------------------

export const RepoView: Story = {
  name: "Repo selection — projects list",
  args: { selection: repoSelection },
};

// ---------------------------------------------------------------------------
// Production code referencing test helper (bad practice)
// Utilities depends on Platform.Testing.Abstractions (test+nuget-producing)
// ---------------------------------------------------------------------------

export const ProductionRefsTestHelper: Story = {
  name: "Anti-pattern — production refs test helper package",
  args: { selection: prodTestRefSelection },
};

// ---------------------------------------------------------------------------
// Multi-route, multi-version — Commerce.Service.Api reached two ways:
// direct package ref at v4.2.0 AND indirectly through Domain at v3.8.0
// ---------------------------------------------------------------------------

export const MultiVersionRoutes: Story = {
  name: "Multi-route — per-route version attribution",
  args: { selection: multiVersionRouteSelection },
};

// ---------------------------------------------------------------------------
// Kind filter removes rows — hide tests, confirm Affected Tests is empty
// ---------------------------------------------------------------------------

export const KindFilteredNoTests: Story = {
  name: "Kind filter — tests hidden",
  args: {
    selection: sharedLibrarySelection,
    kindFilters: { ...ALL_KINDS, test: false },
  },
};

// ---------------------------------------------------------------------------
// Kind filter removes all rows
// ---------------------------------------------------------------------------

export const KindFilteredNone: Story = {
  name: "Kind filter — all kinds hidden",
  args: {
    selection: sharedLibrarySelection,
    kindFilters: {
      library: false,
      test: false,
      web: false,
      blazor: false,
      service: false,
      "nuget-producing": false,
    },
  },
};
