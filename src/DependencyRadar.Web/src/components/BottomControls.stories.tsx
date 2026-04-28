import type { Meta, StoryObj } from "@storybook/react";

import { DEFAULT_VIEW_OPTIONS, type LayoutId } from "../graph/cytoscapeModel";
import type { ColorSchemeId } from "../theme/colorSchemes";
import { BottomControls } from "./BottomControls";

interface BottomControlsStoryProps {
  /** Active graph layout segment. */
  layout: LayoutId;
  /** Whether repository grouping boxes are visible. */
  groupByRepo: boolean;
  /** Layout spacing, from compact to spacious. */
  density: number;
  /** Active app color scheme. */
  colorScheme: ColorSchemeId;
}

function BottomControlsStory({ layout, groupByRepo, density, colorScheme }: BottomControlsStoryProps) {
  return (
    <div className="app-shell" data-color-scheme={colorScheme}>
      <BottomControls
        layout={layout}
        groupByRepo={groupByRepo}
        viewOptions={{ density }}
        setLayout={() => {}}
        setGroupByRepo={() => {}}
        setViewOptions={() => {}}
        onHelpOpen={() => {}}
      />
    </div>
  );
}

const meta = {
  title: "Graph / BottomControls",
  component: BottomControlsStory,
  parameters: {
    controls: {
      expanded: true,
    },
  },
  argTypes: {
    layout: {
      control: "radio",
      options: ["fcose", "dagre", "concentric"],
    },
    groupByRepo: { control: "boolean" },
    density: {
      control: { type: "range", min: 0, max: 1, step: 0.05 },
    },
    colorScheme: {
      control: "radio",
      options: ["dark", "light", "okabe-ito"],
    },
  },
} satisfies Meta<typeof BottomControlsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    layout: "dagre",
    groupByRepo: true,
    ...DEFAULT_VIEW_OPTIONS,
    colorScheme: "dark",
  },
};
