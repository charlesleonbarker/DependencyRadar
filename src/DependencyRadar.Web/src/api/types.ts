/** Stable node categories emitted by the backend graph contract. */
export type NodeKind = "repo" | "solution" | "project" | "package";

/** Project classifications derived locally from `.csproj` metadata. */
export type ProjectKind = "library" | "test" | "web" | "blazor" | "service" | "nuget-producing";

/** Package classification from local graph knowledge only; unknown is intentional. */
export type PackageClassification = "internal" | "unknown" | string;

/** Directed relationship categories emitted by the scanner. */
export type EdgeKind = "solutionContains" | "projectRef" | "packageRef" | "producedBy";

/** Git repository or scanned root folder node. */
export interface RepoNode {
  /** Stable graph node id. */
  id: string;
  /** Display name, optionally prefix-stripped by backend configuration. */
  name: string;
  /** Raw repository path from the scanned filesystem. */
  path: string;
}

/** Solution file node discovered under a repository. */
export interface SolutionNode {
  /** Stable graph node id. */
  id: string;
  /** Display name, usually the `.sln` filename without extension. */
  name: string;
  /** Raw solution file path. */
  path: string;
  /** Owning repository id when the solution belongs to a known repo. */
  repo?: string;
}

/** Project file node discovered from a `.csproj`. */
export interface ProjectNode {
  /** Stable graph node id. */
  id: string;
  /** Display name, optionally prefix-stripped by backend configuration. */
  name: string;
  /** Assembly name when it differs from or is explicitly set in the project file. */
  assemblyName?: string;
  /** Raw `.csproj` path. */
  path: string;
  /** Owning repository id when the project belongs to a known repo. */
  repo?: string;
  /** SDK declared on the project root element. */
  sdk?: string;
  /** Target frameworks, unioned for multi-TFM projects. */
  tfms?: string[];
  /** Locally derived project classifications. */
  kinds?: ProjectKind[];
  /** Produced NuGet package id when this project packs a package. */
  packageId?: string;
  /** Produced package version when locally declared. */
  version?: string;
}

/** NuGet package node referenced or produced by projects in the scanned estate. */
export interface PackageNode {
  /** Stable graph node id. */
  id: string;
  /** NuGet package id. */
  name: string;
  /** Locally observed referenced versions. */
  versions?: string[];
  /** Local package classification; external packages normally remain unknown. */
  classification?: PackageClassification;
  /** Producing project id for an internal package. */
  producedBy?: string;
}

/** Directed graph edge between two node ids. */
export interface GraphEdge {
  /** Source node id. */
  from: string;
  /** Target node id. */
  to: string;
  /** Relationship category. */
  kind: EdgeKind;
  /** Package reference version when the edge represents a PackageReference. */
  version?: string;
}

/** Complete dependency graph snapshot returned by `GET /api/graph`. */
export interface DependencyRadarGraph {
  /** Root path scanned for this graph snapshot. */
  root?: string;
  /** Repository nodes. */
  repos: RepoNode[];
  /** Solution nodes. */
  solutions: SolutionNode[];
  /** Project nodes. */
  projects: ProjectNode[];
  /** Package nodes. */
  packages: PackageNode[];
  /** Directed graph edges. */
  edges: GraphEdge[];
}

/** Lightweight graph counts included in monitor status responses. */
export interface GraphSummary {
  /** Number of repository nodes. */
  repoCount?: number;
  /** Number of solution nodes. */
  solutionCount?: number;
  /** Number of project nodes. */
  projectCount?: number;
  /** Number of package nodes. */
  packageCount?: number;
  /** Number of graph edges. */
  edgeCount?: number;
}

/** Current backend monitor state returned by `GET /api/status`. */
export interface MonitorStatus {
  /** Current scanner state, such as ready, scanning, or error. */
  state?: string;
  /** Timestamp of the most recent completed scan. */
  lastScanAt?: string;
  /** Last scanner error message, if any. */
  lastError?: string;
  /** Counts from the latest graph snapshot. */
  summary?: GraphSummary;
}

/** Discriminated union used by frontend graph lookup maps. */
export type AnyGraphNode =
  | (RepoNode & { type: "repo" })
  | (SolutionNode & { type: "solution" })
  | (ProjectNode & { type: "project" })
  | (PackageNode & { type: "package" });
