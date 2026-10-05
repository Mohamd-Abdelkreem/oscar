import { describe, expect, it } from "vitest";
import {
  adminCommissionFilterSchema,
  adminCommissionSchema,
  adminMemberPageSchema,
  adminMemberSchema,
  adminTeamSummarySchema,
  employeeCommissionSchema,
  employeeMemberSchema,
  employeeTeamSummarySchema,
  rootSearchFilterSchema,
} from "./referral.schema.ts";
import {
  p04EmptyPagination,
  p04Id,
  p04Now,
  p04OtherId,
} from "../testing/p04-fixtures.ts";

const root = { id: p04Id, fullName: "Root", referralCode: "a".repeat(32) };
const member = {
  id: p04OtherId,
  fullName: "Member",
  joinedAt: p04Now,
  level: 1,
  packageCode: null,
  viewerEarnedFromMember: "0",
};
const summary = {
  root,
  serverNow: p04Now,
  currentRates: { version: 2, ratesBps: [1200, 600, 400, 200, 200] },
  levelCounts: [1, 2, 3, 4, 5].map((level) => ({
    level,
    members: 2,
    paidMembers: 1,
  })),
  ownEarned: { byLevel: ["64.8", "0", "0", "0", "0"], total: "64.8" },
};
const commission = {
  decisionId: p04Id,
  purchaseId: p04OtherId,
  occurredAt: p04Now,
  level: 1,
  buyer: { id: p04OtherId, fullName: "Buyer" },
  rateBps: 1200,
  commissionBase: "540",
  award: "64.8",
  decision: "AWARDED",
};
describe("relative referral projections", () => {
  it("separates employee root and descendant privacy from admin identities/paths", () => {
    expect(employeeTeamSummarySchema.parse(summary).currentRates.version).toBe(
      2,
    );
    expect(employeeMemberSchema.parse(member)).not.toHaveProperty("email");
    for (const field of [
      "email",
      "wallet",
      "earnings",
      "passwordHash",
      "sponsorUserId",
    ])
      expect(
        employeeMemberSchema.safeParse({ ...member, [field]: "private" })
          .success,
      ).toBe(false);
    const admin = {
      ...member,
      email: "member@example.test",
      path: [{ id: member.id, fullName: member.fullName }],
    };
    expect(adminMemberSchema.parse(admin).path).toHaveLength(1);
    expect(adminMemberSchema.safeParse({ ...admin, level: 5 }).success).toBe(
      false,
    );
    expect(
      employeeTeamSummarySchema.safeParse({
        ...summary,
        root: { ...root, email: "root@example.test" },
      }).success,
    ).toBe(false);
  });
  it("distinguishes filtered member total from unfiltered fixed level counts", () => {
    expect(
      employeeTeamSummarySchema.safeParse({
        ...summary,
        ownEarned: { ...summary.ownEarned, total: "0" },
      }).success,
    ).toBe(false);
    const adminSummary = {
      ...summary,
      root: { ...root, email: "root@example.test", joinedAt: p04Now },
      levelCountsScope: "ROOT_UNFILTERED",
      deeperDescendantCount: 10,
    };
    expect(
      adminTeamSummarySchema.parse(adminSummary).levelCounts[0]?.members,
    ).toBe(2);
    expect(
      adminMemberPageSchema.parse({
        items: [],
        pagination: p04EmptyPagination,
        rootId: p04Id,
        memberCountScope: "FILTERED_MEMBERS",
        serverNow: p04Now,
      }).pagination.total,
    ).toBe(0);
    for (const counts of [
      [{ level: 1, members: 0, paidMembers: 1 }],
      summary.levelCounts.map((count) => ({ ...count, level: 1 })),
    ])
      expect(
        employeeTeamSummarySchema.safeParse({ ...summary, levelCounts: counts })
          .success,
      ).toBe(false);
  });
  it("saves event rates independently and hides skipped eligibility from employees", () => {
    expect(employeeCommissionSchema.parse(commission).rateBps).toBe(1200);
    expect(
      employeeCommissionSchema.safeParse({ ...commission, award: "64.800001" })
        .success,
    ).toBe(false);
    expect(
      employeeCommissionSchema.parse({
        ...commission,
        decision: "ELIGIBLE_ZERO",
        commissionBase: "0.000001",
        rateBps: 1,
        award: "0",
        zeroReason: "FLOORED_ZERO",
      }).award,
    ).toBe("0");
    expect(
      employeeCommissionSchema.safeParse({
        ...commission,
        decision: "ELIGIBLE_ZERO",
        commissionBase: "0",
        award: "0",
        zeroReason: "ZERO_RATE",
      }).success,
    ).toBe(false);
    const skipped = {
      ...commission,
      award: "0",
      decision: "SKIPPED",
      skippedReason: "FREE",
      zeroReason: null,
      eligibility: {
        status: "ACTIVE",
        role: "USER",
        accountVersion: 0,
        emailVerified: true,
        subscriptionId: null,
        expiresAt: null,
      },
    };
    expect(adminCommissionSchema.parse(skipped).decision).toBe("SKIPPED");
    expect(employeeCommissionSchema.safeParse(skipped).success).toBe(false);
    expect(
      adminCommissionSchema.safeParse({ ...skipped, award: "1" }).success,
    ).toBe(false);
    expect(
      employeeCommissionSchema.safeParse({ ...commission, level: 6 }).success,
    ).toBe(false);
    expect(
      employeeCommissionSchema.safeParse({ ...commission, rateBps: 10001 })
        .success,
    ).toBe(false);
  });
  it("bounds independent root and beneficiary searches", () => {
    expect(rootSearchFilterSchema.parse({ q: "  Root  " }).q).toBe("Root");
    expect(
      adminCommissionFilterSchema.parse({ level: "5", decision: "SKIPPED" })
        .level,
    ).toBe(5);
    for (const query of [
      { q: "x".repeat(151) },
      { q: ["root"] },
      { level: "6" },
      { rootId: p04Id },
    ])
      expect(rootSearchFilterSchema.safeParse(query).success).toBe(false);
    expect(
      adminCommissionFilterSchema.safeParse({
        from: "2026-10-06T00:00:00Z",
        to: p04Now,
      }).success,
    ).toBe(false);
  });
});
