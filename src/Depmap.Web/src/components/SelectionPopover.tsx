import type { ImpactProject, ProjectGroup, SelectionDetails } from "../domain/graphModel";
import { effectiveProjectKinds, KIND_LABELS } from "../domain/projectKinds";

interface SelectionPopoverProps {
  selection: SelectionDetails | null;
  onClose(): void;
  onSelect(id: string): void;
}

export function SelectionPopover({ selection, onClose, onSelect }: SelectionPopoverProps) {
  if (!selection) return null;

  const { node } = selection;
  const details: Array<[string, string]> = [["Type", node.type], ["Name", node.name]];

  if (node.type === "project") {
    details.push(["SDK", node.sdk || "Unknown"]);
    details.push(["Kinds", effectiveProjectKinds(node.kinds).join(", ")]);
    details.push(["TFMs", (node.tfms || []).join(", ") || "Unknown"]);
    details.push(["Package ID", node.packageId || "Not packable"]);
  } else if (node.type === "package") {
    details.push(["Classification", node.classification || "unknown"]);
    details.push(["Versions", (node.versions || []).join(", ") || "Unknown"]);
    details.push(["Produced by", selection.producedByProject?.name || "Not resolved"]);
  }

  return (
    <div className="selection-popover">
      <div className="selection-card">
        <div className="selection-header">
          <h2>{node.name}</h2>
          <button className="ghost-button" type="button" title="Close details panel" onClick={onClose}>Close</button>
        </div>

        {node.type === "project" ? (
          <div className="pill-row">
            {effectiveProjectKinds(node.kinds).map((kind) => (
              <span key={kind} className={`pill ${kind}`} title={KIND_LABELS[kind]}>{kind}</span>
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
              <small>Produced by {selection.producedByProject.name}</small>
            </span>
            <span className="package-producer-action">Open producer</span>
          </button>
        ) : null}

        <div className="details-grid">
          {details.map(([label, value]) => (
            <div className="details-row" key={label} title={detailHelp(label)}>
              <div className="details-label">{label}</div>
              <div className="details-value">{value}</div>
            </div>
          ))}
        </div>

        <DependencySummary count={selection.dependencyCount} />
        <ImpactList title="Tests to run" groups={selection.tests} onSelect={onSelect} />
        <ImpactList title="Deployables to smoke-test" groups={selection.deployables} onSelect={onSelect} />
      </div>
    </div>
  );
}

function DependencySummary({ count }: { count: number }) {
  return (
    <section className="popover-section dependency-summary" title="Dependencies are projects or packages this selection uses.">
      <h3>Dependencies used</h3>
      <p className="muted">
        {count === 0
          ? "No local dependencies found."
          : `Uses ${count} local ${count === 1 ? "dependency" : "dependencies"}.`}
      </p>
    </section>
  );
}

function ImpactList({
  title,
  groups,
  onSelect,
}: {
  title: string;
  groups: ProjectGroup[];
  onSelect(id: string): void;
}) {
  const impacts = flattenGroups(groups);
  const directGroups = groupsForDepth(groups, "direct");
  const transitiveGroups = groupsForDepth(groups, "transitive");

  return (
    <section className="popover-section">
      <h3>{title}</h3>
      {impacts.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        <>
          <ImpactDepth title="Direct consumers" help="Projects that reference this selection directly." groups={directGroups} onSelect={onSelect} />
          <ImpactDepth title="Transitive consumers" help="Projects affected through another project or package." groups={transitiveGroups} onSelect={onSelect} />
        </>
      )}
    </section>
  );
}

function ImpactDepth({ title, help, groups, onSelect }: { title: string; help: string; groups: ProjectGroup[]; onSelect(id: string): void }) {
  if (groups.length === 0) return null;

  return (
    <div className="impact-depth">
      <div className="impact-depth-title" title={help}>{title}</div>
      {groups.map((group) => (
        <div key={group.repoName} className="impact-group">
          <div className="impact-title" title="Repository containing these affected projects">{group.repoName}</div>
          <ul className="impact-items">
            {group.projects.map((impact) => (
              <li key={impact.project.id}>
                <button className="impact-link" type="button" title={impactHelp(impact)} onClick={() => onSelect(impact.project.id)}>
                  <span className="impact-link-main">
                    <span>{impact.project.name}</span>
                    {impact.hasAlternativeRoute ? <span className="route-note">multiple routes</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function flattenGroups(groups: ProjectGroup[]): ImpactProject[] {
  return groups.flatMap((group) => group.projects);
}

function groupsForDepth(groups: ProjectGroup[], depth: "direct" | "transitive"): ProjectGroup[] {
  return groups
    .map((group) => ({
      repoName: group.repoName,
      projects: group.projects.filter((impact) => (depth === "direct" ? impact.depth <= 1 : impact.depth > 1)),
    }))
    .filter((group) => group.projects.length > 0);
}

function impactHelp(impact: ImpactProject): string {
  const base = impact.depth <= 1
    ? "Directly affected by this selection."
    : "Affected through another project or package.";

  return impact.hasAlternativeRoute
    ? `${base} Also reachable through another dependency route; the nearest route is shown in this section.`
    : base;
}

function detailHelp(label: string): string {
  switch (label) {
    case "Type":
      return "Graph node type: project, package, repo, or solution.";
    case "SDK":
      return ".NET SDK declared by the project file.";
    case "Kinds":
      return "Local classification inferred from project metadata.";
    case "TFMs":
      return "Target Framework Monikers built by this project.";
    case "Package ID":
      return "NuGet package ID produced by this project, when packable.";
    case "Classification":
      return "Whether a package was resolved as internal, external, or unknown from local data.";
    case "Versions":
      return "Package versions seen in local project references or restore data.";
    case "Produced by":
      return "Local project that produces this internal package.";
    default:
      return label;
  }
}
