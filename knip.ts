import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/**/*.test.ts"],
  ignoreExportsUsedInFile: true,
  ignoreIssues: { "pnpm-workspace.yaml": ["catalog"] },
};

export default config;
