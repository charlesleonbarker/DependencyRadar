import type { LayoutId } from "../graph/cytoscapeModel";

const LAYOUT_OPTIONS: Array<{ id: LayoutId; label: string; note: string }> = [
  { id: "dagre",      label: "Dependency Paths", note: "Arrange projects left-to-right so dependency direction is easier to trace." },
  { id: "fcose",      label: "Cluster Map",      note: "Separate dense repo and package clusters when the graph is busy." },
  { id: "concentric", label: "Most Referenced",  note: "Place heavily referenced nodes nearer the centre." },
];

interface BottomControlsProps {
  layout: LayoutId;
  setLayout(layout: LayoutId): void;
}

export function BottomControls({ layout, setLayout }: BottomControlsProps) {
  return (
    <div className="bottom-right-dock">
      <div className="layout-toggle dock-panel">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.id}
            className={`layout-segment${layout === option.id ? " active" : ""}`}
            type="button"
            title={option.note}
            onClick={() => setLayout(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
