import type { LayoutId } from "../graph/cytoscapeModel";

const LAYOUT_OPTIONS: Array<{ id: LayoutId; label: string; note: string }> = [
  { id: "dagre",      label: "Dependency Paths", note: "Arrange projects left-to-right so dependency direction is easier to trace." },
  { id: "fcose",      label: "Cluster Map",      note: "Separate dense repo and package clusters when the graph is busy." },
  { id: "concentric", label: "Most Referenced",  note: "Place heavily referenced nodes nearer the centre." },
];

interface BottomControlsProps {
  layout: LayoutId;
  nodeScale: number;
  setLayout(layout: LayoutId): void;
  setNodeScale(update: (current: number) => number): void;
}

const MIN_NODE_SCALE = 0.5;
const MAX_NODE_SCALE = 1.5;
const NODE_SCALE_STEP = 0.25;

export function BottomControls({ layout, nodeScale, setLayout, setNodeScale }: BottomControlsProps) {
  const decreaseDisabled = nodeScale <= MIN_NODE_SCALE;
  const increaseDisabled = nodeScale >= MAX_NODE_SCALE;

  return (
    <div className="bottom-right-dock">
      <div className="scale-controls dock-panel" aria-label="Node scale controls">
        <button
          className="scale-button has-tooltip"
          type="button"
          aria-label="Make graph nodes smaller"
          data-tooltip="Make graph nodes smaller without changing filters or selection."
          disabled={decreaseDisabled}
          onClick={() => setNodeScale((current) => Math.max(MIN_NODE_SCALE, current - NODE_SCALE_STEP))}
        >
          -
        </button>
        <span className="scale-value has-tooltip" data-tooltip="Current graph node scale">{Math.round(nodeScale * 100)}%</span>
        <button
          className="scale-button has-tooltip"
          type="button"
          aria-label="Make graph nodes larger"
          data-tooltip="Make graph nodes larger without changing filters or selection."
          disabled={increaseDisabled}
          onClick={() => setNodeScale((current) => Math.min(MAX_NODE_SCALE, current + NODE_SCALE_STEP))}
        >
          +
        </button>
      </div>
      <div className="layout-toggle dock-panel">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.id}
            className={`layout-segment${layout === option.id ? " active" : ""}`}
            type="button"
            aria-label={option.label}
            data-tooltip={option.note}
            onClick={() => setLayout(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
