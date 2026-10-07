import { describe, expect, it } from "vitest";
import { custodyRecoveryCommandSchema } from "./recovery.cli.js";

const id = "1dc1b738-bcfd-403c-ac9e-ec0d69497214";
describe("protected recovery stdin authority", () => {
  it.each([
    { operation: "FENCE", reason: "Restoring disposable custody storage" },
    { operation: "ROTATE", assignmentId: id },
  ])("accepts bounded $operation intent", (command) => {
    expect(custodyRecoveryCommandSchema.parse(command)).toEqual(command);
  });
  it.each([
    { operation: "FENCE", reason: "" },
    { operation: "ROTATE", assignmentId: "../private" },
    { operation: "ROTATE", assignmentId: id, privateKey: "secret" },
    { operation: "EXECUTE", command: "shell" },
    {
      operation: "ACKNOWLEDGE",
      bootId: id,
      reason: "Open finance",
      recovered: true,
    },
    { operation: "RESTORE", evidence: { financialHistoryReference: "" } },
  ])(
    "rejects arbitrary execution, private inputs or unsupported recovery claims",
    (command) => {
      expect(custodyRecoveryCommandSchema.safeParse(command).success).toBe(
        false,
      );
    },
  );
});
