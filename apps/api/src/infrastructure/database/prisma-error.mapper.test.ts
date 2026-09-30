import { describe, expect, it } from "vitest";

import { AppError } from "../../core/errors/app.error.js";
import {
  isAllowlistedPrismaCode,
  mapPrismaError,
} from "./prisma-error.mapper.js";

const prismaError = (values: Record<string, unknown>): unknown => ({
  name: "PrismaClientKnownRequestError",
  ...values,
});

describe("mapPrismaError", () => {
  it("passes AppError through", () => {
    const error = new AppError("custom", 418, "CUSTOM", true);
    expect(mapPrismaError(error)).toBe(error);
  });

  it.each([
    ["P2002", 409],
    ["P2003", 409],
    ["P2014", 409],
    ["P2025", 404],
    ["P2034", 409],
    ["P1001", 503],
    ["P1017", 503],
  ])("maps %s to %s", (code, statusCode) => {
    expect(mapPrismaError(prismaError({ code })).statusCode).toBe(statusCode);
  });

  it.each([
    "ck_users_email_normalized",
    "ck_users_status_timestamps_consistent",
  ])("maps approved check %s to 400", (constraint) => {
    expect(
      mapPrismaError(
        prismaError({ code: "P2004", meta: { database_error: constraint } }),
      ).statusCode,
    ).toBe(400);
  });

  it("rejects unapproved check names and never leaks provider details", () => {
    const mapped = mapPrismaError(
      prismaError({
        code: "P2004",
        message: "postgresql://secret@database/internal",
        meta: {
          constraint: "ck_business_specific",
          sql: "SELECT provider_secret",
        },
      }),
    );
    expect(mapped.statusCode).toBe(500);
    expect(mapped.message).not.toMatch(/secret|SELECT|postgresql/iu);
  });

  it("maps unknown and non-object failures to a safe 500", () => {
    expect(mapPrismaError(prismaError({ code: "P9999" })).statusCode).toBe(500);
    expect(mapPrismaError("raw database error").statusCode).toBe(500);
  });
});

describe("isAllowlistedPrismaCode", () => {
  it("accepts mapped codes and rejects unknown values", () => {
    expect(isAllowlistedPrismaCode("P2002")).toBe(true);
    expect(isAllowlistedPrismaCode("P2004")).toBe(true);
    expect(isAllowlistedPrismaCode("P9999")).toBe(false);
    expect(isAllowlistedPrismaCode({ code: "P2002" })).toBe(false);
  });
});
