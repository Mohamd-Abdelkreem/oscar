import { describe, expect, it } from "vitest";

import {
  sanitizeRequestForLog,
  sanitizeRequestQuery,
  sanitizeRequestUrl,
} from "./request-sanitizer.js";

describe("request log sanitization", () => {
  it("removes nested custody sentinels and credential-bearing provider query values", () => {
    const sentinel = "sentinel-private-provider-or-signing";
    const sanitized = sanitizeRequestForLog({
      url: "/deposits?api%5Fkey=" + sentinel,
      query: {
        diagnostics: [
          {
            signingPayload: sentinel,
            private_key: sentinel,
            nested: { apiKey: sentinel, safe: "UNAVAILABLE" },
          },
        ],
      },
      headers: { referer: "https://provider.test/?api_key=" + sentinel },
    });
    expect(JSON.stringify(sanitized)).not.toContain(sentinel);
    expect(JSON.stringify(sanitized)).toContain("UNAVAILABLE");
  });
  it("redacts repeated and encoded credential keys without retaining referrer spelling variants", () => {
    const sanitized = sanitizeRequestForLog({
      url: "/auth/validate-admin-invitation?%74oken=sentinel-one&TOKEN=sentinel-two&locale=ar",
      headers: {
        ReFeReR: "https://web.test/?token=sentinel-three",
        Referrer: "sentinel-four",
        "user-agent": "Privacy Browser",
      },
      query: { credentials: [{ resetToken: "sentinel-five", locale: "ar" }] },
    });
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("sentinel-");
    expect(serialized).toContain("locale=ar");
    expect(sanitized["headers"]).toEqual({ "user-agent": "Privacy Browser" });
  });
  it("omits credential-bearing referrers while preserving safe metadata", () => {
    const output = sanitizeRequestForLog({
      url: "/auth/validate-reset-token?token=sentinel-query",
      headers: {
        referer: "https://web.test/reset?token=sentinel-referrer",
        "user-agent": "Browser",
        authorization: "sentinel-header",
      },
    });
    expect(JSON.stringify(output)).not.toContain("sentinel-referrer");
    expect(output["headers"]).toMatchObject({ "user-agent": "Browser" });
    expect(JSON.stringify(output)).not.toContain("sentinel-query");
  });
  it("redacts nested credential query fields and fragments", () => {
    expect(
      JSON.stringify(
        sanitizeRequestQuery({
          filter: { token: "sentinel-nested", page: "1" },
        }),
      ),
    ).not.toContain("sentinel-nested");
    expect(
      sanitizeRequestUrl("/reset?locale=en#token=sentinel-fragment"),
    ).not.toContain("sentinel-fragment");
    expect(sanitizeRequestUrl("/reset#token=sentinel-fragment")).toBe("/reset");
  });
  it.each([
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "code",
    "secret",
    "password",
    "RESEND_API_KEY",
    "AUTH_JWT_SECRET",
    "signingPayload",
    "private_key",
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
