import { describe, expect, it } from "vitest";

import { parsePaginationQuery } from "./pagination.dto.js";
import { buildPaginationMeta, parsePagination } from "./pagination.js";

describe("pagination", () => {
  it("uses defaults and parses decimal digit values", () => {
    expect(parsePaginationQuery({})).toEqual({
      page: 1,
      limit: 25,
      skip: 0,
      take: 25,
    });
    expect(parsePaginationQuery({ page: "2", limit: "10" })).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
      take: 10,
    });
  });

  it.each(["1e2", "0x10", "1.5", "-1", "abc"])(
    "rejects alternate numeric syntax %s",
    (page) => {
      expect(() => parsePaginationQuery({ page })).toThrow();
    },
  );

  it("rejects zero, excessive limits, and unsafe integers", () => {
    expect(() => parsePaginationQuery({ page: "0" })).toThrow();
    expect(() => parsePaginationQuery({ limit: "101" })).toThrow();
    expect(() =>
      parsePagination({
        page: { kind: "value", value: Number.MAX_SAFE_INTEGER },
        limit: { kind: "value", value: 100 },
      }),
    ).toThrow(/safe integer/iu);
  });

  it("calculates validated metadata", () => {
    expect(buildPaginationMeta({ page: 2, limit: 25, total: 63 })).toEqual({
      page: 2,
      limit: 25,
      total: 63,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});
