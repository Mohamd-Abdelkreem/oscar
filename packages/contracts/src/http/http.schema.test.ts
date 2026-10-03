import { describe, expect, it } from "vitest";

import {
  errorEnvelopeSchema,
  paginationMetaSchema,
  successEnvelopeSchema,
} from "./http.schema.ts";

const base = {
  requestId: "request-1",
  timestamp: "2026-08-18T00:00:00.000Z",
  path: "/api/v1/test",
};

describe("HTTP envelope contracts", () => {
  it("preserves target-prefixed errors and zero-result pagination for identity consumers", () => {
    const empty = {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    expect(paginationMetaSchema.parse(empty)).toEqual(empty);
    const failure = {
      ...base,
      success: false,
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid intent.",
      errors: [
        { field: "body.expectedVersion", message: "Version is required." },
      ],
    };
    expect(errorEnvelopeSchema.parse(failure)).toEqual(failure);
    expect(
      paginationMetaSchema.safeParse({ ...empty, totalPages: 1 }).success,
    ).toBe(false);
  });
  it("keeps success and error payloads discriminated", () => {
    expect(
      successEnvelopeSchema.parse({
        ...base,
        success: true,
        statusCode: 200,
        message: "Okay.",
        data: { value: true },
      }).success,
    ).toBe(true);
    expect(
      errorEnvelopeSchema.parse({
        ...base,
        success: false,
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input.",
        errors: [{ field: "email", message: "Invalid email." }],
      }).success,
    ).toBe(false);
  });

  it("requires success data and rejects legacy error data", () => {
    expect(
      successEnvelopeSchema.safeParse({
        ...base,
        success: true,
        statusCode: 204,
        message: "Done.",
      }).success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({
        ...base,
        success: false,
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Invalid input.",
        data: null,
      }).success,
    ).toBe(false);
  });

  it("validates promoted pagination metadata", () => {
    const valid = {
      page: 2,
      limit: 25,
      total: 63,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    };
    expect(paginationMetaSchema.safeParse(valid).success).toBe(true);
    expect(
      paginationMetaSchema.safeParse({ ...valid, totalPages: 4 }).success,
    ).toBe(false);
    expect(
      successEnvelopeSchema.safeParse({
        ...base,
        success: true,
        statusCode: 200,
        message: "Okay.",
        data: [],
        paginationMeta: valid,
      }).success,
    ).toBe(true);
  });
});
