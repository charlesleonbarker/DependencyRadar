import { useState } from "react";
import type { AnyGraphNode, PackageNode, ProjectKind, ProjectNode } from "../api/types";
import type { DependencyGroup, DependencyItem, ImpactProject, ProjectGroup, RouteKind, SelectionDetails } from "../domain/graphModel";
import { effectiveProjectKinds, KIND_SHORT } from "../domain/projectKinds";
import { PortalTooltip } from "./PortalTooltip";

interface SelectionPopoverProps {
  selection: SelectionDetails | null;
  showExternal: boolean;
  kindFilters: Record<ProjectKind, boolean>;
  onClose(): void;
  onSelect(id: string): void;
  onHoverPath(pathIds: string[][] | null): void;
}

export function SelectionPopover({ selection, showExternal, kindFilters, onClose, onSelect, onHoverPath }: SelectionPopoverProps) {
  if (!selection) return null;

  const { node } = selection;
  const repoProjects = selection.repoProjects?.filter((project) => projectPassesKindFilter(project, kindFilters));
  const tests = filterProjectGroups(selection.tests, kindFilters);
  const deployables = filterProjectGroups(selection.deployables, kindFilters);
  const consumers = filterProjectGroups(selection.consumers, kindFilters);
  const internalDependencies = filterDependencyGroups(selection.internalDependencies, kindFilters);

  return (
    <div className="selection-popover">
      <div className="selection-card" onMouseLeave={() => onHoverPath(null)}>
        <div className="selection-sticky-header">
          <div className="selection-header">
            <h2><DottedName value={node.name} /></h2>
            <button className="ghost-button" type="button" onClick={onClose}>Close</button>
          </div>

          {node.type === "package" && selection.producedByProject ? (
            <button
              className="package-producer-card"
              type="button"
              onClick={() => onSelect(selection.producedByProject!.id)}
            >
              <span>
                <strong>Internal package</strong>
                <small>This package is built by <DottedName value={selection.producedByProject.name} /></small>
              </span>
              <span className="package-producer-action">Open producer</span>
            </button>
          ) : null}

          <NodeLabels node={node} producedByName={selection.producedByProject?.name} producedPackages={selection.producedPackages} />
        </div>
        <div className="selection-details-panel">
          {repoProjects ? <RepoProjectList selectedId={node.id} projects={repoProjects} onSelect={onSelect} onHoverPath={onHoverPath} /> : null}
          <ProjectImpactSummary title="Affected Tests" empty="No affected test projects" groups={tests} selectedId={node.id} selectedName={node.name} onSelect={onSelect} onHoverPath={onHoverPath} />
          <ProjectImpactSummary title="Affected Deployments" empty="No affected web or service projects" groups={deployables} selectedId={node.id} selectedName={node.name} onSelect={onSelect} onHoverPath={onHoverPath} />
          <ConsumerList selectedId={node.id} selectedName={node.name} groups={consumers} onSelect={onSelect} onHoverPath={onHoverPath} />
          <InternalDependencyList selectedId={node.id} selectedName={node.name} groups={internalDependencies} onSelect={onSelect} onHoverPath={onHoverPath} />
          {showExternal ? <ExternalDependencyList selectedId={node.id} selectedName={node.name} dependencies={selection.externalDependencies} onSelect={onSelect} onHoverPath={onHoverPath} /> : null}
        </div>
      </div>
    </div>
  );
}

function RepoProjectList({ selectedId, projects, onSelect, onHoverPath }: { selectedId: string; projects: ProjectNode[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  return (
    <CollapsibleSection title="Projects" count={projects.length} defaultOpen={false}>
      {projects.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <div className="link-group">
          <ul className="impact-items">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  className="impact-link"
                  type="button"
                  onClick={() => onSelect(project.id)}
                  onMouseEnter={() => onHoverPath([[selectedId, project.id]])}
                  onFocus={() => onHoverPath([[selectedId, project.id]])}
                  onBlur={() => onHoverPath(null)}
                >
                  <span className="impact-link-main">
                    <span className="link-name"><DottedName value={project.name} /></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  );
}

function ProjectImpactSummary({ title, empty, groups, selectedId, selectedName, onSelect, onHoverPath }: { title: string; empty: string; groups: ProjectGroup[]; selectedId: string; selectedName: string; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const impacts = flattenGroups(groups);
  return (
    <CollapsibleSection title={title} count={impacts.length} defaultOpen>
      {impacts.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ProjectImpactGroups groups={groups} selectedId={selectedId} selectedName={selectedName} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function NodeLabels({ node, producedByName, producedPackages }: { node: AnyGraphNode; producedByName?: string; producedPackages?: PackageNode[] }) {
  const labels = nodeLabels(node, producedByName, producedPackages);
  const kindLabels = node.type === "project" ? effectiveProjectKinds(node.kinds) : [];
  if (labels.length === 0 && kindLabels.length === 0) return null;

  return (
    <div className="node-labels">
      {kindLabels.map((kind) => (
        <span key={kind} className={`pill ${kind}`}>{KIND_SHORT[kind]}</span>
      ))}
      {labels.map((label) => <span key={label} className="node-label">{label}</span>)}
    </div>
  );
}

function RowVersionMeta({ consumerVersions, dependencyVersions, selectedName, rowName }: { consumerVersions?: string[]; dependencyVersions?: string[]; selectedName: string; rowName: string }) {
  if ((!consumerVersions || consumerVersions.length === 0) && (!dependencyVersions || dependencyVersions.length === 0)) return null;

  return (
    <span className="row-version-meta">
      {consumerVersions && consumerVersions.length > 0 ? (
        <PortalTooltip text={`${rowName} references ${selectedName} at ${formatVersions(consumerVersions)}.`}>
          <span className="version-chip referenced">refs {formatVersions(consumerVersions)}</span>
        </PortalTooltip>
      ) : null}
      {dependencyVersions && dependencyVersions.length > 0 ? (
        <PortalTooltip text={`${selectedName} is using ${rowName} at ${formatVersions(dependencyVersions)}.`}>
          <span className="version-chip used">using {formatVersions(dependencyVersions)}</span>
        </PortalTooltip>
      ) : null}
    </span>
  );
}

function ConsumerList({
  selectedId,
  selectedName,
  groups,
  onSelect,
  onHoverPath,
}: {
  selectedId: string;
  selectedName: string;
  groups: ProjectGroup[];
  onSelect(id: string): void;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const impacts = flattenGroups(groups);
  return (
    <CollapsibleSection title="All Consumers" count={impacts.length} defaultOpen={false}>
      {impacts.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <ProjectImpactGroups groups={groups} selectedId={selectedId} selectedName={selectedName} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function InternalDependencyList({ selectedId, selectedName, groups, onSelect, onHoverPath }: { selectedId: string; selectedName: string; groups: DependencyGroup[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const dependencies = groups.flatMap((group) => group.dependencies);
  return (
    <CollapsibleSection title="All Dependencies" count={dependencies.length} defaultOpen={false}>
      {dependencies.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <DependencyGroups groups={groups} selectedId={selectedId} selectedName={selectedName} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function ExternalDependencyList({ selectedId, selectedName, dependencies, onSelect, onHoverPath }: { selectedId: string; selectedName: string; dependencies: DependencyItem[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  return (
    <CollapsibleSection title="External packages" count={dependencies.length} defaultOpen={false}>
      {dependencies.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <DependencyRows selectedId={selectedId} selectedName={selectedName} dependencies={dependencies} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function ProjectImpactGroups({ groups, selectedId, selectedName, onSelect, onHoverPath }: { groups: ProjectGroup[]; selectedId: string; selectedName: string; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const impacts = flattenGroups(groups);
  if (impacts.length === 0) return null;

  return (
    <div className="relationship-block">
      <div className="link-groups">
        {groups.map((group) => (
          <div key={group.repoName} className="link-group">
            <div className="impact-title">{group.repoName}</div>
            <ul className="impact-items">
              {group.projects.map((impact) => (
                <li key={impact.project.id}>
                  <button
                    className="impact-link"
                    type="button"
                    onClick={() => onSelect(impact.project.id)}
                    onMouseEnter={() => onHoverPath(pathIdsFor(impact.paths, impact.project.id, selectedId))}
                    onFocus={() => onHoverPath(pathIdsFor(impact.paths, impact.project.id, selectedId))}
                    onBlur={() => onHoverPath(null)}
                  >
                    <span className="impact-link-main">
                      <span className="link-name"><DottedName value={impact.project.name} /></span>
                      <RouteBadge routeKind={impact.routeKind} />
                    </span>
                    <RowVersionMeta consumerVersions={impact.referenceVersions} selectedName={selectedName} rowName={impact.project.name} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function DependencyGroups({ groups, selectedId, selectedName, onSelect, onHoverPath }: { groups: DependencyGroup[]; selectedId: string; selectedName: string; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const dependencies = groups.flatMap((group) => group.dependencies);
  if (dependencies.length === 0) return null;

  return (
    <div className="relationship-block">
      <div className="link-groups">
        {groups.map((group) => (
          <div key={group.repoName} className="link-group">
            <div className="impact-title">{group.repoName}</div>
            <DependencyRows selectedId={selectedId} selectedName={selectedName} dependencies={group.dependencies} onSelect={onSelect} onHoverPath={onHoverPath} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DependencyRows({ selectedId, selectedName, dependencies, onSelect, onHoverPath }: { selectedId: string; selectedName: string; dependencies: DependencyItem[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  return (
    <ul className="impact-items">
      {dependencies.map((dependency) => (
        <li key={dependency.node.id}>
          <button
            className="impact-link"
            type="button"
            onClick={() => onSelect(dependency.node.id)}
            onMouseEnter={() => onHoverPath(pathIdsFor(dependency.paths, dependency.node.id, selectedId))}
            onFocus={() => onHoverPath(pathIdsFor(dependency.paths, dependency.node.id, selectedId))}
            onBlur={() => onHoverPath(null)}
          >
            <span className="impact-link-main">
              <span className="link-name"><DottedName value={dependency.node.name} /></span>
              <RouteBadge routeKind={dependency.routeKind} />
            </span>
            <RowVersionMeta
              dependencyVersions={dependency.referenceVersions}
              selectedName={selectedName}
              rowName={dependency.node.name}
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function CollapsibleSection({ title, count, defaultOpen, children }: { title: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="popover-section">
      <button className="section-title-row" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="section-title-main">
          <span className={`section-caret${open ? " open" : ""}`}>›</span>
          <h3>{title}</h3>
        </span>
        <span className="section-count">{count}</span>
      </button>
      {open ? children : null}
    </section>
  );
}

function RouteBadge({ routeKind }: { routeKind: RouteKind }) {
  const labels: Record<RouteKind, string> = {
    "direct-package": "Direct Package",
    "direct-project": "Direct Project",
    "indirect-package": "Indirect Package",
    "indirect-project": "Indirect Project",
  };
  const help: Record<RouteKind, string> = {
    "direct-package": "Direct NuGet package reference between these projects.",
    "direct-project": "Direct ProjectReference between these projects.",
    "indirect-package": "Reached through a NuGet package dependency chain.",
    "indirect-project": "Reached through a chain of ProjectReferences with no NuGet package in the path.",
  };

  return (
    <PortalTooltip text={help[routeKind]}>
      <span className={`route-badge ${routeKind}`}>{labels[routeKind]}</span>
    </PortalTooltip>
  );
}

function flattenGroups(groups: ProjectGroup[]): ImpactProject[] {
  return groups.flatMap((group) => group.projects);
}

function filterProjectGroups(groups: ProjectGroup[], kindFilters: Record<ProjectKind, boolean>): ProjectGroup[] {
  return groups
    .map((group) => ({
      ...group,
      projects: group.projects.filter((impact) => projectPassesKindFilter(impact.project, kindFilters)),
    }))
    .filter((group) => group.projects.length > 0);
}

function filterDependencyGroups(groups: DependencyGroup[], kindFilters: Record<ProjectKind, boolean>): DependencyGroup[] {
  return groups
    .map((group) => ({
      ...group,
      dependencies: group.dependencies.filter((dependency) => dependency.node.type !== "project" || projectPassesKindFilter(dependency.node, kindFilters)),
    }))
    .filter((group) => group.dependencies.length > 0);
}

function projectPassesKindFilter(project: ProjectNode, kindFilters: Record<ProjectKind, boolean>): boolean {
  return effectiveProjectKinds(project.kinds).some((kind) => kindFilters[kind] !== false);
}

function pathIdsFor(paths: AnyGraphNode[][], fallbackId: string, selectedId: string): string[][] {
  const pathIds = paths.map((path) => path.map((node) => node.id).filter(Boolean));
  const anchoredPaths = pathIds.length > 0 ? pathIds : [[fallbackId]];
  return anchoredPaths.map((ids) => {
    const anchoredIds = ids.length > 0 ? ids : [fallbackId];
    return anchoredIds.includes(selectedId) ? anchoredIds : [selectedId, ...anchoredIds];
  });
}


function nodeLabels(node: AnyGraphNode, producedByName?: string, producedPackages?: PackageNode[]): string[] {
  if (node.type === "project") {
    const packageVersionLabels = packageLabelsForProject(node, producedPackages);
    return [
      ...(node.sdk ? [node.sdk] : []),
      ...((node.tfms || []).length > 0 ? [node.tfms!.join(", ")] : []),
      ...packageVersionLabels,
    ];
  }

  if (node.type === "package") {
    return [
      node.classification || "unknown",
      ...((node.versions || []).length > 0 ? [`${node.versions!.length === 1 ? "Referenced version" : "Referenced versions"} ${node.versions!.join(", ")}`] : ["referenced version unknown"]),
      ...((node.versions || []).length > 1 ? ["version drift"] : []),
      ...(producedByName ? [`produced by ${producedByName}`] : []),
    ];
  }

  if (node.type === "solution") return ["solution"];
  return [];
}

function packageLabelsForProject(project: ProjectNode, producedPackages?: PackageNode[]): string[] {
  if (!project.packageId && (!producedPackages || producedPackages.length === 0)) return [];

  const packages = producedPackages && producedPackages.length > 0
    ? producedPackages
    : [{ id: project.id, name: project.packageId!, versions: [], classification: "internal" } as PackageNode];
  const includePackageName = packages.length > 1;

  return packages.flatMap((pkg) => {
    const v = pkg.versions || [];
    if (v.length === 0) return [];
    const label = v.length === 1 ? "Referenced version" : "Referenced versions";
    return [`${includePackageName ? `${pkg.name} ` : ""}${label} ${v.join(", ")}`];
  });
}

function formatVersions(versions: string[]): string {
  return versions.map((version) => `v${version}`).join(", ");
}

function DottedName({ value }: { value: string }) {
  const parts = value.split(".");
  if (parts.length === 1) return <>{value}</>;

  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? "." : ""}
          {part}
          {index < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </>
  );
}
