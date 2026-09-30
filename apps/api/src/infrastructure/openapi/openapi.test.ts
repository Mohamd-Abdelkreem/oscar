import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi.js";

const expectedPaths = [
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/logout-all",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
  "/auth/change-password",
  "/users/me",
  "/health/live",
  "/health/ready",
  "/openapi.json",
] as const;

describe("OpenAPI document", () => {
  it("documents every public route and authentication scheme", () => {
    const document = buildOpenApiDocument();
    expect(Object.keys(document.paths ?? {}).sort()).toEqual(
      [...expectedPaths].sort(),
    );
    expect(document.components?.securitySchemes).toMatchObject({
      BearerAuth: { type: "http", scheme: "bearer" },
      RefreshCookie: { type: "apiKey", in: "cookie" },
      CsrfHeader: { type: "apiKey", in: "header" },
    });
  });
});
