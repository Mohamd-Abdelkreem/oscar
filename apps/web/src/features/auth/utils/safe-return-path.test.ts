import { describe, expect, it } from "vitest";

import { resolvePostLoginPath, sanitizeReturnPath } from "./safe-return-path";

describe("safe return paths", () => {
  it.each(["/dashboard", "/settings"])("allows %s", (path) => {
    expect(sanitizeReturnPath(path)).toBe(path);
  });

  it.each([
    "https://attacker.example/dashboard",
    "//attacker.example/dashboard",
    "/auth/login",
    "/dashboard?token=secret",
    "/dashboard%00",
    "/user@example.com",
    "/dashboard\\redirect",
    "%E0%A4%A",
  ])("rejects unsafe value %s", (path) => {
    expect(sanitizeReturnPath(path)).toBeNull();
  });

  it("uses the dashboard only when resolving a missing or unsafe path", () => {
    expect(resolvePostLoginPath(null)).toBe("/dashboard");
    expect(resolvePostLoginPath("//attacker.example")).toBe("/dashboard");
  });
});
