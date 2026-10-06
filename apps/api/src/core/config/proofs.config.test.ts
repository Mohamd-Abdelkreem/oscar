import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProofsEnvironment } from "./proofs.config.js";

const projectRoot = resolve("fixture-project");
const privateRoot = resolve("fixture-private-assets");
const environment = { PROOF_STORAGE_ROOT: privateRoot };

describe("proof configuration", () => {
  it("retains the approved budgets and permits strictly smaller admission budgets", () => {
    expect(parseProofsEnvironment(environment, projectRoot)).toEqual({
      storageRoot: privateRoot,
      processingSlots: 2,
      uploadReservationBytes: 41_943_040,
      stagingMaxBytes: 268_435_456,
      inputDeadlineMs: 30_000,
    });
    expect(
      parseProofsEnvironment(
        {
          ...environment,
          PROOF_PROCESSING_SLOTS: "1",
          PROOF_STAGING_MAX_BYTES: "41943040",
          PROOF_INPUT_DEADLINE_MS: "1000",
        },
        projectRoot,
      ),
    ).toMatchObject({ processingSlots: 1, inputDeadlineMs: 1000 });
  });

  it.each([
    undefined,
    "",
    "relative/proofs",
    `${privateRoot}\u0000`,
    projectRoot,
    resolve(projectRoot, "public", "proofs"),
    resolve(projectRoot, ".."),
  ])(
    "rejects missing, unsafe or overlapping private roots (%s)",
    (storageRoot) => {
      expect(() =>
        parseProofsEnvironment(
          { PROOF_STORAGE_ROOT: storageRoot },
          projectRoot,
        ),
      ).toThrow(/PROOF_STORAGE_ROOT/u);
    },
  );

  it.each([
    ["PROOF_PROCESSING_SLOTS", "3"],
    ["PROOF_PROCESSING_SLOTS", "0"],
    ["PROOF_STAGING_MAX_BYTES", "268435457"],
    ["PROOF_STAGING_MAX_BYTES", "83886079"],
    ["PROOF_INPUT_DEADLINE_MS", "30001"],
    ["PROOF_INPUT_DEADLINE_MS", "0"],
    ["PROOF_INPUT_DEADLINE_MS", "1e3"],
    ["PROOF_INPUT_DEADLINE_MS", "1.5"],
    ["PROOF_INPUT_DEADLINE_MS", " 1000"],
    ["PROOF_INPUT_DEADLINE_MS", ""],
  ])("rejects unsafe %s=%s", (key, configured) => {
    expect(() =>
      parseProofsEnvironment(
        { ...environment, [key]: configured },
        projectRoot,
      ),
    ).toThrow(key);
  });
});
