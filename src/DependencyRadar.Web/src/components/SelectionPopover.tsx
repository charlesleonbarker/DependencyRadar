import { useCallback, useEffect, useState } from "react";
import type { AnyGraphNode, PackageNode, ProjectKind, ProjectNode } from "../api/types";
import type { DependencyGroup, DependencyItem, ImpactProject, ProjectGroup, RouteKind, SelectionDetails } from "../domain/graphModel";
import { effectiveProjectKinds, KIND_SHORT } from "../domain/projectKinds";
import { PortalTooltip } from "./PortalTooltip";

interface SelectionPopoverProps {
  selection: SelectionDetails | null;
  showExternal: boolean;
  kindFilters: Record<ProjectKind, boolean>;
  focusMode: boolean;
  onClose(): void;
  onFocusToggle(): void;
  onSelect(id: string): void;
  onHoverPath(pathIds: string[][] | null): void;
}

interface CardControl {
  openCardId: string | null;
  onToggleCard(id: string, pathIds: string[][]): void;
}

export function SelectionPopover({ selection, showExternal, kindFilters, focusMode, onClose, onFocusToggle, onSelect, onHoverPath }: SelectionPopoverProps) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useEffect(() => { setOpenCardId(null); }, [selection?.node.id]);
  useEffect(() => { setOpenCardId(null); onHoverPath(null); }, [focusMode]);

  const handleToggleCard = useCallback((id: string, pathIds: string[][]) => {
    const isOpening = openCardId !== id;
    setOpenCardId(isOpening ? id : null);
    onHoverPath(isOpening ? pathIds : null);
  }, [openCardId, onHoverPath]);

  const cardControl: CardControl = { openCardId, onToggleCard: handleToggleCard };

  if (!selection) return null;

  const { node } = selection;
  const repoProjects = selection.repoProjects?.filter((project) => projectPassesKindFilter(project, kindFilters));
  const tests = filterProjectGroups(selection.tests, kindFilters);
  const deployables = filterProjectGroups(selection.deployables, kindFilters);
  const consumers = filterProjectGroups(selection.consumers, kindFilters);
  const internalDependencies = filterDependencyGroups(selection.internalDependencies, kindFilters);

  return (
    <div className="selection-popover">
      <div className="selection-card" onMouseLeave={() => { if (!openCardId) onHoverPath(null); }}>
        <div className="selection-sticky-header">
          <div className="selection-header">
            <h2><DottedName value={node.name} /></h2>
            <div className="selection-header-actions">
              <button className={`ghost-button${focusMode ? " active" : ""}`} type="button" onClick={onFocusToggle}>
                {focusMode ? "Exit Focus" : "Focus"}
              </button>
              <button className="ghost-button" type="button" onClick={onClose}>Close</button>
            </div>
          </div>

          {node.type === "package" && selection.producedByProject ? (
            <button className="package-producer-card" type="button" onClick={() => onSelect(selection.producedByProject!.id)}>
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
          {repoProjects ? <RepoProjectList selectedId={node.id} projects={repoProjects} cardControl={cardControl} onHoverPath={onHoverPath} /> : null}
          <ProjectImpactSummary title="Affected Tests" empty="No affected test projects" groups={tests} selectedId={node.id} cardControl={cardControl} onHoverPath={onHoverPath} />
          <ProjectImpactSummary title="Affected Deployments" empty="No affected web or service projects" groups={deployables} selectedId={node.id} cardControl={cardControl} onHoverPath={onHoverPath} />
          <ConsumerList selectedId={node.id} groups={consumers} cardControl={cardControl} onHoverPath={onHoverPath} />
          <InternalDependencyList selectedId={node.id} selectedName={node.name} groups={internalDependencies} cardControl={cardControl} onHoverPath={onHoverPath} />
          {showExternal ? <ExternalDependencyList selectedId={node.id} selectedName={node.name} dependencies={selection.externalDependencies} cardControl={cardControl} onHoverPath={onHoverPath} /> : null}
        </div>
      </div>
    </div>
  );
}

// ── Row-level click card ──────────────────────────────────────────────────────

function ItemDetailCard({ paths, pathVersions, referenceVersions, selectedId, allPathIds, onHoverPath }: {
  paths: AnyGraphNode[][];
  pathVersions?: Array<Record<string, string>>;
  referenceVersions?: string[];
  selectedId: string;
  allPathIds: string[][];
  onHoverPath(pathIds: string[][] | null): void;
}) {
  if (paths.length === 0) return null;
  const multiRoute = paths.length > 1;
  return (
    <div className="item-detail-card" onMouseLeave={() => onHoverPath(allPathIds)}>
      <div className="detail-routes">
        {multiRoute && <span className="detail-routes-label">{paths.length} routes</span>}
        {paths.map((path, i) => {
          const stepVersions = pathVersions?.[i] ?? {};
          const routeIds = path.map((n) => n.id).filter(Boolean);
          const anchoredIds = routeIds.includes(selectedId) ? routeIds : [selectedId, ...routeIds];
          return (
            <div
              key={i}
              className="path-route"
              onMouseEnter={() => onHoverPath([anchoredIds])}
            >
              <div className="path-chain">
                {path.map((node, j) => {
                  const version = stepVersions[node.id];
                  const referencer = version ? (j > 0 ? path[j - 1] : path[j + 1]) : undefined;
                  const tooltip = referencer
                    ? `${referencer.name} references ${node.name} at v${version}`
                    : version ? `v${version}` : undefined;
                  return (
                    <span key={`${node.id}-${j}`} className="path-step">
                      {j > 0 && <span className="path-arrow">→</span>}
                      <span className="path-node">
                        <DottedName value={node.name} />
                        {version && tooltip && (
                          <PortalTooltip text={tooltip}>
                            <span className="path-version-chip">v{version}</span>
                          </PortalTooltip>
                        )}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Impact row (consumers / tests / deployments) ──────────────────────────────

function ImpactRow({ impact, selectedId, cardControl, onHoverPath }: {
  impact: ImpactProject;
  selectedId: string;
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const pathIds = pathIdsFor(impact.paths, impact.project.id, selectedId);
  const isOpen = cardControl.openCardId === impact.project.id;

  return (
    <li>
      <button
        className={`impact-link${isOpen ? " open" : ""}`}
        type="button"
        onClick={() => cardControl.onToggleCard(impact.project.id, pathIds)}
        onMouseEnter={() => { if (!cardControl.openCardId) onHoverPath(pathIds); }}
        onFocus={() => { if (!cardControl.openCardId) onHoverPath(pathIds); }}
        onBlur={() => { if (!isOpen) onHoverPath(null); }}
      >
        <span className="impact-link-main">
          <span className="link-name"><DottedName value={impact.project.name} /></span>
          <RelationBadge routeKind={impact.routeKind} depth={impact.depth} hasAlternativeRoute={impact.hasAlternativeRoute} />
        </span>
      </button>
      {isOpen ? (
        <ItemDetailCard
          paths={impact.paths}
          pathVersions={impact.pathVersions}
          referenceVersions={impact.referenceVersions}
          selectedId={selectedId}
          allPathIds={pathIds}
          onHoverPath={onHoverPath}
        />
      ) : null}
    </li>
  );
}

// ── Dependency row ────────────────────────────────────────────────────────────

function DependencyRow({ dep, selectedId, selectedName, cardControl, onHoverPath }: {
  dep: DependencyItem;
  selectedId: string;
  selectedName: string;
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const pathIds = pathIdsFor(dep.paths, dep.node.id, selectedId);
  const isOpen = cardControl.openCardId === dep.node.id;

  return (
    <li key={dep.node.id}>
      <button
        className={`impact-link${isOpen ? " open" : ""}`}
        type="button"
        onClick={() => cardControl.onToggleCard(dep.node.id, pathIds)}
        onMouseEnter={() => { if (!cardControl.openCardId) onHoverPath(pathIds); }}
        onFocus={() => { if (!cardControl.openCardId) onHoverPath(pathIds); }}
        onBlur={() => { if (!isOpen) onHoverPath(null); }}
      >
        <span className="impact-link-main">
          <span className="link-name">
            <DottedName value={dep.node.name} />
            {dep.referenceVersions?.map((v) => (
              <PortalTooltip key={v} text={`${selectedName} uses ${dep.node.name} v${v}`}>
                <span className="version-chip used">v{v}</span>
              </PortalTooltip>
            ))}
          </span>
          <RelationBadge routeKind={dep.routeKind} depth={dep.depth} hasAlternativeRoute={dep.hasAlternativeRoute} />
        </span>
      </button>
      {isOpen ? (
        <ItemDetailCard
          paths={dep.paths}
          pathVersions={dep.pathVersions}
          referenceVersions={dep.referenceVersions}
          selectedId={selectedId}
          allPathIds={pathIds}
          onHoverPath={onHoverPath}
        />
      ) : null}
    </li>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function RepoProjectList({ selectedId, projects, cardControl, onHoverPath }: {
  selectedId: string;
  projects: ProjectNode[];
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  return (
    <CollapsibleSection title="Projects" count={projects.length} defaultOpen={false}>
      {projects.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <div className="link-group">
          <ul className="impact-items">
            {projects.map((project) => {
              const pathIds = [[selectedId, project.id]];
              const isOpen = cardControl.openCardId === project.id;
              return (
                <li key={project.id}>
                  <button
                    className={`impact-link${isOpen ? " open" : ""}`}
                    type="button"
                    onClick={() => cardControl.onToggleCard(project.id, pathIds)}
                    onMouseEnter={() => { if (!cardControl.openCardId) onHoverPath(pathIds); }}
                    onFocus={() => { if (!cardControl.openCardId) onHoverPath(pathIds); }}
                    onBlur={() => { if (!isOpen) onHoverPath(null); }}
                  >
                    <span className="impact-link-main">
                      <span className="link-name"><DottedName value={project.name} /></span>
                    </span>
                  </button>
                  {isOpen ? (
                    <ItemDetailCard
                      paths={[[{ id: selectedId, name: selectedId } as AnyGraphNode, { id: project.id, name: project.name } as AnyGraphNode]]}
                      selectedId={selectedId}
                      allPathIds={pathIds}
                      onHoverPath={onHoverPath}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </CollapsibleSection>
  );
}

function ProjectImpactSummary({ title, empty, groups, selectedId, cardControl, onHoverPath }: {
  title: string;
  empty: string;
  groups: ProjectGroup[];
  selectedId: string;
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const impacts = flattenGroups(groups);
  return (
    <CollapsibleSection title={title} count={impacts.length} defaultOpen>
      {impacts.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ProjectImpactGroups groups={groups} selectedId={selectedId} cardControl={cardControl} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function ConsumerList({ selectedId, groups, cardControl, onHoverPath }: {
  selectedId: string;
  groups: ProjectGroup[];
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const impacts = flattenGroups(groups);
  return (
    <CollapsibleSection title="All Consumers" count={impacts.length} defaultOpen={false}>
      {impacts.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <ProjectImpactGroups groups={groups} selectedId={selectedId} cardControl={cardControl} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function InternalDependencyList({ selectedId, selectedName, groups, cardControl, onHoverPath }: {
  selectedId: string;
  selectedName: string;
  groups: DependencyGroup[];
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const dependencies = groups.flatMap((g) => g.dependencies);
  return (
    <CollapsibleSection title="All Dependencies" count={dependencies.length} defaultOpen={false}>
      {dependencies.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <DependencyGroups groups={groups} selectedId={selectedId} selectedName={selectedName} cardControl={cardControl} onHoverPath={onHoverPath} />
      )}
    </CollapsibleSection>
  );
}

function ExternalDependencyList({ selectedId, selectedName, dependencies, cardControl, onHoverPath }: {
  selectedId: string;
  selectedName: string;
  dependencies: DependencyItem[];
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  return (
    <CollapsibleSection title="External packages" count={dependencies.length} defaultOpen={false}>
      {dependencies.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <ul className="impact-items">
          {dependencies.map((dep) => (
            <DependencyRow key={dep.node.id} dep={dep} selectedId={selectedId} selectedName={selectedName} cardControl={cardControl} onHoverPath={onHoverPath} />
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}

function ProjectImpactGroups({ groups, selectedId, cardControl, onHoverPath }: {
  groups: ProjectGroup[];
  selectedId: string;
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  return (
    <div className="relationship-block">
      <div className="link-groups">
        {groups.map((group) => (
          <div key={group.repoName} className="link-group">
            <div className="impact-title">{group.repoName}</div>
            <ul className="impact-items">
              {group.projects.map((impact) => (
                <ImpactRow key={impact.project.id} impact={impact} selectedId={selectedId} cardControl={cardControl} onHoverPath={onHoverPath} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function DependencyGroups({ groups, selectedId, selectedName, cardControl, onHoverPath }: {
  groups: DependencyGroup[];
  selectedId: string;
  selectedName: string;
  cardControl: CardControl;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  return (
    <div className="relationship-block">
      <div className="link-groups">
        {groups.map((group) => (
          <div key={group.repoName} className="link-group">
            <div className="impact-title">{group.repoName}</div>
            <ul className="impact-items">
              {group.dependencies.map((dep) => (
                <DependencyRow key={dep.node.id} dep={dep} selectedId={selectedId} selectedName={selectedName} cardControl={cardControl} onHoverPath={onHoverPath} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function RelationBadge({ routeKind, depth, hasAlternativeRoute }: { routeKind: RouteKind; depth: number; hasAlternativeRoute: boolean }) {
  if (routeKind === "direct-project") {
    return (
      <>
        <span className="route-badge direct">Direct</span>
        {hasAlternativeRoute && <span className="route-badge also-indirect">+ Indirect</span>}
      </>
    );
  }
  if (routeKind === "direct-package") {
    return <span className="route-badge package-dep">Package</span>;
  }
  return <span className="route-badge indirect">Indirect · {depth}</span>;
}

function CollapsibleSection({ title, count, defaultOpen, children }: { title: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="popover-section">
      <button className="section-title-row" type="button" aria-expanded={open} onClick={() => setOpen((c) => !c)}>
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

function NodeLabels({ node, producedByName, producedPackages }: { node: AnyGraphNode; producedByName?: string; producedPackages?: PackageNode[] }) {
  const { labels, versionGroups } = nodeLabels(node, producedByName, producedPackages);
  const kindLabels = node.type === "project" ? effectiveProjectKinds(node.kinds) : [];
  if (labels.length === 0 && kindLabels.length === 0 && versionGroups.length === 0) return null;
  return (
    <div className="node-labels">
      {kindLabels.map((kind) => <span key={kind} className={`pill ${kind}`}>{KIND_SHORT[kind]}</span>)}
      {labels.map((label) => <span key={label} className="node-label">{label}</span>)}
      {versionGroups.map(({ prefix, versions }) => (
        <span key={prefix} className="node-label-versions">
          {prefix && <span className="node-label-prefix">{prefix}</span>}
          {versions.map((v) => <span key={v} className="version-chip">v{v}</span>)}
        </span>
      ))}
    </div>
  );
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenGroups(groups: ProjectGroup[]): ImpactProject[] {
  return groups.flatMap((g) => g.projects);
}

function filterProjectGroups(groups: ProjectGroup[], kindFilters: Record<ProjectKind, boolean>): ProjectGroup[] {
  return groups
    .map((group) => ({ ...group, projects: group.projects.filter((impact) => projectPassesKindFilter(impact.project, kindFilters)) }))
    .filter((group) => group.projects.length > 0);
}

function filterDependencyGroups(groups: DependencyGroup[], kindFilters: Record<ProjectKind, boolean>): DependencyGroup[] {
  return groups
    .map((group) => ({ ...group, dependencies: group.dependencies.filter((dep) => dep.node.type !== "project" || projectPassesKindFilter(dep.node, kindFilters)) }))
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

interface VersionGroup { prefix: string; versions: string[]; }
interface NodeLabelResult { labels: string[]; versionGroups: VersionGroup[]; }

function nodeLabels(node: AnyGraphNode, producedByName?: string, producedPackages?: PackageNode[]): NodeLabelResult {
  if (node.type === "project") {
    const versionGroups = packageVersionGroupsForProject(node, producedPackages);
    const sdkTfm = [node.sdk, (node.tfms || []).join(", ")].filter(Boolean).join(" · ");
    return { labels: sdkTfm ? [sdkTfm] : [], versionGroups };
  }
  if (node.type === "package") {
    const versions = node.versions || [];
    return {
      labels: [
        node.classification || "unknown",
        ...(versions.length === 0 ? ["referenced version unknown"] : []),
        ...(versions.length > 1 ? ["version drift"] : []),
        ...(producedByName ? [`produced by ${producedByName}`] : []),
      ],
      versionGroups: versions.length > 0 ? [{ prefix: "", versions }] : [],
    };
  }
  if (node.type === "solution") return { labels: ["solution"], versionGroups: [] };
  return { labels: [], versionGroups: [] };
}

function packageVersionGroupsForProject(project: ProjectNode, producedPackages?: PackageNode[]): VersionGroup[] {
  if (!project.packageId && (!producedPackages || producedPackages.length === 0)) return [];
  const packages = producedPackages && producedPackages.length > 0
    ? producedPackages
    : [{ id: project.id, name: project.packageId!, versions: [], classification: "internal" } as PackageNode];
  const includePackageName = packages.length > 1;
  return packages.flatMap((pkg) => {
    const v = pkg.versions || [];
    if (v.length === 0) return [];
    return [{ prefix: includePackageName ? pkg.name : "", versions: v }];
  });
}

function formatVersions(versions: string[]): string {
  return versions.map((v) => `v${v}`).join(", ");
}
