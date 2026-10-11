import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { getApiError } from "./safe-error";

function failure(
  code: string,
  status: number,
  extra: object = {},
  url = "/admin/deposits/manual-credits",
) {
  const config = {
    url,
    method: "post",
    headers: new AxiosHeaders(),
  };
  const error = new AxiosError("PRIVATE_SENTINEL", "ERR_BAD_RESPONSE", config);
  error.response = {
    config,
    status,
    statusText: "Error",
    headers: { secret: "PRIVATE_SENTINEL" },
    data: {
      success: false,
      statusCode: status,
      code,
      message: "PRIVATE_SENTINEL",
      requestId: "id",
      timestamp: "2026-10-07T00:00:00.000Z",
      path: `/api/v1${url}`,
      ...extra,
    },
  };
  return error;
}

describe("safe deposit errors", () => {
  it.each([
    ["DEPOSIT_NOT_FOUND", 404, "request"],
    ["DEPOSIT_UNAVAILABLE", 503, "transient"],
    ["DEPOSIT_UNRESOLVED", 503, "transient"],
    ["MANUAL_CREDIT_REFERENCE_INVALID", 400, "request"],
    ["MANUAL_CREDIT_CONFLICT", 409, "request"],
    ["FINANCIAL_AMOUNT_OVERFLOW", 409, "request"],
    ["FINANCIAL_WRITES_FENCED", 503, "transient"],
    ["SERVICE_UNAVAILABLE", 503, "transient"],
  ])(
    "projects verified %s without private diagnostics",
    (code, status, category) => {
      const projected = getApiError(failure(code, status));
      expect(projected).toMatchObject({ code, statusCode: status, category });
      expect(JSON.stringify(projected)).not.toContain("PRIVATE_SENTINEL");
      expect(projected.stack).toBeUndefined();
    },
  );
  it("rejects malformed domain codes and mismatched HTTP status", () => {
    expect(
      getApiError(failure("MANUAL_CREDIT_CONFLICT", 409, { timestamp: "bad" }))
        .code,
    ).toBe("HTTP_ERROR");
    expect(getApiError(failure("UNKNOWN_PRIVATE_CODE", 409)).code).toBe(
      "HTTP_ERROR",
    );
    expect(
      getApiError(failure("DEPOSIT_UNAVAILABLE", 503, { statusCode: 400 }))
        .category,
    ).toBe("contract");
  });
  it("bounds editable field projections and excludes nested authority and messages", () => {
    const projected = getApiError(
      failure("VALIDATION_ERROR", 400, {
        errors: [
          "amount",
          "employeeId",
          "reference",
          "reference.kind",
          "reference.value",
          "reason",
          "actor.id",
          "walletAfter",
          "reference.secret",
        ].map((field) => ({
          field: `body.${field}`,
          message: "PRIVATE_SENTINEL",
        })),
      }),
    );
    expect(Object.keys(projected.fieldErrors)).toEqual([
      "amount",
      "employeeId",
      "reference",
      "reference.kind",
      "reference.value",
      "reason",
    ]);
    expect(JSON.stringify(projected)).not.toContain("PRIVATE_SENTINEL");
    expect(Object.isFrozen(projected.fieldErrors)).toBe(true);
    const bounded = getApiError(
      failure("VALIDATION_ERROR", 400, {
        errors: Array.from({ length: 20 }, () => ({
          field: "body.actor",
          message: "secret",
        })).concat({ field: "body.amount", message: "secret" }),
      }),
    );
    expect(bounded.fieldErrors).toEqual({});
  });
});

describe("safe withdrawal errors", () => {
  it.each([
    ["WITHDRAWAL_VERSION_CONFLICT", 409],
    ["WITHDRAWAL_STATE_CONFLICT", 409],
    ["WITHDRAWAL_AMOUNT_INVALID", 400],
    ["WITHDRAWAL_QUOTE_STALE", 409],
    ["WITHDRAWAL_ACTIVE", 409],
    ["WITHDRAWAL_DESTINATION_REQUIRED", 409],
    ["WITHDRAWAL_ADDRESS_INVALID", 400],
    ["WITHDRAWAL_PROOF_INVALID", 409],
    ["WITHDRAWAL_DESTINATION_FIXED", 409],
    ["WITHDRAWAL_DESTINATION_STALE", 409],
    ["WITHDRAWAL_BLOCKED", 403],
    ["WITHDRAWAL_UNAVAILABLE", 503],
    ["WITHDRAWAL_UNRESOLVED", 409],
    ["WITHDRAWAL_INTERNAL", 500],
  ] as const)(
    "projects validated %s without retaining private payloads",
    (code, status) => {
      const raw = failure(code, status, {}, "/withdrawals");
      if (raw.config !== undefined)
        raw.config.data = { proof: "PRIVATE_SENTINEL" };
      const projected = getApiError(raw);
      expect(projected.code).toBe(code);
      expect(projected.category).toBe(
        status === 403 ? "denied" : status >= 500 ? "transient" : "request",
      );
      expect(JSON.stringify(projected)).not.toContain("PRIVATE_SENTINEL");
      expect(projected.stack).toBeUndefined();
    },
  );
  it("requires a valid envelope bound to the original withdrawal route", () => {
    for (const extra of [
      { timestamp: "bad" },
      { path: "/api/v1/withdrawals/other" },
    ]) {
      expect(
        getApiError(
          failure(
            "WITHDRAWAL_QUOTE_STALE",
            409,
            extra,
            "/withdrawals/me/requests",
          ),
        ).code,
      ).toBe("HTTP_ERROR");
    }
    expect(getApiError(failure("WITHDRAWAL_QUOTE_STALE", 409)).code).toBe(
      "HTTP_ERROR",
    );
  });
  it("projects only editable withdrawal fields and discards proof and authority", () => {
    const fields = [
      "gross",
      "address",
      "countedHours",
      "reason",
      "proof",
      "token",
      "quoteId",
      "requestKey",
      "expectedVersion",
      "actor.id",
      "privateKey",
    ];
    const projected = getApiError(
      failure(
        "VALIDATION_ERROR",
        400,
        {
          errors: fields.map((field) => ({
            field: `body.${field}`,
            message: "PRIVATE_SENTINEL",
          })),
        },
        "/withdrawals/me/requests",
      ),
    );
    expect(Object.keys(projected.fieldErrors)).toEqual(fields.slice(0, 4));
    expect(JSON.stringify(projected)).not.toContain("PRIVATE_SENTINEL");
  });
});
