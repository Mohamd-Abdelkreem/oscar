import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJwtSecrets } from "./auth.config.js";

const keys = [
  "AUTH_JWT_SECRET",
  "AUTH_REFRESH_JWT_SECRET",
  "AUTH_VERIFICATION_JWT_SECRET",
  "AUTH_RESET_JWT_SECRET",
] as const;
const explicit = Object.fromEntries(
  keys.map((key, index) => [
    key,
    `sentinel-independent-purpose-${String(index)}-${"a".repeat(32)}`,
  ]),
);
describe("production signing configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it.each(keys)("enforces the 31/32-character boundary for %s", (key) => {
    const boundaryKey = "boundary-purpose-key-".padEnd(32, "x");
    expect(() =>
      parseJwtSecrets(
        { ...explicit, [key]: boundaryKey.slice(0, 31) },
        "production",
      ),
    ).toThrow(key);
    expect(
      Object.values(
        parseJwtSecrets({ ...explicit, [key]: boundaryKey }, "production"),
      ),
    ).toContain(boundaryKey);
  });
  it.each(keys)(
    "fails module initialization without %s before app construction",
    async (missing) => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      for (const key of keys)
        vi.stubEnv(key, key === missing ? undefined : explicit[key]);
      await expect(import("./auth.config.js")).rejects.toThrow(missing);
    },
  );
  it("accepts four explicit independent purposes and keeps nonproduction fallback separate", () => {
    expect(parseJwtSecrets(explicit, "production").accessSecret).toBe(
      explicit[keys[0]],
    );
    expect(
      parseJwtSecrets({ AUTH_JWT_SECRET: explicit[keys[0]] }, "test")
        .resetSecret,
    ).toBe(explicit[keys[0]]);
  });
  it.each(keys)(
    "rejects missing, short, blank, example and known local defaults for %s without values",
    (key) => {
      for (const invalid of [
        undefined,
        "short",
        " ".repeat(40),
        "replace-with-at-least-32-characters-of-random-data",
        "test-only-access-secret-000000000000000000000000",
        "sentinel-secret-with spaces-0000000000000000",
        "development-secret-000000000000000000000000",
        "local-secret-0000000000000000000000000000",
        "placeholder-0000000000000000000000000000",
        `sentinel-null-${String.fromCharCode(0)}-${"x".repeat(32)}`,
      ]) {
        let observed: unknown;
        try {
          parseJwtSecrets({ ...explicit, [key]: invalid }, "production");
        } catch (failure) {
          observed = failure;
        }
        expect(observed).toBeInstanceOf(Error);
        if (observed instanceof Error && invalid !== undefined)
          expect(observed.message).not.toContain(invalid);
      }
    },
  );
  it.each([
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ])("rejects purpose reuse for pair %i/%i", (first, second) => {
    const firstKey = keys[first];
    const secondKey = keys[second];
    if (firstKey === undefined || secondKey === undefined)
      throw new Error("Invalid pair fixture.");
    expect(() =>
      parseJwtSecrets(
        { ...explicit, [secondKey]: explicit[firstKey] },
        "production",
      ),
    ).toThrow(/distinct/u);
  });
});
