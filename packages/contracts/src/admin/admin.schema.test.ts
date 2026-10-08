import { describe, expect, it } from "vitest";
import {
  adminInvitationAcceptBodySchema,
  adminInvitationIssueBodySchema,
  adminInvitationCommandBodySchema,
  adminStatusBodySchema,
  adminInvitationSchema,
  manualCreditTargetsQuerySchema,
  manualCreditTargetSchema,
  manualCreditTargetsDataSchema,
  manualCreditTargetsEnvelopeSchema,
} from "./admin.schema.ts";

describe("P02 administrator commands", () => {
  it("normalizes recipient identity while rejecting authority override", () => {
    const issue = {
      fullName: "Invited Admin",
      email: " ADMIN@Example.com ",
      confirmed: true,
      reason: "Membership",
    };
    expect(adminInvitationIssueBodySchema.parse(issue).email).toBe(
      "admin@example.com",
    );
    expect(
      adminInvitationIssueBodySchema.safeParse({ ...issue, role: "ADMIN" })
        .success,
    ).toBe(false);
    expect(
      adminInvitationCommandBodySchema.safeParse({
        confirmed: true,
        reason: "Reissue",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    expect(
      adminStatusBodySchema.safeParse({
        confirmed: true,
        reason: "Lifecycle",
        expectedVersion: 0,
        status: "SUSPENDED",
      }).success,
    ).toBe(false);
  });
  it("recipient acceptance requires matching password confirmation and no identity override", () => {
    const accept = {
      newPassword: " a-secure-password ",
      passwordConfirmation: " a-secure-password ",
    };
    expect(adminInvitationAcceptBodySchema.parse(accept)).toEqual(accept);
    expect(
      adminInvitationAcceptBodySchema.safeParse({
        ...accept,
        passwordConfirmation: "different",
      }).success,
    ).toBe(false);
    expect(
      adminInvitationAcceptBodySchema.safeParse({
        ...accept,
        email: "other@example.com",
      }).success,
    ).toBe(false);
  });
  it("keeps terminal disposition independent from delivery and excludes credentials", () => {
    const invitation = {
      id: "11111111-1111-4111-8111-111111111111",
      issuerUserId: "22222222-2222-4222-8222-222222222222",
      fullName: "Admin",
      email: "admin@example.com",
      tokenVersion: 1,
      issuedAt: "2026-10-03T00:00:00Z",
      expiresAt: "2026-10-04T00:00:00Z",
      acceptedAt: "2026-10-03T01:00:00Z",
      revokedAt: null,
      status: "ACCEPTED",
      deliveryStatus: "UNKNOWN",
    };
    expect(adminInvitationSchema.parse(invitation)).toEqual(invitation);
    expect(
      adminInvitationSchema.safeParse({ ...invitation, tokenHash: "private" })
        .success,
    ).toBe(false);
    expect(
      adminInvitationSchema.safeParse({
        ...invitation,
        revokedAt: invitation.acceptedAt,
      }).success,
    ).toBe(false);
  });
});

describe("P07 manual credit target contract", () => {
  const target = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "First Credit Employee",
    email: "first@example.com",
  };
  const pagination = {
    page: 1,
    limit: 25,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const page = { items: [target], pagination };

  it("normalizes bounded search and pagination without accepting authority fields", () => {
    expect(manualCreditTargetsQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 25,
    });
    expect(
      manualCreditTargetsQuerySchema.parse({
        page: "2",
        limit: "100",
        q: " First ",
      }),
    ).toEqual({ page: 2, limit: 100, q: "First" });
    expect(manualCreditTargetsQuerySchema.parse({ q: "   " }).q).toBe("");
  });
  it.each([
    { page: "0" },
    { limit: "101" },
    { page: ["1", "2"] },
    { q: ["first"] },
    { q: "a".repeat(151) },
    { status: "ACTIVE" },
    { page: String(Number.MAX_SAFE_INTEGER), limit: "100" },
  ])("rejects invalid target query %j", (query) => {
    expect(manualCreditTargetsQuerySchema.safeParse(query).success).toBe(false);
  });
  it.each([
    { ...target, walletId: target.id },
    { ...target, name: " " },
    { ...target, name: "a".repeat(151) },
    { ...target, email: "invalid" },
    { ...target, id: "not-an-id" },
  ])("rejects unsafe identity %j", (identity) => {
    expect(manualCreditTargetSchema.safeParse(identity).success).toBe(false);
  });
  it("requires minimal rows and matching page/envelope metadata including empty pages", () => {
    const envelope = {
      success: true,
      statusCode: 200,
      message: "Targets loaded.",
      data: page,
      paginationMeta: pagination,
      requestId: "test-request",
      timestamp: "2026-10-07T09:00:00.000Z",
      path: "/admin/employees/manual-credit-targets",
    };
    expect(manualCreditTargetsEnvelopeSchema.parse(envelope).data).toEqual(
      page,
    );
    expect(
      manualCreditTargetsEnvelopeSchema.safeParse({
        ...envelope,
        paginationMeta: { ...pagination, total: 2 },
      }).success,
    ).toBe(false);
    expect(
      manualCreditTargetsDataSchema.safeParse({ ...page, items: [] }).success,
    ).toBe(false);
    expect(
      manualCreditTargetsDataSchema.parse({
        items: [],
        pagination: {
          ...pagination,
          total: 0,
          totalPages: 0,
        },
      }).items,
    ).toEqual([]);
  });
});
