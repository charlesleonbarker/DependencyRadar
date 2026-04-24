import type { LayoutId } from "../graph/cytoscapeModel";

const LAYOUT_OPTIONS: Array<{ id: LayoutId; label: string; note: string }> = [
  { id: "dagre", label: "Flow", note: "Best overview for dependency direction." },
  { id: "fcose", label: "Force", note: "Good for cluster discovery." },
  { id: "concentric", label: "Focus", note: "Groups highly connected projects toward the centre." },
];

interface BottomControlsProps {
  layout: LayoutId;
  setLayout(layout: LayoutId): void;
  onHelp(): void;
}

export function BottomControls({ layout, setLayout, onHelp }: BottomControlsProps) {
  return (
    <div className="bottom-right-dock">
      <div className="dock-panel bottom-controls">
        <div className="three-way-toggle">
          {LAYOUT_OPTIONS.map((option) => (
            <button
              key={option.id}
              className={`toggle-segment ${layout === option.id ? "active" : ""}`}
              type="button"
              title={option.note}
              onClick={() => setLayout(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className="icon-button" type="button" title="Help, key, and monitor" onClick={onHelp}>
          ?
        </button>
      </div>
    </div>
  );
}
