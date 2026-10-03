import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi.js";

const expectedPaths = [
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/login",
  "/auth/admin/login",
  "/auth/validate-verification-token",
  "/auth/validate-admin-invitation",
  "/auth/admin-invitations/accept",
  "/auth/refresh",
  "/auth/logout",
  "/auth/logout-all",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
  "/auth/change-password",
  "/users/me",
  "/admin/employees/{userId}/restrictions",
  "/admin/admins",
  "/admin/admins/{userId}",
  "/admin/admins/{userId}/status",
  "/admin/invitations",
  "/admin/invitations/{invitationId}",
  "/admin/invitations/{invitationId}/reissue",
  "/admin/invitations/{invitationId}/revoke",
  "/health/live",
  "/health/ready",
  "/openapi.json",
] as const;

describe("OpenAPI document", () => {
  it("uses required enriched identity DTOs and documents session revocation without requiring a refresh cookie for logout", () => {
    const document = buildOpenApiDocument();
    const schema = document.components?.schemas?.["IdentityUser"];
    expect(schema).toHaveProperty(
      "required",
      expect.arrayContaining([
        "referralCode",
        "tasksBlocked",
        "withdrawalsBlocked",
        "accountVersion",
      ]),
    );
    expect(schema).toHaveProperty("additionalProperties", false);
    for (const path of ["/auth/logout", "/auth/logout-all"])
      expect(document.paths?.[path]?.post?.security).toEqual([
        { BearerAuth: [], CsrfHeader: [] },
      ]);
    expect(document.paths?.["/auth/register"]?.post?.responses).toHaveProperty(
      "503",
    );
    expect(
      document.paths?.["/auth/admin-invitations/accept"]?.post?.responses,
    ).toHaveProperty("201");
    expect(
      document.paths?.["/auth/admin-invitations/accept"]?.post?.security ?? [],
    ).toEqual([]);
    expect(JSON.stringify(document)).not.toContain("bootstrap");
  });
  it.each([
    "/auth/validate-reset-token",
    "/auth/validate-verification-token",
    "/auth/validate-admin-invitation",
  ])(
    "documents bounded %s GET/HEAD validation with bodyless HEAD errors and no consumption",
    (path) => {
      const operations = buildOpenApiDocument().paths?.[path];
      const token = operations?.get?.parameters?.find(
        (parameter) => "name" in parameter && parameter.name === "token",
      );
      expect(token).toMatchObject({
        name: "token",
        in: "query",
        required: true,
        schema: { minLength: 1, maxLength: 4096 },
      });
      expect(operations?.head?.responses).toHaveProperty("200");
      for (const response of Object.values(operations?.head?.responses ?? {}))
        expect(response).not.toHaveProperty("content");
    },
  );
  it("documents current ADMIN authority, strict commands, UUIDs, bounded lists and observable conflicts", () => {
    const document = buildOpenApiDocument();
    for (const [path, methods] of Object.entries(document.paths ?? {})) {
      if (!path.startsWith("/admin/")) continue;
      for (const method of ["get", "post", "patch"] as const) {
        const operation = methods[method];
        if (operation === undefined) continue;
        expect(operation.description).toContain("ACTIVE verified ADMIN");
        expect(operation.security).toEqual([
          { BearerAuth: [], ...(method === "get" ? {} : { CsrfHeader: [] }) },
        ]);
        for (const code of ["400", "401", "403", "429"])
          expect(operation.responses).toHaveProperty(code);
        if (path.includes("{"))
          expect(operation.responses).toHaveProperty("404");
        if (method !== "get") expect(operation.responses).toHaveProperty("409");
      }
    }
    expect(
      document.paths?.["/admin/invitations"]?.post?.responses,
    ).toHaveProperty("503");
    expect(
      document.paths?.["/admin/invitations/{invitationId}/reissue"]?.post
        ?.responses,
    ).toHaveProperty("503");
    const userId = document.paths?.[
      "/admin/admins/{userId}"
    ]?.get?.parameters?.find(
      (parameter) => "name" in parameter && parameter.name === "userId",
    );
    expect(userId).toMatchObject({
      name: "userId",
      in: "path",
      required: true,
      schema: { format: "uuid" },
    });
    const limit = document.paths?.["/admin/admins"]?.get?.parameters?.find(
      (parameter) => "name" in parameter && parameter.name === "limit",
    );
    expect(limit).toMatchObject({
      name: "limit",
      in: "query",
      schema: {
        type: "integer",
        maximum: 100,
        default: 25,
      },
    });
    const command =
      document.paths?.["/admin/admins/{userId}/status"]?.patch?.requestBody;
    expect(command).toHaveProperty(
      ["content", "application/json", "schema", "additionalProperties"],
      false,
    );
    expect(command).toHaveProperty(
      ["content", "application/json", "schema", "required"],
      expect.arrayContaining([
        "confirmed",
        "reason",
        "expectedVersion",
        "status",
      ]),
    );
    expect(
      document.paths?.["/auth/admin-invitations/accept"]?.post?.requestBody,
    ).toMatchObject({
      content: {
        "application/json": {
          schema: {
            additionalProperties: false,
            required: ["newPassword", "passwordConfirmation"],
          },
        },
      },
    });
  });
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
