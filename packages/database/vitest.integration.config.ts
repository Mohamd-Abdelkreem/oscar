import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    globalSetup: ["tests/integration/global-setup.ts"],
  },
});
