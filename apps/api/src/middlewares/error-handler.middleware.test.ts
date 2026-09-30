import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { errorHandlerMiddleware } from "./error-handler.middleware.js";

describe("errorHandlerMiddleware", () => {
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
