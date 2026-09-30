import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ValidationException } from "../core/errors/validation.error.js";
import { validationMiddleware } from "./validation.middleware.js";

const response = {} as Response;

describe("validationMiddleware", () => {
  it("aggregates target-prefixed body, params, and query errors", async () => {
    const request = {
      body: { email: "invalid" },
      params: { userId: "not-a-uuid" },
      query: { page: "zero" },
    } as unknown as Request;
    const nextMock = vi.fn();
    const next = nextMock as NextFunction;
    const middleware = validationMiddleware({
      body: z.object({ email: z.email() }),
      params: z.object({ userId: z.uuid() }),
      query: z.object({ page: z.coerce.number().int().positive() }),
    });

    let thrown: unknown;
    try {
      await middleware(request, response, next);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ValidationException);
    expect(thrown).toMatchObject({
      code: "VALIDATION_ERROR",
      errors: [
        expect.objectContaining({ field: "body.email" }),
        expect.objectContaining({ field: "params.userId" }),
        expect.objectContaining({ field: "query.page" }),
      ],
    });
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("stores parsed values and replaces normalized body and params", async () => {
    const request = {
      body: { email: "  USER@Example.com " },
      params: { userId: "  user-1 " },
      query: { page: "2" },
    } as unknown as Request;
    const nextMock = vi.fn();
    const next = nextMock as NextFunction;
    const middleware = validationMiddleware({
      body: z.object({
        email: z.string().transform((value) => value.trim().toLowerCase()),
      }),
      params: z.object({
        userId: z.string().transform((value) => value.trim()),
      }),
      query: z.object({ page: z.coerce.number().int().positive() }),
    });

    await middleware(request, response, next);

    expect(request.body).toEqual({ email: "user@example.com" });
    expect(request.params).toEqual({ userId: "user-1" });
    expect(request.validated).toEqual({
      body: { email: "user@example.com" },
      params: { userId: "user-1" },
      query: { page: 2 },
    });
    expect(nextMock).toHaveBeenCalledOnce();
  });
});
