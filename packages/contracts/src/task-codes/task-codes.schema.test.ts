import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  taskCodeCreateSchema,
  taskCodeTextSchema,
  taskCodeStatusSchema,
  taskUnlockRequestSchema,
} from "./task-codes.schema.ts";

describe("task code intent", () => {
  it.each([
    ["  abc  ", "ABC"],
    ["straße", "STRASSE"],
    ["éλληνικά", "ÉΛΛΗΝΙΚΆ"],
    ["مهمة", "مهمة"],
    ["Ａｂ１２", "ＡＢ１２"],
  ])("normalizes %s once", (input, normalized) => {
    expect(taskCodeTextSchema.parse(input)).toBe(normalized);
  });
  it.each([
    " ",
    "a\u0000b",
    "a\nb",
    "a\u007fb",
    "a\ud800b",
    "x".repeat(65),
    "ß".repeat(33),
  ])("rejects invalid normalized code", (code) => {
    expect(taskCodeTextSchema.safeParse(code).success).toBe(false);
  });
  it("accepts confirmed creation but denies text reassignment/use caps/authority", () => {
    const intent = {
      commandId: randomUUID(),
      confirmed: true,
      taskId: randomUUID(),
      code: "abc",
      state: "ENABLED",
    };
    expect(taskCodeCreateSchema.parse(intent).code).toBe("ABC");
    expect(
      taskCodeCreateSchema.safeParse({ ...intent, maxUses: 3 }).success,
    ).toBe(false);
    expect(
      taskCodeCreateSchema.safeParse({ ...intent, confirmed: false }).success,
    ).toBe(false);
    expect(
      taskCodeStatusSchema.safeParse({
        commandId: intent.commandId,
        confirmed: true,
        expectedCodeVersion: 1,
        state: "PAUSED",
        code: "NEW",
      }).success,
    ).toBe(false);
    expect(
      taskUnlockRequestSchema.safeParse({
        commandId: intent.commandId,
        expectedTaskRevision: 1,
        code: "abc",
        employeeId: randomUUID(),
      }).success,
    ).toBe(false);
  });
});
