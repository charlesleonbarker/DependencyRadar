import type { GraphSummary, MonitorStatus } from "../api/types";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS, KIND_NOTES } from "../domain/projectKinds";
import { formatDate } from "../domain/graphModel";

interface HelpContentProps {
  status: MonitorStatus | null;
  counts: GraphSummary;
  onRescan(): void;
  rescanning: boolean;
}

export function HelpContent({ status, counts, onRescan, rescanning }: HelpContentProps) {
  return (
    <>
      <section className="modal-section">
        <h3>Walkthrough</h3>
        <ol className="help-list">
          <li>Use smart search to find projects or packages and jump directly to them.</li>
          <li>Open Filters from the search dock to hide project types or unresolved packages.</li>
          <li>Flow is the best default layout for tracing dependency direction across the estate.</li>
          <li>Selecting a node highlights its linked neighborhood in the current map and fits that set into the viewport.</li>
          <li>Project references, direct package references, indirect package edges from assets files, and internal producer links are always shown together.</li>
        </ol>
      </section>

      <section className="modal-section">
        <h3>Shapes, colors, and line types</h3>
        <div className="key-grid">
          <div className="key-block">
            <div className="key-label">Shapes</div>
            <div className="key-item"><span className="swatch swatch-project" /><span>Project</span></div>
            <div className="key-item"><span className="swatch swatch-package" /><span>Package</span></div>
            <div className="key-item"><span className="swatch swatch-repo" /><span>Repo group</span></div>
          </div>
          <div className="key-block">
            <div className="key-label">Project colors</div>
            {DEFAULT_KINDS.map((kind) => (
              <div className="key-item" key={kind}>
                <span className={`color-chip ${KIND_CLASS[kind]}`} />
                <span>{KIND_LABELS[kind]}: {KIND_NOTES[kind]}</span>
              </div>
            ))}
          </div>
          <div className="key-block">
            <div className="key-label">Edges</div>
            <div className="key-item"><span className="edge-swatch edge-project" /><span>Project reference</span></div>
            <div className="key-item"><span className="edge-swatch edge-package" /><span>Direct package reference</span></div>
            <div className="key-item"><span className="edge-swatch edge-transitive" /><span>Indirect package edge from restore data</span></div>
            <div className="key-item"><span className="edge-swatch edge-produced" /><span>Internal package produced by project</span></div>
          </div>
        </div>
        <p className="legend-note">Red glow marks upstream blast radius. Teal glow marks downstream dependencies. A selected item gets a stronger dark outline.</p>
      </section>

      <section className="modal-section">
        <h3>Monitor</h3>
        <div className="monitor-state"><span className={`status-chip ${status?.state || "idle"}`}>{status?.state || "idle"}</span></div>
        <div className="stats-grid">
          <Stat label="Repos" value={counts.repoCount || 0} />
          <Stat label="Projects" value={counts.projectCount || 0} />
          <Stat label="Packages" value={counts.packageCount || 0} />
          <Stat label="Edges" value={counts.edgeCount || 0} />
        </div>
        <p className="muted">Last scan: {formatDate(status?.lastScanAt)}</p>
        {status?.lastError ? <p className="monitor-error">{status.lastError}</p> : null}
        <button className="button" type="button" onClick={onRescan} disabled={rescanning}>
          {rescanning ? "Rescanning..." : "Rescan now"}
        </button>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
