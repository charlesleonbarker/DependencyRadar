import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { ColorSchemeSelect } from "../components/ColorSchemeSelect";
import type { ColorSchemeId } from "../theme/colorSchemes";
import { COLOR_SCHEMES, writeColorSchemeCookie } from "../theme/colorSchemes";

interface ColorSchemeStoryProps {
  /** Scheme selected in the dropdown and applied to the large preview. */
  scheme: ColorSchemeId;
}

function ColorSchemeStory({ scheme: initialScheme }: ColorSchemeStoryProps) {
  const [scheme, setScheme] = useState<ColorSchemeId>(initialScheme);

  useEffect(() => {
    setScheme(initialScheme);
  }, [initialScheme]);

  const chooseScheme = (nextScheme: ColorSchemeId) => {
    setScheme(nextScheme);
    writeColorSchemeCookie(nextScheme);
  };

  return (
    <div className="theme-story" data-color-scheme={scheme}>
      <div className="theme-story-toolbar">
        <ColorSchemeSelect value={scheme} onChange={chooseScheme} />
      </div>

      <section className="theme-story-hero dock-panel">
        <div>
          <p className="theme-story-eyebrow">Dependency Radar</p>
          <h2>{COLOR_SCHEMES.find((item) => item.id === scheme)?.label}</h2>
          <p>{COLOR_SCHEMES.find((item) => item.id === scheme)?.note}</p>
        </div>
        <div className="theme-story-swatches" aria-label="Scheme colors">
          <span style={{ background: "var(--accent)" }} />
          <span style={{ background: "var(--teal)" }} />
          <span style={{ background: "var(--gold)" }} />
          <span style={{ background: "var(--rose)" }} />
        </div>
      </section>

      <div className="theme-story-grid">
        {COLOR_SCHEMES.map((option) => (
          <article className="theme-preview-card dock-panel" data-color-scheme={option.id} key={option.id}>
            <div className="theme-preview-canvas">
              <span className="theme-node library">Core</span>
              <span className="theme-node web">API</span>
              <span className="theme-node service">Worker</span>
              <span className="theme-edge project" />
              <span className="theme-edge package" />
            </div>
            <h3>{option.label}</h3>
            <p>{option.note}</p>
            <div className="theme-story-swatches">
              <span style={{ background: "var(--accent)" }} />
              <span style={{ background: "var(--teal)" }} />
              <span style={{ background: "var(--gold)" }} />
              <span style={{ background: "var(--rose)" }} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: "Design / Color Schemes",
  component: ColorSchemeStory,
  parameters: {
    layout: "fullscreen",
    controls: {
      expanded: true,
    },
  },
  argTypes: {
    scheme: {
      control: "select",
      options: COLOR_SCHEMES.map((scheme) => scheme.id),
    },
  },
  args: {
    scheme: "dark",
  },
} satisfies Meta<typeof ColorSchemeStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SelectorAndPreviews: Story = {
  name: "Selector and scheme previews",
};
