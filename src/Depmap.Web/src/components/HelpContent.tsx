import type { GraphSummary, MonitorStatus } from "../api/types";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS } from "../domain/projectKinds";
import { formatDate } from "../domain/graphModel";

interface HelpContentProps {
  status: MonitorStatus | null;
  counts: GraphSummary;
}

export function HelpContent({ status, counts }: HelpContentProps) {
  return (
    <>
      <section className="modal-section">
        <h3>What this is</h3>
        <p className="muted">Dependency Radar scans configured local repo roots and builds a map from `.csproj`, `ProjectReference`, and `PackageReference` data. Select a project, repo, or package to see what may need retesting or redeploying if that node changes.</p>
      </section>

      <section className="modal-section">
        <h3>Using the map</h3>
        <ul className="help-list">
          <li>Search for a repo, project, assembly, or package ID. Arrow keys choose a result; Enter opens its impact view.</li>
          <li>Consumers are projects that depend on the selected node. These are the candidates for retest after a breaking change.</li>
          <li>Dependencies are projects or packages used by the selected node. These explain why the selected code may break after an upstream change.</li>
          <li>Affected tests and deployables are listed as project paths; the app does not generate `dotnet test` commands.</li>
          <li>Use <strong>Filters</strong> to hide project types or show external/unresolved packages when package-level inspection matters.</li>
          <li>Switch layouts bottom-right: <strong>Dependency Paths</strong> traces direction, <strong>Cluster Map</strong> separates dense areas, and <strong>Most Referenced</strong> centres high-traffic nodes.</li>
        </ul>
      </section>

      <section className="modal-section">
        <h3>Reading the graph</h3>
        <p className="muted">Dependency Radar does not fetch NuGet or GitHub metadata. If a package cannot be resolved from scanned repos, it stays unknown rather than being guessed.</p>
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
            <div className="key-label">.NET project types</div>
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
            <div className="key-item edge-key"><span className="edge-swatch edge-produced" /><span>Produced by project</span></div>
          </div>
        </div>
        <p className="legend-note"><strong>Produced by project</strong> means an internal package ID is built by a project in the scanned repos. That edge connects package consumers back to source, so a change in the producer can highlight projects that consume the internal NuGet package.</p>
      </section>

      <section className="modal-section">
        <h3>Monitor</h3>
        <div className="monitor-line">
          <span className={`status-chip ${status?.state || "idle"}`}>{status?.state || "idle"}</span>
          <MonitorStat label="Repos" value={counts.repoCount || 0} />
          <MonitorStat label="Projects" value={counts.projectCount || 0} />
          <MonitorStat label="Packages" value={counts.packageCount || 0} />
          <MonitorStat label="Edges" value={counts.edgeCount || 0} />
          <span className="monitor-scan">Last scan: {formatDate(status?.lastScanAt)}</span>
        </div>
        <p className="legend-note">The backend watches configured roots and rescans automatically after file changes. `POST /api/rescan` remains available for development and diagnostics.</p>
        {status?.lastError ? <p className="monitor-error">{status.lastError}</p> : null}
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

function MonitorStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="monitor-stat">
      <span className="monitor-stat-value">{value}</span>
      <span className="monitor-stat-label">{label}</span>
    </span>
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
