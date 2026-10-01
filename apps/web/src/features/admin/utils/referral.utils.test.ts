import { describe, expect, it } from "vitest";
import { computeRelativeReferralHierarchy } from "./referral.utils";
import type { AdminReferralMember } from "../types/admin.types";

const TEST_MEMBERS: readonly AdminReferralMember[] = [
  // Branch 1: محمد (usr_01) -> أحمد (usr_02) -> ياسمين (usr_03) -> خالد (usr_04) -> سلمى (usr_05) -> طارق (usr_06) -> مريم (usr_07)
  {
    id: "usr_01",
    name: "محمد عبد الله",
    email: "mohamed@example.com",
    level: 5,
    packageId: "A1",
    joinedAt: "2026-01-01",
    status: "active",
    totalCommissionEarned: 500,
    directReferralsCount: 2,
    teamCount: 6,
  },
  {
    id: "usr_02",
    name: "أحمد مروان",
    email: "ahmed@example.com",
    level: 5,
    packageId: "O2",
    joinedAt: "2026-02-01",
    status: "active",
    sponsorId: "usr_01",
    sponsorName: "محمد عبد الله",
    totalCommissionEarned: 200,
    directReferralsCount: 2,
    teamCount: 4,
  },
  {
    id: "usr_02_sibling",
    name: "سارة كريم",
    email: "sara@example.com",
    level: 5,
    packageId: "O1",
    joinedAt: "2026-02-15",
    status: "active",
    sponsorId: "usr_01",
    sponsorName: "محمد عبد الله",
    totalCommissionEarned: 50,
    directReferralsCount: 0,
    teamCount: 0,
  },
  {
    id: "usr_03",
    name: "ياسمين نور",
    email: "yasmin@example.com",
    level: 5,
    packageId: "S2",
    joinedAt: "2026-03-01",
    status: "active",
    sponsorId: "usr_02",
    sponsorName: "أحمد مروان",
    totalCommissionEarned: 80,
    directReferralsCount: 1,
    teamCount: 3,
  },
  {
    id: "usr_04",
    name: "خالد محمود",
    email: "khaled@example.com",
    level: 5,
    packageId: "S1",
    joinedAt: "2026-04-01",
    status: "active",
    sponsorId: "usr_03",
    sponsorName: "ياسمين نور",
    totalCommissionEarned: 30,
    directReferralsCount: 1,
    teamCount: 2,
  },
  {
    id: "usr_05",
    name: "سلمى فهد",
    email: "salma@example.com",
    level: 5,
    packageId: "S1",
    joinedAt: "2026-05-01",
    status: "active",
    sponsorId: "usr_04",
    sponsorName: "خالد محمود",
    totalCommissionEarned: 10,
    directReferralsCount: 1,
    teamCount: 1,
  },
  {
    id: "usr_06",
    name: "طارق زياد",
    email: "tariq@example.com",
    level: 5,
    packageId: "FREE",
    joinedAt: "2026-06-01",
    status: "active",
    sponsorId: "usr_05",
    sponsorName: "سلمى فهد",
    totalCommissionEarned: 0,
    directReferralsCount: 1,
    teamCount: 0,
  },
  {
    id: "usr_07", // Level 6 relative to محمد! (Should be excluded)
    name: "مريم علي",
    email: "mariam@example.com",
    level: 5,
    packageId: "FREE",
    joinedAt: "2026-07-01",
    status: "active",
    sponsorId: "usr_06",
    sponsorName: "طارق زياد",
    totalCommissionEarned: 0,
    directReferralsCount: 0,
    teamCount: 0,
  },
  // Branch 2: عمر خالد (usr_10) - independent branch
  {
    id: "usr_10",
    name: "عمر خالد",
    email: "omar@example.com",
    level: 5,
    packageId: "O2",
    joinedAt: "2026-02-10",
    status: "active",
    totalCommissionEarned: 120,
    directReferralsCount: 1,
    teamCount: 1,
  },
  {
    id: "usr_11",
    name: "رامي ناصر",
    email: "rami@example.com",
    level: 5,
    packageId: "S1",
    joinedAt: "2026-03-12",
    status: "active",
    sponsorId: "usr_10",
    sponsorName: "عمر خالد",
    totalCommissionEarned: 15,
    directReferralsCount: 0,
    teamCount: 0,
  },
];

describe("referral.utils - computeRelativeReferralHierarchy", () => {
  it("derives correct relative levels when محمد is selected as root", () => {
    const result = computeRelativeReferralHierarchy("usr_01", TEST_MEMBERS);

    expect(result.root?.id).toBe("usr_01");
    expect(result.root?.name).toBe("محمد عبد الله");

    // L1: أحمد and سارة (direct children)
    expect(result.levelCounts[1]).toBe(2);
    const l1Ids = result.levels[1].map((n) => n.member.id);
    expect(l1Ids).toContain("usr_02");
    expect(l1Ids).toContain("usr_02_sibling");

    // L2: ياسمين (child of أحمد)
    expect(result.levelCounts[2]).toBe(1);
    expect(result.levels[2][0]?.member.id).toBe("usr_03");

    // L3: خالد (child of ياسمين)
    expect(result.levelCounts[3]).toBe(1);
    expect(result.levels[3][0]?.member.id).toBe("usr_04");

    // L4: سلمى (child of خالد)
    expect(result.levelCounts[4]).toBe(1);
    expect(result.levels[4][0]?.member.id).toBe("usr_05");

    // L5: طارق (child of سلمى)
    expect(result.levelCounts[5]).toBe(1);
    expect(result.levels[5][0]?.member.id).toBe("usr_06");

    // Level 6 (مريم) must be excluded from L1-L5
    const allDescendantIds = [
      ...result.levels[1],
      ...result.levels[2],
      ...result.levels[3],
      ...result.levels[4],
      ...result.levels[5],
    ].map((n) => n.member.id);
    expect(allDescendantIds).not.toContain("usr_07");

    // Unrelated branch (عمر and رامي) must NOT appear in محمد's team
    expect(allDescendantIds).not.toContain("usr_10");
    expect(allDescendantIds).not.toContain("usr_11");
  });

  it("derives correct relative levels when أحمد is selected as root (ancestor excluded, ياسمين is L1)", () => {
    const result = computeRelativeReferralHierarchy("usr_02", TEST_MEMBERS);

    expect(result.root?.id).toBe("usr_02");
    expect(result.root?.name).toBe("أحمد مروان");

    // L1: ياسمين (direct child of أحمد)
    expect(result.levelCounts[1]).toBe(1);
    expect(result.levels[1][0]?.member.id).toBe("usr_03");
    expect(result.levels[1][0]?.member.name).toBe("ياسمين نور");

    // L2: خالد
    expect(result.levelCounts[2]).toBe(1);
    expect(result.levels[2][0]?.member.id).toBe("usr_04");

    // L3: سلمى
    expect(result.levelCounts[3]).toBe(1);
    expect(result.levels[3][0]?.member.id).toBe("usr_05");

    // L4: طارق
    expect(result.levelCounts[4]).toBe(1);
    expect(result.levels[4][0]?.member.id).toBe("usr_06");

    // L5: مريم (child of طارق, now within depth 5 of أحمد!)
    expect(result.levelCounts[5]).toBe(1);
    expect(result.levels[5][0]?.member.id).toBe("usr_07");

    // Ancestor (محمد) and sibling (سارة) must NOT be listed in أحمد's team
    const allDescendantIds = [
      ...result.levels[1],
      ...result.levels[2],
      ...result.levels[3],
      ...result.levels[4],
      ...result.levels[5],
    ].map((n) => n.member.id);
    expect(allDescendantIds).not.toContain("usr_01");
    expect(allDescendantIds).not.toContain("usr_02_sibling");
  });

  it("handles independent roots and empty teams cleanly", () => {
    // عمر خالد
    const omarResult = computeRelativeReferralHierarchy("usr_10", TEST_MEMBERS);
    expect(omarResult.levelCounts[1]).toBe(1);
    expect(omarResult.levels[1][0]?.member.id).toBe("usr_11");
    expect(omarResult.totalTeamCount).toBe(1);

    // Leaf member (مريم) with no children
    const leafResult = computeRelativeReferralHierarchy("usr_07", TEST_MEMBERS);
    expect(leafResult.totalTeamCount).toBe(0);
    expect(leafResult.levelCounts[1]).toBe(0);
  });

  it("protects against cycles without infinite looping", () => {
    const cyclicMembers: readonly AdminReferralMember[] = [
      {
        id: "c_1",
        name: "عضو 1",
        email: "c1@test.com",
        level: 5,
        packageId: "S1",
        joinedAt: "2026-01-01",
        status: "active",
        sponsorId: "c_2", // cycle!
        totalCommissionEarned: 0,
        directReferralsCount: 1,
        teamCount: 1,
      },
      {
        id: "c_2",
        name: "عضو 2",
        email: "c2@test.com",
        level: 5,
        packageId: "S1",
        joinedAt: "2026-01-01",
        status: "active",
        sponsorId: "c_1", // cycle!
        totalCommissionEarned: 0,
        directReferralsCount: 1,
        teamCount: 1,
      },
    ];

    const res = computeRelativeReferralHierarchy("c_1", cyclicMembers);
    expect(res.levelCounts[1]).toBe(1);
    expect(res.levels[1][0]?.member.id).toBe("c_2");
    // Cycle did not blow stack or repeat c_1 in level 2
    expect(res.levelCounts[2]).toBe(0);
  });
});
