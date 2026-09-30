import { describe, expect, it } from "vitest";

import { compareHash, generateHash } from "./password-hasher.js";

describe("hash utilities", () => {
  it("uses a salted Argon2id hash and verifies only the original value", async () => {
    const first = await generateHash("a-strong-test-password");
    const second = await generateHash("a-strong-test-password");

    expect(first).toMatch(/^\$argon2id\$/u);
    expect(second).not.toBe(first);
    await expect(compareHash("a-strong-test-password", first)).resolves.toBe(
      true,
    );
    await expect(compareHash("wrong-password", first)).resolves.toBe(false);
  });
});
