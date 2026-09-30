import { describe, expect, it } from "vitest";

import { sha256 } from "./token-hasher.js";

describe("token hasher", () => {
  it("creates a stable lowercase SHA-256 fingerprint", () => {
    expect(sha256("token")).toBe(
      "3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0",
    );
  });
});
