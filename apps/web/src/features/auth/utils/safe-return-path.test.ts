import { describe, expect, it } from "vitest";

import { resolvePostLoginPath, sanitizeReturnPath } from "./safe-return-path";

describe("safe return paths", () => {
  it.each([
    "/dashboard",
    "/settings",
    "/employee/account",
    "/admin/settings/admins",
  ])("allows %s", (path) => {
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
    "/employee/auth/login",
    "/admin/auth/login",
    "/employee?%74oken=secret",
    "/employee?%2574oken=secret",
    "/employee?accessToken=secret",
    "/employee?returnTo=%2Fauth%2Freset-password%3Ftoken%3Dsecret",
    "/employee%2fauth%2flogin",
    "/employee%5cother",
    "/employee?x=%00",
    "/employee?x=%ZZ",
  ])("rejects unsafe value %s", (path) => {
    expect(sanitizeReturnPath(path)).toBeNull();
  });

  it("uses actual-role destinations and rejects the other audience", () => {
    expect(resolvePostLoginPath(null, "USER")).toBe("/employee");
    expect(resolvePostLoginPath("//attacker.example", "ADMIN")).toBe("/admin");
    expect(resolvePostLoginPath("/admin/settings/admins", "USER")).toBe(
      "/employee",
    );
    expect(resolvePostLoginPath("/employee/account", "ADMIN")).toBe("/admin");
    expect(resolvePostLoginPath("/employee/account", "USER")).toBe(
      "/employee/account",
    );
  });
});
