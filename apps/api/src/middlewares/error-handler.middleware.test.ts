import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { errorHandlerMiddleware } from "./error-handler.middleware.js";
import { LedgerError } from "../modules/ledger/ledger.errors.js";

describe("errorHandlerMiddleware", () => {
  it("projects safe diagnostics for raw unexpected failures and hidden private causes", () => {
    const sentinel = "sentinel-private-unexpected-error";
    const requestLog = { error: vi.fn(), warn: vi.fn() };
    const httpRequest = {
      log: requestLog,
      path: "/safe-path",
      requestId: "client-correlation",
    } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn();
    const response = { status, json } as unknown as Response;
    status.mockReturnValue(response);
    for (const failure of [
      new Error(sentinel, {
        cause: new Error(sentinel, { cause: { providerKey: sentinel } }),
      }),
      { unexpected: { password: sentinel } },
      { code: "P2002", meta: { privateKey: sentinel }, message: sentinel },
    ]) {
      errorHandlerMiddleware(failure, httpRequest, response, vi.fn());
    }
    expect(
      JSON.stringify([
        json.mock.calls,
        requestLog.error.mock.calls,
        requestLog.warn.mock.calls,
      ]),
    ).not.toContain(sentinel);
    for (const [payload] of json.mock.calls)
      expect(payload).not.toHaveProperty("stack");
    expect(requestLog.error.mock.calls[0]?.[0]).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      requestId: "client-correlation",
      statusCode: 500,
    });
  });
  it("keeps a ledger fault cause out of the HTTP response and ordinary logs", () => {
    const secret = "sentinel-private-ledger-diagnostics";
    const cause = new Error(secret, { cause: { credentials: secret } });
    const failure = new LedgerError("LEDGER_INTERNAL", { cause });
    const requestLog = { error: vi.fn(), warn: vi.fn() };
    const request = {
      log: requestLog,
      path: "/internal-financial-operation",
      requestId: "ledger-fault-request",
    } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn();
    const response = { status, json } as unknown as Response;
    status.mockReturnValue(response);
    errorHandlerMiddleware(failure, request, response, vi.fn());
    expect(failure.cause).toBe(cause);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "LEDGER_INTERNAL",
        message: "Financial operation failed.",
        statusCode: 500,
      }),
    );
    expect(requestLog.warn).toHaveBeenCalledExactlyOnceWith(
      {
        code: "LEDGER_INTERNAL",
        requestId: "ledger-fault-request",
        statusCode: 500,
      },
      "Financial operation failed.",
    );
    expect(requestLog.error).not.toHaveBeenCalled();
    expect(
      JSON.stringify([json.mock.calls, requestLog.warn.mock.calls, failure]),
    ).not.toContain(secret);
  });
  it("classifies Zod errors outside request validation as internal bugs", () => {
    const parsed = z.object({ count: z.number() }).safeParse({ count: "bug" });
    if (parsed.success) throw new Error("Expected the fixture to fail.");
    const requestLog = { error: vi.fn(), warn: vi.fn() };
    const request = {
      log: requestLog,
      path: "/internal-schema-bug",
      requestId: "request-id",
    } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn();
    const response = {
      status,
      json,
    } as unknown as Response;
    status.mockReturnValue(response);

    errorHandlerMiddleware(parsed.error, request, response, vi.fn());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
      }),
    );
    expect(requestLog.error).toHaveBeenCalledOnce();
    expect(requestLog.warn).not.toHaveBeenCalled();
  });
});
