import type { Preview } from "@storybook/react";
import "../src/app.css";

const desktopViewports = {
  desktop1440: {
    name: "Desktop 1440",
    styles: {
      width: "1440px",
      height: "900px",
    },
    type: "desktop",
  },
  laptop1280: {
    name: "Laptop 1280",
    styles: {
      width: "1280px",
      height: "800px",
    },
    type: "desktop",
  },
  widescreen1920: {
    name: "Widescreen 1920",
    styles: {
      width: "1920px",
      height: "1080px",
    },
    type: "desktop",
  },
};

const preview: Preview = {
  initialGlobals: {
    viewport: {
      value: "desktop1440",
      isRotated: false,
    },
  },
  parameters: {
    backgrounds: {
      default: "app",
      values: [{ name: "app", value: "#0f172a" }],
    },
    layout: "fullscreen",
    viewport: {
      defaultViewport: "desktop1440",
      options: desktopViewports,
      viewports: desktopViewports,
    },
  },
};

export default preview;
