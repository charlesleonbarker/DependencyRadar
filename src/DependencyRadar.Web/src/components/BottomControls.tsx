import type { LayoutId, ViewOptions } from "../graph/cytoscapeModel";
import { PortalTooltip } from "./PortalTooltip";

const LAYOUT_OPTIONS: Array<{ id: LayoutId; label: string; note: string }> = [
  { id: "dagre",      label: "Dependency Paths", note: "Arrange projects left-to-right so dependency direction is easier to trace." },
  { id: "fcose",      label: "Cluster Map",      note: "Separate dense repo and package clusters when the graph is busy." },
  { id: "concentric", label: "Most Referenced",  note: "Place heavily referenced nodes nearer the centre." },
];

interface BottomControlsProps {
  layout: LayoutId;
  groupByRepo: boolean;
  viewOptions: ViewOptions;
  setLayout(layout: LayoutId): void;
  setGroupByRepo(value: boolean): void;
  setViewOptions(update: (current: ViewOptions) => ViewOptions): void;
  onHelpOpen(): void;
}

export function BottomControls({ layout, groupByRepo, viewOptions, setLayout, setGroupByRepo, setViewOptions, onHelpOpen }: BottomControlsProps) {
  const updateDensity = (density: number) => setViewOptions((current) => ({ ...current, density }));

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

      <div className="view-control-panel dock-panel" aria-label="Graph density control">
        <label className="view-control-field">
          <span>Density</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={1 - viewOptions.density}
            onChange={(event) => updateDensity(1 - Number(event.target.value))}
          />
        </label>
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
