import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig, { configType }) => {
    // When building for the container the Storybook static site is served at
    // /tests/ by the ASP.NET host, so all asset references must be rooted there.
    if (configType === "PRODUCTION") {
      viteConfig.base = "/tests/";
    }
    return viteConfig;
  },
};

export default config;
