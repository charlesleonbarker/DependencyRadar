export type NodeKind = "repo" | "solution" | "project" | "package";

export type ProjectKind = "library" | "test" | "web" | "blazor" | "service" | "nuget-producing";

export type PackageClassification = "internal" | "external" | "unknown" | string;

export type EdgeKind = "solutionContains" | "projectRef" | "packageRef" | "packageRefTransitive" | "producedBy";

export interface RepoNode {
  id: string;
  name: string;
  path: string;
}

export interface SolutionNode {
  id: string;
  name: string;
  path: string;
  repo?: string;
}

export interface ProjectNode {
  id: string;
  name: string;
  path: string;
  repo?: string;
  sdk?: string;
  tfms?: string[];
  kinds?: ProjectKind[];
  packageId?: string;
}

export interface PackageNode {
  id: string;
  name: string;
  versions?: string[];
  classification?: PackageClassification;
  producedBy?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface DepmapGraph {
  repos: RepoNode[];
  solutions: SolutionNode[];
  projects: ProjectNode[];
  packages: PackageNode[];
  edges: GraphEdge[];
}

export interface GraphSummary {
  repoCount?: number;
  solutionCount?: number;
  projectCount?: number;
  packageCount?: number;
  edgeCount?: number;
}

export interface MonitorStatus {
  state?: string;
  lastScanAt?: string;
  lastError?: string;
  summary?: GraphSummary;
}

export type AnyGraphNode =
  | (RepoNode & { type: "repo" })
  | (SolutionNode & { type: "solution" })
  | (ProjectNode & { type: "project" })
  | (PackageNode & { type: "package" });
