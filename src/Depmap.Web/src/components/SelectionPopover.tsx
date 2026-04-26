import type { AnyGraphNode, ProjectKind, ProjectNode } from "../api/types";
import type { DependencyGroup, DependencyItem, ImpactProject, ProjectGroup, SelectionDetails } from "../domain/graphModel";
import { effectiveProjectKinds, KIND_CLASS, KIND_LABELS, KIND_SHORT } from "../domain/projectKinds";

interface SelectionPopoverProps {
  selection: SelectionDetails | null;
  showExternal: boolean;
  onClose(): void;
  onSelect(id: string): void;
  onHoverPath(pathIds: string[][] | null): void;
}

export function SelectionPopover({ selection, showExternal, onClose, onSelect, onHoverPath }: SelectionPopoverProps) {
  if (!selection) return null;

  const { node } = selection;

  return (
    <div className="selection-popover">
      <div className="selection-card" onMouseLeave={() => onHoverPath(null)}>
        <div className="selection-sticky-header">
          <div className="selection-header">
            <h2><DottedName value={node.name} /></h2>
            <button className="ghost-button" type="button" title="Close details panel" onClick={onClose}>Close</button>
          </div>

          {node.type === "project" ? (
            <div className="pill-row">
              {effectiveProjectKinds(node.kinds).map((kind) => (
                <span key={kind} className={`pill ${kind}`} title={KIND_LABELS[kind]}>{KIND_SHORT[kind]}</span>
              ))}
            </div>
          ) : null}

          {node.type === "package" && selection.producedByProject ? (
            <button
              className="package-producer-card"
              type="button"
              title="Open the project that produces this internal NuGet package"
              onClick={() => onSelect(selection.producedByProject!.id)}
            >
              <span>
                <strong>Internal package</strong>
                <small>This package is built by <DottedName value={selection.producedByProject.name} /></small>
              </span>
              <span className="package-producer-action">Open producer</span>
            </button>
          ) : null}

          <NodeLabels node={node} producedByName={selection.producedByProject?.name} />
        </div>
        {selection.repoProjects ? <RepoProjectList selectedId={node.id} projects={selection.repoProjects} onSelect={onSelect} onHoverPath={onHoverPath} /> : null}
        <ProjectImpactSummary title="Affected tests" empty="No affected test projects" groups={selection.tests} selectedId={node.id} onSelect={onSelect} onHoverPath={onHoverPath} />
        <ProjectImpactSummary title="Deployables" empty="No affected web or service projects" groups={selection.deployables} selectedId={node.id} onSelect={onSelect} onHoverPath={onHoverPath} />
        <ConsumerList selectedId={node.id} groups={selection.consumers} onSelect={onSelect} onHoverPath={onHoverPath} />
        <InternalDependencyList selectedId={node.id} groups={selection.internalDependencies} onSelect={onSelect} onHoverPath={onHoverPath} />
        {showExternal ? <ExternalDependencyList selectedId={node.id} dependencies={selection.externalDependencies} onSelect={onSelect} onHoverPath={onHoverPath} /> : null}
      </div>
    </div>
  );
}

function RepoProjectList({ selectedId, projects, onSelect, onHoverPath }: { selectedId: string; projects: ProjectNode[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  return (
    <section className="popover-section">
      <SectionTitle title="Projects" count={projects.length} />
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
                  title="Open this project"
                  onClick={() => onSelect(project.id)}
                  onMouseEnter={() => onHoverPath([[selectedId, project.id]])}
                  onFocus={() => onHoverPath([[selectedId, project.id]])}
                  onBlur={() => onHoverPath(null)}
                >
                  <span className="impact-link-main">
                    <span className="link-name"><DottedName value={project.name} /></span>
                  </span>
                  <ProjectKindLabels kinds={project.kinds} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ProjectImpactSummary({ title, empty, groups, selectedId, onSelect, onHoverPath }: { title: string; empty: string; groups: ProjectGroup[]; selectedId: string; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const impacts = flattenGroups(groups);
  return (
    <section className="popover-section">
      <SectionTitle title={title} count={impacts.length} />
      {impacts.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ProjectImpactGroups label="Projects" groups={groups} selectedId={selectedId} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </section>
  );
}

function NodeLabels({ node, producedByName }: { node: AnyGraphNode; producedByName?: string }) {
  const labels = nodeLabels(node, producedByName);
  if (labels.length === 0) return null;

  return <div className="node-labels">{labels.map((label) => <span key={label} className="node-label">{label}</span>)}</div>;
}

function ConsumerList({
  selectedId,
  groups,
  onSelect,
  onHoverPath,
}: {
  selectedId: string;
  groups: ProjectGroup[];
  onSelect(id: string): void;
  onHoverPath(pathIds: string[][] | null): void;
}) {
  const impacts = flattenGroups(groups);
  const directGroups = splitProjectGroups(groups, (impact) => impact.depth <= 1);
  const indirectGroups = splitProjectGroups(groups, (impact) => impact.depth > 1);

  return (
    <section className="popover-section">
      <SectionTitle title="Consumers" count={impacts.length} />
      {impacts.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <>
          <ProjectImpactGroups label="Direct consumers" groups={directGroups} selectedId={selectedId} onSelect={onSelect} onHoverPath={onHoverPath} />
          <ProjectImpactGroups label="Indirect consumers" groups={indirectGroups} selectedId={selectedId} onSelect={onSelect} onHoverPath={onHoverPath} />
        </>
      )}
    </section>
  );
}

function InternalDependencyList({ selectedId, groups, onSelect, onHoverPath }: { selectedId: string; groups: DependencyGroup[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const dependencies = groups.flatMap((group) => group.dependencies);
  return (
    <section className="popover-section">
      <SectionTitle title="Internal dependencies" count={dependencies.length} />
      {dependencies.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <DependencyGroups groups={groups} selectedId={selectedId} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </section>
  );
}

function ExternalDependencyList({ selectedId, dependencies, onSelect, onHoverPath }: { selectedId: string; dependencies: DependencyItem[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  return (
    <section className="popover-section">
      <SectionTitle title="External packages" count={dependencies.length} />
      {dependencies.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <DependencyRows selectedId={selectedId} dependencies={dependencies} onSelect={onSelect} onHoverPath={onHoverPath} />
      )}
    </section>
  );
}

function ProjectImpactGroups({ label, groups, selectedId, onSelect, onHoverPath }: { label: string; groups: ProjectGroup[]; selectedId: string; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const impacts = flattenGroups(groups);
  if (impacts.length === 0) return null;

  return (
    <div className="relationship-block">
      <div className="relationship-label">{label}</div>
      <div className="link-groups">
        {groups.map((group) => (
          <div key={group.repoName} className="link-group">
            <div className="impact-title" title="Repository containing these affected projects">{group.repoName}</div>
            <ul className="impact-items">
              {group.projects.map((impact) => (
                <li key={impact.project.id}>
                  <button
                    className="impact-link"
                    type="button"
                    title={impactHelp(impact)}
                    onClick={() => onSelect(impact.project.id)}
                    onMouseEnter={() => onHoverPath(pathIdsFor(impact.paths, impact.project.id, selectedId))}
                    onFocus={() => onHoverPath(pathIdsFor(impact.paths, impact.project.id, selectedId))}
                    onBlur={() => onHoverPath(null)}
                  >
                    <span className="impact-link-main">
                      <span className="link-name"><DottedName value={impact.project.name} /></span>
                      <RouteBadge depth={impact.depth} hasAlternativeRoute={impact.hasAlternativeRoute} />
                    </span>
                    <ProjectKindLabels kinds={impact.project.kinds} />
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

function DependencyGroups({ groups, selectedId, onSelect, onHoverPath }: { groups: DependencyGroup[]; selectedId: string; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  const dependencies = groups.flatMap((group) => group.dependencies);
  if (dependencies.length === 0) return null;

  return (
    <div className="relationship-block">
      <div className="link-groups">
        {groups.map((group) => (
          <div key={group.repoName} className="link-group">
            <div className="impact-title" title="Repository containing these dependencies">{group.repoName}</div>
            <DependencyRows selectedId={selectedId} dependencies={group.dependencies} onSelect={onSelect} onHoverPath={onHoverPath} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DependencyRows({ selectedId, dependencies, onSelect, onHoverPath }: { selectedId: string; dependencies: DependencyItem[]; onSelect(id: string): void; onHoverPath(pathIds: string[][] | null): void }) {
  return (
    <ul className="impact-items">
      {dependencies.map((dependency) => (
        <li key={dependency.node.id}>
          <button
            className="impact-link"
            type="button"
            title={dependencyHelp(dependency)}
            onClick={() => onSelect(dependency.node.id)}
            onMouseEnter={() => onHoverPath(pathIdsFor(dependency.paths, dependency.node.id, selectedId))}
            onFocus={() => onHoverPath(pathIdsFor(dependency.paths, dependency.node.id, selectedId))}
            onBlur={() => onHoverPath(null)}
          >
            <span className="impact-link-main">
              <span className="link-name"><DottedName value={dependency.node.name} /></span>
              <RouteBadge depth={dependency.depth} hasAlternativeRoute={dependency.hasAlternativeRoute} />
            </span>
            <span className="link-meta">
              {dependency.node.type === "project" ? <ProjectKindLabels kinds={dependency.node.kinds} /> : packageLabel(dependency.node)}
              <ReferenceVersionLabels versions={dependency.referenceVersions} />
              {dependency.node.type === "package" ? <PackageVersionLabels versions={dependency.node.versions} /> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="section-title-row">
      <h3>{title}</h3>
      <span className="section-count">{count}</span>
    </div>
  );
}

function RouteBadge({ depth, hasAlternativeRoute }: { depth: number; hasAlternativeRoute: boolean }) {
  const route = depth <= 1 && hasAlternativeRoute ? "dual" : depth <= 1 ? "direct" : "indirect";
  const help = route === "dual"
    ? "Direct, and also reachable through another route. Retesting should consider both paths."
    : route === "direct"
      ? "Direct reference from the selected node or repo."
      : "Reached through another project or package dependency.";
  return <span className={`route-badge ${route} has-tooltip`} data-tooltip={help}>{route === "dual" ? "dual source" : route}</span>;
}

function ProjectKindLabels({ kinds }: { kinds?: ProjectKind[] }) {
  return (
    <span className="kind-labels">
      {effectiveProjectKinds(kinds).map((kind) => (
        <span key={kind} className={`node-label ${KIND_CLASS[kind]}`} title={KIND_LABELS[kind]}>{KIND_SHORT[kind]}</span>
      ))}
    </span>
  );
}

function flattenGroups(groups: ProjectGroup[]): ImpactProject[] {
  return groups.flatMap((group) => group.projects);
}

function splitProjectGroups(groups: ProjectGroup[], predicate: (impact: ImpactProject) => boolean): ProjectGroup[] {
  return groups
    .map((group) => ({ ...group, projects: group.projects.filter(predicate) }))
    .filter((group) => group.projects.length > 0);
}

function pathIdsFor(paths: AnyGraphNode[][], fallbackId: string, selectedId: string): string[][] {
  const pathIds = paths.map((path) => path.map((node) => node.id).filter(Boolean));
  const anchoredPaths = pathIds.length > 0 ? pathIds : [[fallbackId]];
  return anchoredPaths.map((ids) => {
    const anchoredIds = ids.length > 0 ? ids : [fallbackId];
    return anchoredIds.includes(selectedId) ? anchoredIds : [selectedId, ...anchoredIds];
  });
}

function impactHelp(impact: ImpactProject): string {
  const base = impact.depth <= 1
    ? "Directly affected by this selection."
    : "Affected through another project or package.";

  return impact.hasAlternativeRoute
    ? `${base} Also reachable through another dependency route; the nearest route is shown in this section.`
    : base;
}

function dependencyHelp(dependency: DependencyItem): string {
  const route = dependency.depth <= 1 ? "Referenced directly by this selection." : "Reached through another project or package.";
  const versions = dependency.referenceVersions?.length ? ` Referenced version: ${dependency.referenceVersions.join(", ")}.` : "";
  return dependency.hasAlternativeRoute
    ? `${route}${versions} Also reachable through another dependency route.`
    : `${route}${versions}`;
}

function nodeLabels(node: AnyGraphNode, producedByName?: string): string[] {
  if (node.type === "project") {
    return [
      ...(node.sdk ? [node.sdk] : []),
      ...((node.tfms || []).length > 0 ? [node.tfms!.join(", ")] : []),
      ...(node.packageId ? [`package ${node.packageId}`] : []),
    ];
  }

  if (node.type === "package") {
    return [
      node.classification || "unknown",
      ...((node.versions || []).length > 0 ? [`versions ${node.versions!.join(", ")}`] : ["version unknown"]),
      ...((node.versions || []).length > 1 ? ["version drift"] : []),
      ...(producedByName ? [`produced by ${producedByName}`] : []),
    ];
  }

  if (node.type === "solution") return ["solution"];
  return [];
}

function packageLabel(node: AnyGraphNode) {
  if (node.type !== "package") return null;
  return <span className="node-label">{node.classification || "unknown"}</span>;
}

function PackageVersionLabels({ versions }: { versions?: string[] }) {
  if (!versions || versions.length === 0) return <span className="node-label">version unknown</span>;

  return (
    <>
      <span className="node-label">v {versions.join(", ")}</span>
      {versions.length > 1 ? <span className="node-label version-drift">version drift</span> : null}
    </>
  );
}

function ReferenceVersionLabels({ versions }: { versions?: string[] }) {
  if (!versions || versions.length === 0) return null;

  return (
    <>
      {versions.map((version) => (
        <span key={version} className={`node-label version-${versionKind(version)}`}>ref {versionKind(version)} {version}</span>
      ))}
    </>
  );
}

function versionKind(version: string): "exact" | "range" | "floating" {
  const trimmed = version.trim();
  if (trimmed.includes("*") || /(^|[.-])[xX]($|[.-])/.test(trimmed)) return "floating";
  if (/^[[(].*[\])]$/.test(trimmed) || trimmed.includes(",")) return "range";
  return "exact";
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
