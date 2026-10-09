import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi.js";

const expectedPaths = [
  "/withdrawals/me",
  "/withdrawals/quotes",
  "/withdrawals/quotes/{quoteId}/outcome",
  "/withdrawals",
  "/withdrawals/{withdrawalId}",
  "/admin/withdrawals",
  "/admin/withdrawals/{withdrawalId}",
  "/admin/withdrawals/{withdrawalId}/extensions",
  "/admin/withdrawals/{withdrawalId}/rejections",
  "/withdrawals/me/destination",
  "/withdrawals/me/destination/confirmations",
  "/withdrawals/me/destination/resend",
  "/withdrawals/me/destination/consume",
  "/admin/employees/manual-credit-targets",
  "/deposits/me/address",
  "/deposits/me/history",
  "/admin/deposits",
  "/admin/deposits/manual-credits",
  "/admin/deposits/manual-credits/{actionId}",
  "/proofs",
  "/proofs/uploads/{commandId}",
  "/proofs/uploads/{commandId}/cancel",
  "/proofs/{assetId}",
  "/proofs/{assetId}/content",
  "/admin/task-illustrations",
  "/admin/task-illustrations/uploads/{commandId}",
  "/admin/task-illustrations/uploads/{commandId}/cancel",
  "/task-illustrations/{assetId}",
  "/task-illustrations/{assetId}/content",
  "/admin/tasks",
  "/admin/tasks/{taskId}",
  "/admin/tasks/{taskId}/status",
  "/admin/task-codes",
  "/admin/task-codes/{codeId}",
  "/admin/task-codes/{codeId}/status",
  "/admin/task-codes/{codeId}/usages",
  "/admin/task-codes/{codeId}/changes",
  "/task-commands/{commandId}",
  "/task-commands/{commandId}/cancel",
  "/wallet/me",
  "/wallet/me/ledger",
  "/wallet/me/ledger/{operationId}",
  "/admin/wallets/{employeeId}",
  "/admin/finance",
  "/admin/finance/{operationId}",
  "/referrals/me",
  "/referrals/me/members",
  "/referrals/me/commissions",
  "/admin/referrals/roots",
  "/admin/referrals/{rootId}",
  "/admin/referrals/{rootId}/members",
  "/admin/referrals/{rootId}/commissions",
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
  "/packages",
  "/admin/packages",
  "/admin/packages/{packageCode}",
  "/admin/referral-settings",
  "/admin/configuration-changes/{commandId}",
  "/subscriptions/me",
  "/subscriptions/me/history",
  "/admin/subscriptions/{employeeId}",
  "/subscriptions/purchase-quotes",
  "/subscriptions/purchase-quotes/{quoteId}/outcome",
  "/subscriptions/purchases",
  "/subscriptions/purchases/{purchaseId}",
] as const;

describe("OpenAPI document", () => {
  it("documents authenticated POST-only destination proof consumption and truthful pending delivery", () => {
    const paths = buildOpenApiDocument().paths;
    expect(paths?.["/withdrawals/me/destination"]?.get?.security).toEqual([
      { BearerAuth: [] },
    ]);
    const consume = paths?.["/withdrawals/me/destination/consume"];
    expect(consume?.post?.responses?.["409"]).toHaveProperty(
      "description",
      expect.stringContaining("WITHDRAWAL_PROOF_INVALID"),
    );
    expect(consume?.post?.responses).toHaveProperty("400");
    expect(consume?.get).toBeUndefined();
    expect(consume?.post?.security).toEqual([
      { BearerAuth: [], CsrfHeader: [] },
    ]);
    expect(consume?.post?.requestBody).toHaveProperty(
      ["content", "application/json", "schema", "required"],
      ["token"],
    );
    expect(
      paths?.["/withdrawals/me/destination/confirmations"]?.post?.responses?.[
        "201"
      ],
    ).toBeDefined();
    expect(
      paths?.["/withdrawals/me/destination/resend"]?.post?.responses?.["409"],
    ).toBeDefined();
    expect(
      paths?.["/withdrawals/me/destination/confirmations"]?.post?.description,
    ).toContain("no P08 browser consumer");
    expect(
      paths?.["/withdrawals/quotes"]?.post?.responses?.["201"],
    ).toBeDefined();
  });
  it("documents exact acceptance, replay status, request keys and bounded authorized history", () => {
    const paths = buildOpenApiDocument().paths;
    const accept = paths?.["/withdrawals"]?.post;
    expect(accept?.security).toEqual([{ BearerAuth: [], CsrfHeader: [] }]);
    expect(Object.keys(accept?.responses ?? {})).toEqual(
      expect.arrayContaining(["200", "201", "409"]),
    );
    expect(
      accept?.parameters?.some(
        (parameter) =>
          "name" in parameter &&
          parameter.name === "Idempotency-Key" &&
          parameter.required === false,
      ),
    ).toBe(true);
    expect(
      paths?.["/withdrawals/quotes/{quoteId}/outcome"]?.get?.responses?.["404"],
    ).toBeDefined();
    expect(
      paths?.["/admin/withdrawals"]?.get?.parameters?.map((parameter) =>
        "name" in parameter ? parameter.name : "ref",
      ),
    ).toEqual(["page", "limit", "state", "employeeId", "from", "to", "q"]);
    expect(paths?.["/admin/withdrawals/{withdrawalId}"]?.post).toBeUndefined();
  });
  it("documents the bounded minimal current-admin lookup and database availability error", () => {
    const lookup =
      buildOpenApiDocument().paths?.["/admin/employees/manual-credit-targets"]
        ?.get;
    expect(lookup?.security).toEqual([{ BearerAuth: [] }]);
    expect(
      lookup?.parameters?.map((parameter) =>
        "name" in parameter ? parameter.name : "ref",
      ),
    ).toEqual(["page", "limit", "q"]);
    const limit = lookup?.parameters?.find(
      (parameter) => "name" in parameter && parameter.name === "limit",
    );
    expect(limit).toHaveProperty(["schema", "maximum"], 100);
    expect(lookup?.responses?.["200"]).toHaveProperty(
      ["content", "application/json", "schema", "required"],
      expect.arrayContaining(["paginationMeta", "data"]),
    );
    expect(lookup?.responses?.["503"]).toHaveProperty(
      "description",
      expect.stringContaining("SERVICE_UNAVAILABLE"),
    );
    expect(lookup?.responses?.["503"]).not.toHaveProperty(
      "description",
      expect.stringContaining("DEPOSIT_UNAVAILABLE"),
    );
    expect(lookup?.description).toContain("RepeatableRead");
    expect(lookup?.description).toContain("no-store");
  });
  it("documents private binary and confirmed version-bound final review without reversal routes", () => {
    const paths = buildOpenApiDocument().paths;
    expect(
      paths?.["/proofs/{assetId}/content"]?.get?.responses?.["200"],
    ).toHaveProperty(["content", "image/png", "schema", "format"], "binary");
    const review =
      paths?.["/admin/task-submissions/{submissionId}/review"]?.post;
    expect(review?.requestBody).toHaveProperty(
      ["content", "application/json", "schema", "required"],
      expect.arrayContaining([
        "confirmed",
        "reason",
        "expectedSubmissionVersion",
        "expectedEvidenceVersion",
        "decision",
        "commandId",
      ]),
    );
    expect(review?.requestBody).toHaveProperty(
      ["content", "application/json", "schema", "additionalProperties"],
      false,
    );
    for (const path of [
      "/admin/task-submissions/{submissionId}",
      "/admin/task-submissions/{submissionId}/review",
    ]) {
      expect(paths?.[path]?.patch).toBeUndefined();
      expect(paths?.[path]?.delete).toBeUndefined();
    }
  });
  it("documents confirmed publication/code writes and terminal cancellation without delete or reversal", () => {
    const paths = buildOpenApiDocument().paths;
    for (const [path, method] of [
      ["/admin/tasks", "post"],
      ["/admin/tasks/{taskId}", "patch"],
      ["/admin/tasks/{taskId}/status", "patch"],
      ["/admin/task-codes", "post"],
      ["/admin/task-codes/{codeId}/status", "patch"],
      ["/task-commands/{commandId}/cancel", "post"],
    ] as const) {
      expect(paths?.[path]?.[method]?.security).toEqual([
        { BearerAuth: [], CsrfHeader: [] },
      ]);
      expect(paths?.[path]?.[method]?.responses).toHaveProperty("409");
      expect(paths?.[path]?.delete).toBeUndefined();
      expect(paths?.[path]?.[method]?.requestBody).toBeDefined();
    }
    expect(paths?.["/admin/tasks"]?.post?.responses).toHaveProperty("201");
    expect(paths?.["/admin/tasks"]?.post?.responses).toHaveProperty("200");
    expect(paths?.["/task-commands/{commandId}"]?.get?.description).toContain(
      "NOT_OBSERVED is nonterminal",
    );
    expect(
      paths?.["/task-commands/{commandId}/cancel"]?.post?.description,
    ).toContain("never reverses");
    for (const path of [
      "/admin/tasks",
      "/admin/task-codes",
      "/admin/task-codes/{codeId}/usages",
      "/admin/task-codes/{codeId}/changes",
    ])
      expect(paths?.[path]?.get?.security).toEqual([{ BearerAuth: [] }]);
  });
  it("documents reviewed configuration writes and nonterminal actor-scoped observation", () => {
    const paths = buildOpenApiDocument().paths;
    for (const path of [
      "/admin/packages/{packageCode}",
      "/admin/referral-settings",
    ]) {
      const command = paths?.[path]?.patch;
      expect(command?.security).toEqual([{ BearerAuth: [], CsrfHeader: [] }]);
      expect(command?.description).toContain("CONFIGURATION_SUPERSEDED");
      for (const status of ["200", "400", "401", "403", "409", "429", "500"])
        expect(command?.responses).toHaveProperty(status);
    }
    const observation =
      paths?.["/admin/configuration-changes/{commandId}"]?.get;
    expect(observation?.security).toEqual([{ BearerAuth: [] }]);
    expect(observation?.description).toContain("NOT_OBSERVED is nonterminal");
    expect(observation?.responses).not.toHaveProperty("409");
  });
  it("documents private wallet, finance and relative-root reads with strict filtered schemas and bearer authority", () => {
    const paths = buildOpenApiDocument().paths;
    for (const path of expectedPaths.filter(
      (path) =>
        path.includes("wallet") ||
        path.includes("referrals") ||
        path.includes("finance"),
    )) {
      const operation = paths?.[path]?.get;
      expect(operation?.security).toEqual([{ BearerAuth: [] }]);
      expect(operation?.description).toContain("no-store");
      for (const status of ["200", "400", "401", "403", "404", "500"])
        expect(operation?.responses).toHaveProperty(status);
    }
    expect(paths?.["/admin/finance"]?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "source", in: "query" }),
        expect.objectContaining({ name: "q", in: "query" }),
      ]),
    );
    expect(
      paths?.["/admin/referrals/{rootId}/members"]?.get?.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "rootId", in: "path", required: true }),
        expect.objectContaining({ name: "q", in: "query" }),
      ]),
    );
  });
  it("documents purchase replay statuses, CSRF, optional alias and locked outcome semantics", () => {
    const paths = buildOpenApiDocument().paths;
    const command = paths?.["/subscriptions/purchases"]?.post;
    expect(command?.security).toEqual([{ BearerAuth: [], CsrfHeader: [] }]);
    expect(command?.responses).toHaveProperty("201");
    expect(command?.responses).toHaveProperty("200");
    expect(command?.responses).toHaveProperty("409");
    expect(command?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "header",
          name: "Idempotency-Key",
          required: false,
        }),
      ]),
    );
    expect(
      paths?.["/subscriptions/purchase-quotes/{quoteId}/outcome"]?.get
        ?.description,
    ).toContain("ReadCommitted");
    expect(
      paths?.["/subscriptions/purchases/{purchaseId}"]?.get?.responses,
    ).toHaveProperty("404");
  });
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
        if (
          path.includes("{") &&
          path !== "/admin/configuration-changes/{commandId}"
        )
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
      [
        ...expectedPaths,
        "/tasks/today",
        "/tasks/{taskId}/unlock",
        "/task-submissions",
        "/task-submissions/{submissionId}",
        "/task-submissions/{submissionId}/evidence",
        "/admin/task-submissions",
        "/admin/task-submissions/{submissionId}",
        "/admin/task-submissions/{submissionId}/evidence",
        "/admin/task-submissions/{submissionId}/review",
      ].sort(),
    );
    expect(document.components?.securitySchemes).toMatchObject({
      BearerAuth: { type: "http", scheme: "bearer" },
      RefreshCookie: { type: "apiKey", in: "cookie" },
      CsrfHeader: { type: "apiKey", in: "header" },
    });
  });
});
