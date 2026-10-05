import { describe, expect, it } from "vitest";

import {
  credentialValidityDataSchema,
  emptyActionDataSchema,
  neutralEmailDataSchema,
} from "./auth-response.schema.ts";

describe("public action replies", () => {
  it("accepts only valid preview, bounded acknowledgement and empty action data", () => {
    expect(credentialValidityDataSchema.parse({ valid: true })).toEqual({
      valid: true,
    });
    expect(
      neutralEmailDataSchema.parse({ message: "Request received." }),
    ).toEqual({ message: "Request received." });
    expect(emptyActionDataSchema.parse({})).toEqual({});
  });

  it.each([
    {},
    { valid: false },
    { valid: "true" },
    { valid: true, email: "private@example.test" },
    { valid: true, token: "private" },
  ])("rejects invalid or private preview %j", (reply) => {
    expect(credentialValidityDataSchema.safeParse(reply).success).toBe(false);
  });

  it.each([
    {},
    { message: 1 },
    { message: "" },
    { message: "   " },
    { message: "a".repeat(501) },
    { message: "a\u0000b" },
    { message: "OK", delivery: "private" },
  ])("rejects invalid acknowledgement %j", (reply) => {
    expect(neutralEmailDataSchema.safeParse(reply).success).toBe(false);
  });

  it.each([null, [], { token: "private" }, { success: true }])(
    "rejects nonempty action data %j",
    (reply) => {
      expect(emptyActionDataSchema.safeParse(reply).success).toBe(false);
    },
  );
});
