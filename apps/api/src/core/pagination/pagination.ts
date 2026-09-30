import type { PaginationMeta } from "@template/contracts";

import { BadRequestException } from "../errors/bad-request.error.js";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export type PaginationValue =
  Readonly<{ kind: "missing" }> | Readonly<{ kind: "value"; value: unknown }>;

export interface PaginationInput {
  readonly page: PaginationValue;
  readonly limit: PaginationValue;
}

export interface PaginationQuery {
  readonly page: number;
  readonly limit: number;
  readonly skip: number;
  readonly take: number;
}

type ParsedValue =
  Readonly<{ kind: "default" }> | Readonly<{ kind: "parsed"; value: number }>;

export class PaginationValidationError extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = "PaginationValidationError";
  }
}

const parseDecimalDigits = (
  input: PaginationValue,
  field: string,
): ParsedValue => {
  if (input.kind === "missing") return { kind: "default" };
  if (typeof input.value === "number") {
    if (!Number.isSafeInteger(input.value) || input.value < 0) {
      throw new PaginationValidationError(
        `${field} must be a non-negative safe integer`,
      );
    }
    return { kind: "parsed", value: input.value };
  }
  if (typeof input.value !== "string" || input.value.trim().length === 0) {
    return { kind: "default" };
  }
  const value = input.value.trim();
  if (!/^\d+$/u.test(value)) {
    throw new PaginationValidationError(
      `${field} must contain decimal digits only`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new PaginationValidationError(
      `${field} must fit in a safe integer range`,
    );
  }
  return { kind: "parsed", value: parsed };
};

const resolve = (value: ParsedValue, fallback: number): number =>
  value.kind === "parsed" ? value.value : fallback;

export const parsePagination = (input: PaginationInput): PaginationQuery => {
  const page = resolve(parseDecimalDigits(input.page, "page"), DEFAULT_PAGE);
  const limit = resolve(
    parseDecimalDigits(input.limit, "limit"),
    DEFAULT_LIMIT,
  );
  if (page < 1) {
    throw new PaginationValidationError("page must be 1 or greater");
  }
  if (limit < 1) {
    throw new PaginationValidationError("limit must be 1 or greater");
  }
  if (limit > MAX_LIMIT) {
    throw new PaginationValidationError(
      `limit must not exceed ${String(MAX_LIMIT)}`,
    );
  }
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    throw new PaginationValidationError(
      "page * limit must fit in a safe integer range",
    );
  }
  return { page, limit, skip, take: limit };
};

export const buildPaginationMeta = ({
  page,
  limit,
  total: rawTotal,
}: Readonly<{
  page: number;
  limit: number;
  total: number;
}>): PaginationMeta => {
  const total = Math.max(0, Math.floor(rawTotal));
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
