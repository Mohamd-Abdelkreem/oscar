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

describe("authentication and financial foundation Prisma schema", () => {
  it("contains exactly the required application models and enums", () => {
    const models = [...schema.matchAll(/^model\s+(\w+)/gmu)].map(
      (match) => match[1],
    );
    const enums = [...schema.matchAll(/^enum\s+(\w+)/gmu)].map(
      (match) => match[1],
    );
    expect(models).toEqual([
      "User",
      "RefreshToken",
      "AuthSession",
      "AdminSetupState",
      "AdminInvitation",
      "IdentityAuditRecord",
      "Wallet",
      "FinancialOperation",
      "RequestIdentity",
      "LedgerPosting",
      "ReservationAllocation",
      "AuditRecord",
      "Package",
      "ReferralSettings",
      "ConfigurationChange",
      "PurchaseQuote",
      "Purchase",
      "Subscription",
      "ReferralDecision",
      "Task",
      "TaskCode",
      "TaskUnlock",
      "ImageAsset",
      "TaskSubmission",
      "SubmissionEvidence",
      "FinalReview",
      "TaskCommandRecord",
    ]);
    expect(enums).toEqual([
      "UserRole",
      "UserStatus",
      "FinancialOperationKind",
      "FinancialOrigin",
      "FinancialActorType",
      "FundSource",
      "ReservationState",
      "TaskPublicationState",
      "TaskCodeState",
      "ImageAssetPurpose",
      "ImageAssetState",
      "TaskSubmissionStatus",
      "TaskCommandKind",
      "TaskCommandTerminalState",
    ]);
  });

  it("contains no demo or business-specific model inventory", () => {
    expect(schema).not.toMatch(
      /DemoMessage|Organization|Project|Quotation|Payment/u,
    );
  });
});
