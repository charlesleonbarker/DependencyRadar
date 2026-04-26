import type { LayoutId } from "../graph/cytoscapeModel";
import { PortalTooltip } from "./PortalTooltip";

const LAYOUT_OPTIONS: Array<{ id: LayoutId; label: string; note: string }> = [
  { id: "dagre",      label: "Dependency Paths", note: "Arrange projects left-to-right so dependency direction is easier to trace." },
  { id: "fcose",      label: "Cluster Map",      note: "Separate dense repo and package clusters when the graph is busy." },
  { id: "concentric", label: "Most Referenced",  note: "Place heavily referenced nodes nearer the centre." },
];

interface BottomControlsProps {
  layout: LayoutId;
  nodeScale: number;
  groupByRepo: boolean;
  setLayout(layout: LayoutId): void;
  setNodeScale(update: (current: number) => number): void;
  setGroupByRepo(value: boolean): void;
  onHelpOpen(): void;
}

const MIN_NODE_SCALE = 0.5;
const MAX_NODE_SCALE = 1.5;
const NODE_SCALE_STEP = 0.25;

export function BottomControls({ layout, nodeScale, groupByRepo, setLayout, setNodeScale, setGroupByRepo, onHelpOpen }: BottomControlsProps) {
  const decreaseDisabled = nodeScale <= MIN_NODE_SCALE;
  const increaseDisabled = nodeScale >= MAX_NODE_SCALE;

  return (
    <div className="bottom-right-dock">
      <PortalTooltip text="Key, features, and license information.">
        <button className="repo-box-toggle dock-panel" type="button" onClick={onHelpOpen}>
          Help
        </button>
      </PortalTooltip>
      <PortalTooltip text="Show or hide repository grouping boxes on the graph.">
        <button
          className={`repo-box-toggle dock-panel${groupByRepo ? " active" : ""}`}
          type="button"
          aria-pressed={groupByRepo}
          onClick={() => setGroupByRepo(!groupByRepo)}
        >
          Repositories
        </button>
      </PortalTooltip>
      <div className="scale-controls dock-panel" aria-label="Node scale controls">
        <PortalTooltip text="Make graph nodes smaller without changing filters or selection.">
          <button
            className="scale-button"
            type="button"
            aria-label="Make graph nodes smaller"
            disabled={decreaseDisabled}
            onClick={() => setNodeScale((current) => Math.max(MIN_NODE_SCALE, current - NODE_SCALE_STEP))}
          >
            -
          </button>
        </PortalTooltip>
        <PortalTooltip text="Current graph node scale">
          <span className="scale-value">{Math.round(nodeScale * 100)}%</span>
        </PortalTooltip>
        <PortalTooltip text="Make graph nodes larger without changing filters or selection.">
          <button
            className="scale-button"
            type="button"
            aria-label="Make graph nodes larger"
            disabled={increaseDisabled}
            onClick={() => setNodeScale((current) => Math.min(MAX_NODE_SCALE, current + NODE_SCALE_STEP))}
          >
            +
          </button>
        </PortalTooltip>
      </div>
      <div className="layout-toggle dock-panel">
        {LAYOUT_OPTIONS.map((option) => (
          <PortalTooltip key={option.id} text={option.note}>
            <button
              className={`layout-segment${layout === option.id ? " active" : ""}`}
              type="button"
              aria-label={option.label}
              onClick={() => setLayout(option.id)}
            >
              {option.label}
            </button>
          </PortalTooltip>
        ))}
      </div>
    </div>
  );
}
