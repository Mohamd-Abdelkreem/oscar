import { describe, expect, it } from "vitest";

import {
  sanitizeRequestForLog,
  sanitizeRequestQuery,
  sanitizeRequestUrl,
} from "./request-sanitizer.js";

describe("request log sanitization", () => {
  it.each([
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "code",
    "secret",
    "password",
  ])("redacts the %s URL query value", (key) => {
    const result = sanitizeRequestUrl(
      `/auth/reset-password?${key}=secret-value&locale=en`,
    );
    expect(result).toBe(`/auth/reset-password?${key}=[REDACTED]&locale=en`);
    expect(result).not.toContain("secret-value");
  });

  it("preserves non-sensitive parameters and fragments", () => {
    expect(sanitizeRequestUrl("/items?page=2&limit=25#section")).toBe(
      "/items?page=2&limit=25#section",
    );
  });

  it("redacts credential keys case-insensitively in query objects", () => {
    expect(
      sanitizeRequestQuery({ Token: "secret", page: "2", tags: ["a"] }),
    ).toEqual({ Token: "[REDACTED]", page: "2", tags: ["a"] });
  });

  it("sanitizes url, originalUrl, and query without retaining raw request", () => {
    const result = sanitizeRequestForLog({
      url: "/verify?token=one",
      originalUrl: "/api/v1/verify?token=two",
      query: { token: "three", keep: "yes" },
      raw: { url: "/verify?token=four" },
    });
    expect(JSON.stringify(result)).not.toMatch(/one|two|three|four/u);
    expect(result["query"]).toEqual({ token: "[REDACTED]", keep: "yes" });
  });
});
