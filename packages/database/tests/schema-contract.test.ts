import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(currentDirectory, "..");
const schema = readFileSync(
  join(packageRoot, "prisma", "schema.prisma"),
  "utf8",
);

describe("authentication-only Prisma schema", () => {
  it("contains exactly the required application models and enums", () => {
    const models = [...schema.matchAll(/^model\s+(\w+)/gmu)].map(
      (match) => match[1],
    );
    const enums = [...schema.matchAll(/^enum\s+(\w+)/gmu)].map(
      (match) => match[1],
    );
    expect(models).toEqual(["User", "RefreshToken"]);
    expect(enums).toEqual(["UserRole", "UserStatus"]);
  });

  it("contains no demo or business-specific model inventory", () => {
    expect(schema).not.toMatch(
      /DemoMessage|Organization|Project|Quotation|Payment/u,
    );
  });
});
