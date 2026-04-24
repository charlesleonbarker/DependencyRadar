import type { ProjectGroup, SelectionDetails } from "../domain/graphModel";
import { effectiveProjectKinds } from "../domain/projectKinds";

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
    details.push(["Produced by", node.producedBy || "Not resolved"]);
  }

  return (
    <div className="selection-popover">
      <div className="selection-card">
        <div className="selection-header">
          <h2>{node.name}</h2>
          <button className="ghost-button" type="button" onClick={onClose}>Close</button>
        </div>

        {node.type === "project" ? (
          <div className="pill-row">
            {effectiveProjectKinds(node.kinds).map((kind) => <span key={kind} className={`pill ${kind}`}>{kind}</span>)}
          </div>
        ) : null}

        <div className="details-grid">
          {details.map(([label, value]) => (
            <div className="details-row" key={label}>
              <div className="details-label">{label}</div>
              <div className="details-value">{value}</div>
            </div>
          ))}
        </div>

        <ImpactList title="Tests to run" groups={selection.tests} onSelect={onSelect} />
        <ImpactList title="Deployables to smoke-test" groups={selection.deployables} onSelect={onSelect} />
      </div>
    </div>
  );
}

function ImpactList({ title, groups, onSelect }: { title: string; groups: ProjectGroup[]; onSelect(id: string): void }) {
  return (
    <section className="popover-section">
      <h3>{title}</h3>
      {groups.length === 0 ? (
        <p className="muted">None</p>
      ) : (
        groups.map((group) => (
          <div key={group.repoName} className="impact-group">
            <div className="impact-title"><span>{group.repoName}</span><span className="pill">{group.projects.length}</span></div>
            <ul className="impact-items">
              {group.projects.map((project) => (
                <li key={project.id}>
                  <button className="impact-link" type="button" onClick={() => onSelect(project.id)}>
                    {project.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
