import type { GraphSummary, MonitorStatus } from "../api/types";
import { formatDate } from "../domain/graphModel";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS } from "../domain/projectKinds";

interface HelpContentProps {
  status: MonitorStatus | null;
  counts: GraphSummary;
}

export function HelpContent({ status, counts }: HelpContentProps) {
  return (
    <>
      <section className="modal-section">
        <h3>What this is</h3>
        <p className="muted">Dependency Radar scans configured local repo roots and builds a live dependency map from <code>.csproj</code>, <code>ProjectReference</code>, and <code>PackageReference</code> data. Select any project, repo, or package to see its full blast radius — which projects, tests, and deployables would need attention if that node changes.</p>
      </section>

      <section className="modal-section">
        <h3>Using the map</h3>
        <ul className="help-list">
          <li><strong>Search</strong> by repo name, project, assembly, or package ID. Arrow keys navigate results; Enter opens the impact view for that node.</li>
          <li><strong>Consumers</strong> are projects that depend on the selected node — candidates for retest after a breaking change.</li>
          <li><strong>Dependencies</strong> are projects and packages used by the selected node — explains why the selected code can break after an upstream change.</li>
          <li><strong>Affected tests and deployables</strong> are listed as project paths in the side panel.</li>
          <li><strong>Filters</strong> hide project types or surface external and unresolved packages when package-level inspection matters.</li>
          <li><strong>Group by repo</strong> clusters projects under their repository. Disable it to see the flat project graph.</li>
          <li><strong>Layouts</strong> (bottom-right): <em>Dependency Paths</em> traces direction, <em>Cluster Map</em> separates dense areas, <em>Most Referenced</em> centres high-traffic nodes.</li>
          <li>Selecting a node updates the URL — share or bookmark a deep link to any node.</li>
        </ul>
      </section>

      <section className="modal-section">
        <h3>Reading the graph</h3>
        <p className="muted">No network calls are made to NuGet or GitHub. Packages that cannot be resolved from the scanned repos stay <em>unknown</em> rather than being guessed at.</p>
        <div className="key-grid">
          <div className="key-block">
            <div className="key-label">Shapes</div>
            <div className="key-item"><span className="swatch swatch-project" /><span>Project</span></div>
            <div className="key-item"><span className="swatch swatch-package" /><span>NuGet package</span></div>
            <div className="key-item"><span className="swatch swatch-repo" /><span>Repository group</span></div>
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
            <div className="key-item edge-key"><span className="edge-swatch edge-package" /><span>NuGet package reference</span></div>
          </div>
        </div>
      </section>

      <section className="modal-section">
        <h3>Impact Panel</h3>
        <ul className="help-list">
          <li><strong>Affected Tests</strong> are test projects reached by reverse dependency traversal from the selected node.</li>
          <li><strong>Affected Deployments</strong> are web or worker/service projects that may need redeploying if the selected node changes.</li>
          <li><strong>All Consumers</strong> lists every project that depends on the selected node, directly or indirectly.</li>
          <li><strong>All Dependencies</strong> lists internal projects or locally resolved NuGet packages used by the selected node.</li>
          <li><strong>External packages</strong> lists unresolved or external NuGet packages when external package visibility is enabled.</li>
          <li><strong>Direct</strong> means there is a single ProjectReference or PackageReference connecting the two nodes with no intermediate hops.</li>
          <li><strong>Indirect (n)</strong> means the route passes through n intermediate nodes — projects or packages — before reaching the destination. Click any row to expand the full route chain.</li>
          <li><strong>Referenced version</strong> on the selected node lists the NuGet package versions found in local consumers. If more than one version is referenced, the panel shows <strong>Referenced versions</strong> with the full comma-separated set.</li>
          <li><strong>refs vX</strong> appears on consumer rows. It means that row, or a project underneath it in the impact path, references the selected NuGet package version.</li>
          <li><strong>using vX</strong> appears on dependency rows. It means the selected node, or a project underneath it in the dependency path, uses that dependency package version.</li>
          <li>Hover a version pill to see which side of the relationship the version belongs to.</li>
        </ul>
      </section>

      <section className="modal-section">
        <h3>Monitor</h3>
        <div className="monitor-line">
          <MonitorStat label="Repos" value={counts.repoCount || 0} />
          <MonitorStat label="Projects" value={counts.projectCount || 0} />
          <MonitorStat label="Packages" value={counts.packageCount || 0} />
          <MonitorStat label="Edges" value={counts.edgeCount || 0} />
          <span className="monitor-scan">Last scan: {formatDate(status?.lastScanAt)}</span>
        </div>
        <p className="legend-note">The backend watches configured repo roots and rescans automatically after file changes. The graph updates in the browser via a live event stream.</p>
        {status?.lastError ? <p className="monitor-error">{status.lastError}</p> : null}
      </section>

      <section className="modal-section">
        <h3>License & credits</h3>
        <p className="muted">Dependency Radar is licensed under the MIT License. <a href="https://github.com/charlesleonbarker/DependencyRadar" target="_blank" rel="noreferrer">github.com/charlesleonbarker/DependencyRadar</a>.</p>
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
          <Credit name="Scheduler" license="MIT" credit="Copyright (c) Facebook, Inc. and its affiliates." />
          <Credit name="loose-envify" license="MIT" credit="Copyright (c) 2015 Andres Suarez." />
          <Credit name="js-tokens" license="MIT" credit="Copyright (c) 2014-2018 Simon Lydell." />
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
