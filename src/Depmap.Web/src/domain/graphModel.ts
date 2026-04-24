import type { AnyGraphNode, DepmapGraph, GraphEdge, ProjectNode } from "../api/types";
import { effectiveProjectKinds } from "./projectKinds";

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  type: "project" | "package";
}

export interface ProjectGroup {
  repoName: string;
  projects: ProjectNode[];
}

export interface SelectionDetails {
  node: AnyGraphNode;
  neighborhoodIds: string[];
  tests: ProjectGroup[];
  deployables: ProjectGroup[];
}

export interface GraphModel {
  graph: DepmapGraph;
  nodesById: Record<string, AnyGraphNode>;
  reposById: Record<string, DepmapGraph["repos"][number]>;
  projectsById: Record<string, ProjectNode>;
  suggestions: SearchSuggestion[];
  reverseReach(startId: string): string[];
  forwardReach(startId: string): string[];
  neighborhood(startId: string): string[];
}

export function buildModel(graph: DepmapGraph): GraphModel {
  const nodesById: Record<string, AnyGraphNode> = {};
  const reposById: GraphModel["reposById"] = {};
  const projectsById: GraphModel["projectsById"] = {};
  const reverseAdj: Record<string, GraphEdge[]> = {};
  const forwardAdj: Record<string, GraphEdge[]> = {};

  graph.repos.forEach((repo) => {
    reposById[repo.id] = repo;
    nodesById[repo.id] = { ...repo, type: "repo" };
  });
  graph.solutions.forEach((solution) => {
    nodesById[solution.id] = { ...solution, type: "solution" };
  });
  graph.projects.forEach((project) => {
    projectsById[project.id] = project;
    nodesById[project.id] = { ...project, type: "project" };
  });
  graph.packages.forEach((pkg) => {
    nodesById[pkg.id] = { ...pkg, type: "package" };
  });
  graph.edges.forEach((edge) => {
    (reverseAdj[edge.to] ||= []).push(edge);
    (forwardAdj[edge.from] ||= []).push(edge);
  });

  const walk = (startId: string, adjacency: Record<string, GraphEdge[]>, nextKey: "from" | "to"): string[] => {
    const seen = new Set<string>([startId]);
    const queue = [startId];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const edge of adjacency[current] || []) {
        const next = edge[nextKey];
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    seen.delete(startId);
    return Array.from(seen);
  };

  const suggestions: SearchSuggestion[] = [
    ...graph.projects.map((project) => ({
      id: project.id,
      label: project.name,
      sublabel: effectiveProjectKinds(project.kinds).join(", "),
      type: "project" as const,
    })),
    ...graph.packages.map((pkg) => ({
      id: pkg.producedBy || pkg.id,
      label: pkg.name,
      sublabel: pkg.producedBy ? "internal package" : pkg.classification,
      type: "package" as const,
    })),
  ];

  return {
    graph,
    nodesById,
    reposById,
    projectsById,
    suggestions,
    reverseReach: (startId) => walk(startId, reverseAdj, "from"),
    forwardReach: (startId) => walk(startId, forwardAdj, "to"),
    neighborhood: (startId) => [startId, ...walk(startId, reverseAdj, "from"), ...walk(startId, forwardAdj, "to")],
  };
}

export function describeSelection(model: GraphModel, selectionId: string | null): SelectionDetails | null {
  if (!selectionId) return null;
  const node = model.nodesById[selectionId];
  if (!node) return null;

  const ancestors = model.reverseReach(selectionId);
  const descendants = model.forwardReach(selectionId);
  const impactedProjects = ancestors.map((id) => model.projectsById[id]).filter(Boolean);

  return {
    node,
    neighborhoodIds: [selectionId, ...ancestors, ...descendants],
    tests: groupProjectsByRepo(
      impactedProjects.filter((project) => (project.kinds || []).includes("test")),
      model.reposById,
    ),
    deployables: groupProjectsByRepo(
      impactedProjects.filter((project) => {
        const kinds = project.kinds || [];
        return kinds.includes("web") || kinds.includes("service");
      }),
      model.reposById,
    ),
  };
}

function groupProjectsByRepo(projects: ProjectNode[], reposById: GraphModel["reposById"]): ProjectGroup[] {
  const groups = new Map<string, ProjectNode[]>();
  for (const project of projects) {
    const repoName = reposById[project.repo || ""]?.name || "Unknown repo";
    groups.set(repoName, [...(groups.get(repoName) || []), project]);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([repoName, repoProjects]) => ({
      repoName,
      projects: repoProjects.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export function formatDate(value?: string): string {
  if (!value) return "Not yet scanned";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
