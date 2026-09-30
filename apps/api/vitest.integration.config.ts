import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
  },
});
