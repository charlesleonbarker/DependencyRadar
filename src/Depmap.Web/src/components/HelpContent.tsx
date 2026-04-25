import type { GraphSummary, MonitorStatus } from "../api/types";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS } from "../domain/projectKinds";
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
        <h3>What this is</h3>
        <p className="muted">Dependency Radar walks your configured repo roots and maps every .NET project, package, and solution into a live dependency graph. Select any node to trace its blast radius: which tests to run and which deployables are affected.</p>
      </section>

      <section className="modal-section">
        <h3>Using the map</h3>
        <ul className="help-list">
          <li>Search for any project or package, use arrow keys to choose a result, and press Enter to jump to its affected neighborhood.</li>
          <li>Selecting a node highlights affected consumers and dependencies, then fits the visible context into the viewport.</li>
          <li>The inspector opens under search and separates direct and transitive affected projects.</li>
          <li>Use <strong>Filters</strong> to hide project types or show unresolved package nodes when package-level inspection matters.</li>
          <li>Switch layouts bottom-right: <strong>Dependency Paths</strong> traces direction, <strong>Cluster Map</strong> separates dense areas, and <strong>Most Referenced</strong> centres high-traffic nodes.</li>
        </ul>
      </section>

      <section className="modal-section">
        <h3>Reading the graph</h3>
        <div className="key-grid">
          <div className="key-block">
            <div className="key-label">Shapes</div>
            <div className="key-item"><span className="swatch swatch-project" /><span>Project</span></div>
            <div className="key-item"><span className="swatch swatch-package" /><span>Package</span></div>
            <div className="key-item"><span className="swatch swatch-repo" /><span>Repo group</span></div>
          </div>
          <div className="key-block">
            <div className="key-label">Selection states</div>
            <div className="key-item"><span className="swatch swatch-selected" /><span>Selected node</span></div>
            <div className="key-item"><span className="swatch swatch-ancestor" /><span>Affected consumers</span></div>
            <div className="key-item"><span className="swatch swatch-descendant" /><span>Dependencies used by selection</span></div>
          </div>
          <div className="key-block">
            <div className="key-label">Project types</div>
            {DEFAULT_KINDS.map((kind) => (
              <div className="key-item" key={kind}>
                <span className={`shape-chip project-shape ${KIND_CLASS[kind]}`} />
                <span>{KIND_LABELS[kind]}</span>
              </div>
            ))}
          </div>
          <div className="key-block">
            <div className="key-label">Edges</div>
            <div className="key-item edge-key"><span className="edge-swatch edge-project" /><span>Project reference</span></div>
            <div className="key-item edge-key"><span className="edge-swatch edge-package" /><span>Direct package ref</span></div>
            <div className="key-item edge-key"><span className="edge-swatch edge-transitive" /><span>Indirect (restore data)</span></div>
            <div className="key-item edge-key"><span className="edge-swatch edge-produced" /><span>Produced by project</span></div>
          </div>
        </div>
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
          {rescanning ? "Rescanning…" : "Rescan now"}
        </button>
      </section>

      <section className="modal-section">
        <h3>License & credits</h3>
        <p className="muted">Dependency Radar is made by Charlie Barker and licensed under the MIT License. <a href="https://github.com/charlesleonbarker/DependencyRadar" target="_blank" rel="noreferrer">github.com/charlesleonbarker/DependencyRadar</a>.</p>
        <div className="credits-list">
          <Credit name="React" license="MIT" credit="Copyright (c) Facebook, Inc. and its affiliates." />
          <Credit name="React DOM" license="MIT" credit="Copyright (c) Facebook, Inc. and its affiliates." />
          <Credit name="Cytoscape.js" license="MIT" credit="Copyright (c) 2016-2026, The Cytoscape Consortium." />
          <Credit name="cytoscape-dagre" license="MIT" credit="Copyright (c) 2016-2018, 2020, 2022, The Cytoscape Consortium." />
          <Credit name="cytoscape-fcose" license="MIT" credit="Copyright (c) 2018-present, iVis-at-Bilkent." />
          <Credit name="Dagre" license="MIT" credit="Copyright (c) 2012-2014 Chris Pettitt." />
          <Credit name="Graphlib" license="MIT" credit="Copyright (c) 2012-2014 Chris Pettitt." />
          <Credit name="Lodash" license="MIT" credit="Copyright OpenJS Foundation and other contributors." />
          <Credit name="cose-base" license="MIT" credit="Copyright (c) 2019-present, iVis@Bilkent." />
          <Credit name="layout-base" license="MIT" credit="Copyright (c) 2019 iVis@Bilkent." />
        </div>
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

function Credit({ name, license, credit }: { name: string; license: string; credit: string }) {
  return (
    <div className="credit-item">
      <span className="credit-name">{name}</span>
      <span className="credit-license">{license}</span>
      <span className="credit-text">{credit}</span>
    </div>
  );
}
