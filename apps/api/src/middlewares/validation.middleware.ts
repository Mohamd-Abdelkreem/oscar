import type { RequestHandler } from "express";
import type { z } from "zod";

import { ValidationException } from "../core/errors/validation.error.js";
import type { FieldError } from "../core/responses/api-response.js";

type RequestSchemas = Readonly<{
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}>;

type RequestTarget = keyof RequestSchemas;
type ParseResult =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "valid"; data: unknown }>
  | Readonly<{ kind: "invalid"; errors: FieldError[] }>;

const formatIssuePath = (
  target: RequestTarget,
  path: readonly PropertyKey[],
): string => {
  const parts = path.map(String);
  return [target, ...(parts[0] === target ? parts.slice(1) : parts)].join(".");
};

export const formatValidationErrors = (
  target: RequestTarget,
  issues: readonly z.core.$ZodIssue[],
): FieldError[] =>
  issues.map((issue) => ({
    field: formatIssuePath(target, issue.path),
    message: issue.message,
  }));

const parseTarget = async (
  target: RequestTarget,
  schema: z.ZodType | undefined,
  value: unknown,
): Promise<ParseResult> => {
  if (schema === undefined) return { kind: "missing" };
  const result = await schema.safeParseAsync(value);
  return result.success
    ? { kind: "valid", data: result.data }
    : {
        kind: "invalid",
        errors: formatValidationErrors(target, result.error.issues),
      };
};

export const validationMiddleware =
  (schemas: RequestSchemas): RequestHandler =>
  async (request, _response, next) => {
    const [body, params, query] = await Promise.all([
      parseTarget("body", schemas.body, request.body),
      parseTarget("params", schemas.params, request.params),
      parseTarget("query", schemas.query, request.query),
    ]);

    const errors = [body, params, query].flatMap((result) =>
      result.kind === "invalid" ? result.errors : [],
    );
    if (errors.length > 0) throw new ValidationException(errors);

    request.validated = {
      ...request.validated,
      ...(body.kind === "valid" ? { body: body.data } : {}),
      ...(params.kind === "valid" ? { params: params.data } : {}),
      ...(query.kind === "valid" ? { query: query.data } : {}),
    };
    if (body.kind === "valid") request.body = body.data;
    if (params.kind === "valid") {
      request.params = params.data as typeof request.params;
    }
    next();
  };

export const validateRequest = validationMiddleware;
