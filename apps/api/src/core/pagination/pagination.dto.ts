import { z } from "zod";

import { parsePagination, type PaginationQuery } from "./pagination.js";

const paginationValueSchema = z.union([z.string(), z.number()]).optional();

export const paginationQueryFields = {
  page: paginationValueSchema,
  limit: paginationValueSchema,
} as const;

export type PaginationQueryInput = z.infer<typeof paginationValueSchema>;
export interface PaginationQueryFields {
  readonly page?: PaginationQueryInput;
  readonly limit?: PaginationQueryInput;
}

export const parsePaginationQuery = (
  input: PaginationQueryFields,
): PaginationQuery =>
  parsePagination({
    page: Object.hasOwn(input, "page")
      ? { kind: "value", value: input.page }
      : { kind: "missing" },
    limit: Object.hasOwn(input, "limit")
      ? { kind: "value", value: input.limit }
      : { kind: "missing" },
  });
