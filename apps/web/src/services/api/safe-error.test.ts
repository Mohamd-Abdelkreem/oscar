import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { getApiError } from "./safe-error";

function failure(code: string, status: number, extra: object = {}) {
  const config = {
    url: "/admin/deposits/manual-credits",
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
      path: "/api/v1/admin/deposits/manual-credits",
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
