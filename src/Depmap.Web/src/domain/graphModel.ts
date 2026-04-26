import type { AnyGraphNode, DepmapGraph, GraphEdge, PackageNode, ProjectKind, ProjectNode } from "../api/types";
import { effectiveProjectKinds } from "./projectKinds";

export interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  kinds?: ProjectKind[];
  aliases?: string[];
  type: "repo" | "project" | "package";
}

export interface ImpactProject {
  project: ProjectNode;
  depth: number;
  path: AnyGraphNode[];
  paths: AnyGraphNode[][];
  hasAlternativeRoute: boolean;
}

export interface DependencyItem {
  node: AnyGraphNode;
  depth: number;
  path: AnyGraphNode[];
  paths: AnyGraphNode[][];
  hasAlternativeRoute: boolean;
  referenceVersions?: string[];
}

export interface ProjectGroup {
  repoName: string;
  projects: ImpactProject[];
}

export interface DependencyGroup {
  repoName: string;
  dependencies: DependencyItem[];
}

export interface SelectionDetails {
  node: AnyGraphNode;
  neighborhoodIds: string[];
  affectedRepoCount: number;
  affectedProjectCount: number;
  dependencyCount: number;
  producedByProject?: ProjectNode;
  repoProjects?: ProjectNode[];
  consumers: ProjectGroup[];
  internalDependencies: DependencyGroup[];
  externalDependencies: DependencyItem[];
  tests: ProjectGroup[];
  deployables: ProjectGroup[];
}

export interface GraphModel {
  graph: DepmapGraph;
  nodesById: Record<string, AnyGraphNode>;
  reposById: Record<string, DepmapGraph["repos"][number]>;
  projectsById: Record<string, ProjectNode>;
  projectsByRepo: Record<string, ProjectNode[]>;
  collapsedPackageTargets: Record<string, string>;
  suggestions: SearchSuggestion[];
  reverseReach(startId: string): string[];
  forwardReach(startId: string): string[];
  graphIdForSelection(startId: string): string;
  neighborhood(startId: string): string[];
  impactPath(startId: string, targetId: string): string[];
  impactPaths(startId: string, targetId: string, maxDepth: number): string[][];
  hasAlternativeImpactRoute(startId: string, targetId: string, shortestDepth: number): boolean;
  dependencyPath(startId: string, targetId: string): string[];
  dependencyPaths(startId: string, targetId: string, maxDepth: number): string[][];
  hasAlternativeDependencyRoute(startId: string, targetId: string, shortestDepth: number): boolean;
}

function getTraversalStartIds(startId: string, node: AnyGraphNode | undefined): string[] {
  return node?.type === "package" && node.producedBy ? [startId, node.producedBy] : [startId];
}

export function buildModel(graph: DepmapGraph): GraphModel {
  const nodesById: Record<string, AnyGraphNode> = {};
  const reposById: GraphModel["reposById"] = {};
  const projectsById: GraphModel["projectsById"] = {};
  const projectsByRepo: GraphModel["projectsByRepo"] = {};
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
    if (project.repo) (projectsByRepo[project.repo] ||= []).push(project);
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

    return [];
  };

  const hasAlternativeRoute = (
    startId: string,
    targetId: string,
    shortestDepth: number,
    adjacency: Record<string, GraphEdge[]>,
    nextKey: "from" | "to",
  ): boolean => {
    const maxDepth = Math.max(4, shortestDepth + 2);
    // visited is the path from startId to this node; using includes() on a short array
    // is cheaper than allocating a new Set per frontier entry for paths of depth ≤ 6.
    const queue: Array<{ id: string; depth: number; visited: string[] }> = [{ id: startId, depth: 0, visited: [startId] }];
    let foundShortest = false;

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current.depth >= maxDepth) continue;

      for (const edge of adjacency[current.id] || []) {
        const next = edge[nextKey];
        if (current.visited.includes(next)) continue;

        const depth = current.depth + 1;
        if (next === targetId) {
          if (depth !== shortestDepth || foundShortest) return true;
          foundShortest = true;
          continue;
        }

        queue.push({ id: next, depth, visited: [...current.visited, next] });
      }
    }

    return false;
  };

  const paths = (
    startId: string,
    targetId: string,
    maxDepth: number,
    adjacency: Record<string, GraphEdge[]>,
    nextKey: "from" | "to",
  ): string[][] => {
    const found: string[][] = [];
    // pathIds doubles as the visited set; includes() on a short array avoids allocating
    // a separate Set per frontier entry.
    const queue: Array<{ id: string; pathIds: string[] }> = [{ id: startId, pathIds: [startId] }];

    for (let index = 0; index < queue.length && found.length < 8; index += 1) {
      const current = queue[index];
      if (current.pathIds.length - 1 >= maxDepth) continue;

      for (const edge of adjacency[current.id] || []) {
        const next = edge[nextKey];
        if (current.pathIds.includes(next)) continue;

        const nextPath = [...current.pathIds, next];
        if (next === targetId) {
          found.push(nextPath);
          if (found.length >= 8) break;
          continue;
        }

        queue.push({ id: next, pathIds: nextPath });
      }
    }

    return found;
  };

  const packageAliasesByProducer = new Map<string, string[]>();
  graph.packages.forEach((pkg) => {
    if (!pkg.producedBy) return;
    packageAliasesByProducer.set(pkg.producedBy, [...(packageAliasesByProducer.get(pkg.producedBy) || []), pkg.name]);
  });

  const suggestions: SearchSuggestion[] = [
    ...graph.repos.map((repo) => ({
      id: repo.id,
      label: repo.name,
      sublabel: repo.displayPath || repo.path,
      type: "repo" as const,
    })),
    ...graph.projects.map((project) => ({
      id: project.id,
      label: project.name,
      sublabel: packageAliasesByProducer.has(project.id)
        ? `package ${packageAliasesByProducer.get(project.id)!.sort((a, b) => a.localeCompare(b)).join(", ")}`
        : undefined,
      aliases: packageAliasesByProducer.get(project.id),
      kinds: effectiveProjectKinds(project.kinds),
      type: "project" as const,
    })),
    ...graph.packages.filter((pkg) => !pkg.producedBy).map((pkg) => ({
      id: pkg.id,
      label: pkg.name,
      sublabel: packageSublabel(pkg, projectsById),
      type: "package" as const,
    })),
  ];
  const repoProjectIds = (repoId: string): string[] => (projectsByRepo[repoId] || []).map((project) => project.id);
  const repoReach = (repoId: string, adjacency: Record<string, GraphEdge[]>, nextKey: "from" | "to", includeProjects: boolean): string[] => {
    const starts = repoProjectIds(repoId);
    const projectSet = new Set(starts);
    const reached = unique(starts.flatMap((id) => walk(id, adjacency, nextKey))).filter((id) => !projectSet.has(id));
    return includeProjects ? unique([...starts, ...reached]) : reached;
  };
  const traversalStartIds = (startId: string): string[] => getTraversalStartIds(startId, nodesById[startId]);
  const compositeReach = (startId: string, adjacency: Record<string, GraphEdge[]>, nextKey: "from" | "to"): string[] => {
    const starts = traversalStartIds(startId);
    return unique(starts.flatMap((id) => walk(id, adjacency, nextKey))).filter((id) => !starts.includes(id));
  };

  return {
    graph,
    nodesById,
    reposById,
    projectsById,
    projectsByRepo,
    collapsedPackageTargets,
    suggestions,
    reverseReach: (startId) => nodesById[startId]?.type === "repo" ? repoReach(startId, reverseAdj, "from", false) : compositeReach(startId, reverseAdj, "from"),
    forwardReach: (startId) => nodesById[startId]?.type === "repo" ? repoReach(startId, forwardAdj, "to", true) : compositeReach(startId, forwardAdj, "to"),
    graphIdForSelection: (startId) => collapsedPackageTargets[startId] || startId,
    neighborhood: (startId) => nodesById[startId]?.type === "repo"
      ? unique([startId, ...repoReach(startId, reverseAdj, "from", false), ...repoReach(startId, forwardAdj, "to", true)])
      : unique([startId, ...traversalStartIds(startId), ...compositeReach(startId, reverseAdj, "from"), ...compositeReach(startId, forwardAdj, "to")]),
    impactPath: (startId, targetId) => path(startId, targetId, reverseAdj, "from"),
    impactPaths: (startId, targetId, maxDepth) => paths(startId, targetId, maxDepth, reverseAdj, "from"),
    hasAlternativeImpactRoute: (startId, targetId, shortestDepth) => hasAlternativeRoute(startId, targetId, shortestDepth, reverseAdj, "from"),
    dependencyPath: (startId, targetId) => path(startId, targetId, forwardAdj, "to"),
    dependencyPaths: (startId, targetId, maxDepth) => paths(startId, targetId, maxDepth, forwardAdj, "to"),
    hasAlternativeDependencyRoute: (startId, targetId, shortestDepth) => hasAlternativeRoute(startId, targetId, shortestDepth, forwardAdj, "to"),
  };
}

export function describeSelection(model: GraphModel, selectionId: string | null): SelectionDetails | null {
  if (!selectionId) return null;
  const node = model.nodesById[selectionId];
  if (!node) return null;

  if (node.type === "repo") {
    return describeRepoSelection(model, node);
  }

  const traversalStartIds = getTraversalStartIds(selectionId, node);
  const ancestors = unique(traversalStartIds.flatMap((id) => model.reverseReach(id))).filter((id) => !traversalStartIds.includes(id));
  const descendants = unique(traversalStartIds.flatMap((id) => model.forwardReach(id))).filter((id) => !traversalStartIds.includes(id));
  const impactedProjects = ancestors
    .map((id) => {
      const project = model.projectsById[id];
      if (!project) return null;

      const routePaths = routePathsFromStarts(
        traversalStartIds,
        id,
        (start, target) => model.impactPath(start, target),
        (start, target, maxDepth) => model.impactPaths(start, target, maxDepth),
      );
      const rawPathIds = routePaths.shortest;
      const pathIds = compressInternalPackagePath(model, rawPathIds);
      const depth = Math.max(0, pathIds.length - 1);
      const rawDepth = Math.max(0, rawPathIds.length - 1);
      const paths = routePaths.all.map((route) => compressInternalPackagePath(model, route).map((pathId) => model.nodesById[pathId]).filter(Boolean));
      return {
        project,
        depth,
        path: pathIds.map((pathId) => model.nodesById[pathId]).filter(Boolean),
        paths,
        hasAlternativeRoute: paths.length > 1 || traversalStartIds.some((start) => model.hasAlternativeImpactRoute(start, id, rawDepth)),
      };
    })
    .filter((project): project is ImpactProject => Boolean(project));
  const affectedRepoIds = new Set(impactedProjects.map((impact) => impact.project.repo).filter(Boolean));
  const dependencies = dependencyItemsFromStarts(model, traversalStartIds, descendants);

  return {
    node,
    neighborhoodIds: unique([selectionId, ...traversalStartIds, ...ancestors, ...descendants]),
    affectedRepoCount: affectedRepoIds.size,
    affectedProjectCount: impactedProjects.length,
    dependencyCount: descendants.length,
    producedByProject: node.type === "package" && node.producedBy ? model.projectsById[node.producedBy] : undefined,
    consumers: groupProjectsByRepo(impactedProjects, model.reposById),
    internalDependencies: groupDependenciesByRepo(
      dependencies.filter((dependency) => dependency.node.type === "project" || isInternalPackage(dependency.node)),
      model.reposById,
    ),
    externalDependencies: dependencies
      .filter((dependency) => dependency.node.type === "package" && !isInternalPackage(dependency.node))
      .sort((a, b) => a.node.name.localeCompare(b.node.name)),
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

function describeRepoSelection(model: GraphModel, repo: AnyGraphNode & { type: "repo" }): SelectionDetails {
  const repoProjects = [...(model.projectsByRepo[repo.id] || [])].sort((a, b) => a.name.localeCompare(b.name));
  const projectIds = new Set(repoProjects.map((project) => project.id));
  const starts = repoProjects.map((project) => project.id);
  const consumers = unique(starts.flatMap((id) => model.reverseReach(id))).filter((id) => !projectIds.has(id));
  const dependencies = unique(starts.flatMap((id) => model.forwardReach(id))).filter((id) => !projectIds.has(id));
  const impactedProjects = consumers
    .map((id) => impactFromStarts(model, starts, id))
    .filter((project): project is ImpactProject => Boolean(project));
  const dependencyRows = dependencyItemsFromStarts(model, starts, dependencies)
    .filter((dependency) => dependency.node.type !== "project" || dependency.node.repo !== repo.id);
  const affectedRepoIds = new Set(impactedProjects.map((impact) => impact.project.repo).filter(Boolean));

  return {
    node: repo,
    neighborhoodIds: unique([repo.id, ...starts, ...consumers, ...dependencies]),
    affectedRepoCount: affectedRepoIds.size,
    affectedProjectCount: impactedProjects.length,
    dependencyCount: dependencyRows.length,
    repoProjects,
    consumers: groupProjectsByRepo(impactedProjects, model.reposById),
    internalDependencies: groupDependenciesByRepo(
      dependencyRows.filter((dependency) => dependency.node.type === "project" || isInternalPackage(dependency.node)),
      model.reposById,
    ),
    externalDependencies: dependencyRows
      .filter((dependency) => dependency.node.type === "package" && !isInternalPackage(dependency.node))
      .sort((a, b) => a.node.name.localeCompare(b.node.name)),
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

function impactFromStarts(model: GraphModel, starts: string[], targetId: string): ImpactProject | null {
  const project = model.projectsById[targetId];
  if (!project) return null;

  const routePaths = routePathsFromStarts(
    starts,
    targetId,
    (start, target) => model.impactPath(start, target),
    (start, target, maxDepth) => model.impactPaths(start, target, maxDepth),
  );
  const rawPathIds = routePaths.shortest;
  const pathIds = compressInternalPackagePath(model, rawPathIds);
  const depth = Math.max(0, pathIds.length - 1);
  const rawDepth = Math.max(0, rawPathIds.length - 1);
  const paths = routePaths.all.map((route) => compressInternalPackagePath(model, route).map((pathId) => model.nodesById[pathId]).filter(Boolean));
  return {
    project,
    depth,
    path: pathIds.map((pathId) => model.nodesById[pathId]).filter(Boolean),
    paths,
    hasAlternativeRoute: paths.length > 1 || starts.some((start) => model.hasAlternativeImpactRoute(start, targetId, rawDepth)),
  };
}

function dependencyItemsFromStarts(model: GraphModel, starts: string[], descendants: string[]): DependencyItem[] {
  const items = new Map<string, DependencyItem>();

  for (const id of descendants) {
    const rawNode = model.nodesById[id];
    if (!rawNode) continue;

    const node = rawNode.type === "package" && rawNode.producedBy
      ? model.nodesById[rawNode.producedBy] || rawNode
      : rawNode;
    if (node.type !== "project" && node.type !== "package") continue;

    const targetId = rawNode.type === "package" && rawNode.producedBy ? rawNode.id : node.id;
    const routePaths = routePathsFromStarts(
      starts,
      targetId,
      (start, target) => model.dependencyPath(start, target),
      (start, target, maxDepth) => model.dependencyPaths(start, target, maxDepth),
    );
    const rawPathIds = routePaths.shortest;
    const pathIds = compressInternalPackagePath(model, rawPathIds);
    const depth = Math.max(0, pathIds.length - 1);
    const rawDepth = Math.max(0, rawPathIds.length - 1);
    const paths = routePaths.all.map((route) => compressInternalPackagePath(model, route).map((pathId) => model.nodesById[pathId]).filter(Boolean));
    const item: DependencyItem = {
      node,
      depth,
      path: pathIds.map((pathId) => model.nodesById[pathId]).filter(Boolean),
      paths,
      hasAlternativeRoute: paths.length > 1 || starts.some((start) => model.hasAlternativeDependencyRoute(start, targetId, rawDepth)),
      referenceVersions: packageReferenceVersionsOnPath(model.graph.edges, rawPathIds),
    };

    const current = items.get(node.id);
    if (!current) {
      items.set(node.id, item);
    } else {
      const base = routePriority(item) > routePriority(current) ? item : current;
      const mergedPaths = uniqueNodePaths([...current.paths, ...item.paths]);
      // Use the minimum depth across both routes; the base item may not hold the shortest path.
      const minDepth = Math.min(current.depth, item.depth);
      const minPath = minDepth === current.depth ? current.path : item.path;
      items.set(node.id, {
        ...base,
        depth: minDepth,
        path: minPath,
        paths: mergedPaths,
        hasAlternativeRoute: current.hasAlternativeRoute || item.hasAlternativeRoute || mergedPaths.length > 1,
        referenceVersions: mergeVersions(current.referenceVersions, item.referenceVersions),
      });
    }
  }

  return Array.from(items.values());
}

function routePathsFromStarts(
  starts: string[],
  targetId: string,
  pathFor: (startId: string, targetId: string) => string[],
  pathsFor: (startId: string, targetId: string, maxDepth: number) => string[][],
): { shortest: string[]; all: string[][] } {
  const shortest = shortestPathFromStarts(starts, targetId, pathFor);
  const rawDepth = Math.max(0, shortest.length - 1);
  const maxDepth = Math.max(4, rawDepth + 2);
  const all = uniquePaths(starts.flatMap((start) => pathsFor(start, targetId, maxDepth)))
    .sort((a, b) => a.length - b.length);

  return {
    shortest,
    all: all.length > 0 ? all : [shortest],
  };
}

function shortestPathFromStarts(starts: string[], targetId: string, pathFor: (startId: string, targetId: string) => string[]): string[] {
  return starts
    .map((start) => pathFor(start, targetId))
    .filter((pathIds) => pathIds.length > 1 && pathIds[pathIds.length - 1] === targetId)
    .sort((a, b) => a.length - b.length)[0] || [targetId];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function uniquePaths(paths: string[][]): string[][] {
  const seen = new Set<string>();
  const uniquePathList: string[][] = [];
  for (const path of paths) {
    const key = path.join(">");
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePathList.push(path);
  }
  return uniquePathList;
}

function uniqueNodePaths(paths: AnyGraphNode[][]): AnyGraphNode[][] {
  const seen = new Set<string>();
  const uniquePathList: AnyGraphNode[][] = [];
  for (const path of paths) {
    const key = path.map((node) => node.id).join(">");
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePathList.push(path);
  }
  return uniquePathList;
}

function compressInternalPackagePath(model: GraphModel, pathIds: string[]): string[] {
  const compressed: string[] = [];
  for (const id of pathIds) {
    const node = model.nodesById[id];
    const nextId = node?.type === "package" && node.producedBy ? node.producedBy : id;
    if (compressed[compressed.length - 1] !== nextId) {
      compressed.push(nextId);
    }
  }
  return compressed;
}

function mergeVersions(left?: string[], right?: string[]): string[] | undefined {
  const merged = unique([...(left || []), ...(right || [])]).sort((a, b) => a.localeCompare(b));
  return merged.length > 0 ? merged : undefined;
}

function packageReferenceVersionsOnPath(edges: GraphEdge[], pathIds: string[]): string[] | undefined {
  if (pathIds.length < 2) return undefined;

  const versions: string[] = [];
  for (let index = 0; index < pathIds.length - 1; index += 1) {
    const from = pathIds[index];
    const to = pathIds[index + 1];
    edges
      .filter((edge) => edge.from === from && edge.to === to && edge.kind === "packageRef" && edge.version)
      .forEach((edge) => versions.push(edge.version!));
  }

  return mergeVersions(versions);
}

function routePriority(item: DependencyItem): number {
  if (item.depth <= 1 && item.hasAlternativeRoute) return 3;
  if (item.depth <= 1) return 2;
  return 1;
}

function isInternalPackage(node: AnyGraphNode): boolean {
  return node.type === "package" && (node.classification === "internal" || Boolean(node.producedBy));
}

function packageSublabel(pkg: PackageNode, projectsById: GraphModel["projectsById"]): string {
  const versions = pkg.versions && pkg.versions.length > 0
    ? `v ${pkg.versions.join(", ")}${pkg.versions.length > 1 ? " - version drift" : ""}`
    : "version unknown";
  if (pkg.producedBy) return `internal package produced by ${projectsById[pkg.producedBy]?.name || "unknown project"} - ${versions}`;
  return `${pkg.classification || "unknown"} - ${versions}`;
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

function groupDependenciesByRepo(dependencies: DependencyItem[], reposById: GraphModel["reposById"]): DependencyGroup[] {
  const groups = new Map<string, DependencyItem[]>();
  for (const dependency of dependencies) {
    const repoId = dependency.node.type === "project" ? dependency.node.repo : undefined;
    const repoName = reposById[repoId || ""]?.name || "Unknown repo";
    groups.set(repoName, [...(groups.get(repoName) || []), dependency]);
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([repoName, repoDependencies]) => ({
      repoName,
      dependencies: repoDependencies.sort((a, b) => a.node.name.localeCompare(b.node.name)),
    }));
}

export function formatDate(value?: string): string {
  if (!value) return "Not yet scanned";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
