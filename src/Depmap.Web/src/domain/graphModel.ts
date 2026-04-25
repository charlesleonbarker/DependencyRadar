import type { AnyGraphNode, DepmapGraph, GraphEdge, ProjectKind, ProjectNode } from "../api/types";
import { effectiveProjectKinds } from "./projectKinds";

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  kinds?: ProjectKind[];
  type: "project" | "package";
}

export interface ImpactProject {
  project: ProjectNode;
  depth: number;
  path: AnyGraphNode[];
  hasAlternativeRoute: boolean;
}

export interface ProjectGroup {
  repoName: string;
  projects: ImpactProject[];
}

export interface SelectionDetails {
  node: AnyGraphNode;
  neighborhoodIds: string[];
  affectedRepoCount: number;
  affectedProjectCount: number;
  dependencyCount: number;
  producedByProject?: ProjectNode;
  tests: ProjectGroup[];
  deployables: ProjectGroup[];
}

export interface GraphModel {
  graph: DepmapGraph;
  nodesById: Record<string, AnyGraphNode>;
  reposById: Record<string, DepmapGraph["repos"][number]>;
  projectsById: Record<string, ProjectNode>;
  collapsedPackageTargets: Record<string, string>;
  suggestions: SearchSuggestion[];
  reverseReach(startId: string): string[];
  forwardReach(startId: string): string[];
  graphIdForSelection(startId: string): string;
  neighborhood(startId: string): string[];
  impactPath(startId: string, targetId: string): string[];
  hasAlternativeImpactRoute(startId: string, targetId: string, shortestDepth: number): boolean;
}

export function buildModel(graph: DepmapGraph): GraphModel {
  const nodesById: Record<string, AnyGraphNode> = {};
  const reposById: GraphModel["reposById"] = {};
  const projectsById: GraphModel["projectsById"] = {};
  const collapsedPackageTargets: GraphModel["collapsedPackageTargets"] = {};
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
    if (pkg.producedBy) collapsedPackageTargets[pkg.id] = pkg.producedBy;
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

  const path = (startId: string, targetId: string, adjacency: Record<string, GraphEdge[]>, nextKey: "from" | "to"): string[] => {
    if (startId === targetId) return [startId];

    const seen = new Set<string>([startId]);
    const previous = new Map<string, string>();
    const queue = [startId];

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const edge of adjacency[current] || []) {
        const next = edge[nextKey];
        if (seen.has(next)) continue;

        seen.add(next);
        previous.set(next, current);
        if (next === targetId) {
          const ids = [targetId];
          let cursor = targetId;
          while (cursor !== startId) {
            const parent = previous.get(cursor);
            if (!parent) break;
            ids.push(parent);
            cursor = parent;
          }
          return ids.reverse();
        }
        queue.push(next);
      }
    }

    return [startId, targetId];
  };

  const hasAlternativeRoute = (
    startId: string,
    targetId: string,
    shortestDepth: number,
    adjacency: Record<string, GraphEdge[]>,
    nextKey: "from" | "to",
  ): boolean => {
    const maxDepth = Math.max(4, shortestDepth + 2);
    const queue: Array<{ id: string; depth: number; seen: Set<string> }> = [{ id: startId, depth: 0, seen: new Set([startId]) }];
    let foundShortest = false;

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.depth >= maxDepth) continue;

      for (const edge of adjacency[current.id] || []) {
        const next = edge[nextKey];
        if (current.seen.has(next)) continue;

        const depth = current.depth + 1;
        if (next === targetId) {
          if (depth !== shortestDepth || foundShortest) return true;
          foundShortest = true;
          continue;
        }

        queue.push({ id: next, depth, seen: new Set([...current.seen, next]) });
      }
    }

    return false;
  };

  const suggestions: SearchSuggestion[] = [
    ...graph.projects.map((project) => ({
      id: project.id,
      label: project.name,
      kinds: effectiveProjectKinds(project.kinds),
      type: "project" as const,
    })),
    ...graph.packages.map((pkg) => ({
      id: pkg.id,
      label: pkg.name,
      sublabel: pkg.producedBy
        ? `internal package produced by ${projectsById[pkg.producedBy]?.name || "unknown project"}`
        : pkg.classification || "unknown",
      type: "package" as const,
    })),
  ];

  return {
    graph,
    nodesById,
    reposById,
    projectsById,
    collapsedPackageTargets,
    suggestions,
    reverseReach: (startId) => walk(startId, reverseAdj, "from"),
    forwardReach: (startId) => walk(startId, forwardAdj, "to"),
    graphIdForSelection: (startId) => collapsedPackageTargets[startId] || startId,
    neighborhood: (startId) => [startId, ...walk(startId, reverseAdj, "from"), ...walk(startId, forwardAdj, "to")],
    impactPath: (startId, targetId) => path(startId, targetId, reverseAdj, "from"),
    hasAlternativeImpactRoute: (startId, targetId, shortestDepth) => hasAlternativeRoute(startId, targetId, shortestDepth, reverseAdj, "from"),
  };
}

export function describeSelection(model: GraphModel, selectionId: string | null): SelectionDetails | null {
  if (!selectionId) return null;
  const node = model.nodesById[selectionId];
  if (!node) return null;

  const ancestors = model.reverseReach(selectionId);
  const descendants = model.forwardReach(selectionId);
  const impactedProjects = ancestors
    .map((id) => {
      const project = model.projectsById[id];
      if (!project) return null;

      const pathIds = model.impactPath(selectionId, id);
      const depth = Math.max(0, pathIds.length - 1);
      return {
        project,
        depth,
        path: pathIds.map((pathId) => model.nodesById[pathId]).filter(Boolean),
        hasAlternativeRoute: model.hasAlternativeImpactRoute(selectionId, id, depth),
      };
    })
    .filter((project): project is ImpactProject => Boolean(project));
  const affectedRepoIds = new Set(impactedProjects.map((impact) => impact.project.repo).filter(Boolean));

  return {
    node,
    neighborhoodIds: [selectionId, ...ancestors, ...descendants],
    affectedRepoCount: affectedRepoIds.size,
    affectedProjectCount: impactedProjects.length,
    dependencyCount: descendants.length,
    producedByProject: node.type === "package" && node.producedBy ? model.projectsById[node.producedBy] : undefined,
    tests: groupProjectsByRepo(
      impactedProjects.filter((impact) => (impact.project.kinds || []).includes("test")),
      model.reposById,
    ),
    deployables: groupProjectsByRepo(
      impactedProjects.filter((impact) => {
        const kinds = impact.project.kinds || [];
        return kinds.includes("web") || kinds.includes("service");
      }),
      model.reposById,
    ),
  };
}

function groupProjectsByRepo(projects: ImpactProject[], reposById: GraphModel["reposById"]): ProjectGroup[] {
  const groups = new Map<string, ImpactProject[]>();
  for (const impact of projects) {
    const repoName = reposById[impact.project.repo || ""]?.name || "Unknown repo";
    groups.set(repoName, [...(groups.get(repoName) || []), impact]);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([repoName, repoProjects]) => ({
      repoName,
      projects: repoProjects.sort((a, b) => a.project.name.localeCompare(b.project.name)),
    }));
}

export function formatDate(value?: string): string {
  if (!value) return "Not yet scanned";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
