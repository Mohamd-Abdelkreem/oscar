import { defineConfig } from "vitest/config";
import { parseTestnetProfile } from "./src/core/config/testnet.config.js";

const admission = parseTestnetProfile(process.env);
export default defineConfig({
  test: {
    include: [...admission.files],
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
              ["payouts", "custody", "deposits", "sweeps"].findIndex((s) =>
                a.moduleId.includes(s),
              ) -
              ["payouts", "custody", "deposits", "sweeps"].findIndex((s) =>
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
