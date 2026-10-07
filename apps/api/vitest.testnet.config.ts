import { defineConfig } from "vitest/config";
import { parseTestnetAdmission } from "./src/core/config/testnet.config.js";

parseTestnetAdmission(process.env);
export default defineConfig({
  test: {
    include: ["testnet/*.testnet.test.ts"],
    bail: 1,
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    pool: "forks",
    sequence: {
      sequencer: class {
        shard<T>(files: T[]) {
          return files;
        }
        sort<T extends { moduleId: string }>(files: T[]) {
          return [...files].sort(
            (a, b) =>
              ["custody", "deposits", "sweeps"].findIndex((s) =>
                a.moduleId.includes(s),
              ) -
              ["custody", "deposits", "sweeps"].findIndex((s) =>
                b.moduleId.includes(s),
              ),
          );
        }
      },
    },
    testTimeout: 1200000,
    hookTimeout: 1200000,
  },
});
