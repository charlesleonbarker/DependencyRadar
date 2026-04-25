import type { LayoutId } from "../graph/cytoscapeModel";

const LAYOUT_OPTIONS: Array<{ id: LayoutId; label: string; note: string }> = [
  { id: "dagre",      label: "Flow",  note: "Best overview for dependency direction." },
  { id: "fcose",      label: "Force", note: "Good for cluster discovery." },
  { id: "concentric", label: "Focus", note: "Most-referenced nodes at the centre." },
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
