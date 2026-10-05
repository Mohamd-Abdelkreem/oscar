import { describe, expect, it } from "vitest";
import {
  adminInvitationAcceptBodySchema,
  adminInvitationIssueBodySchema,
  adminInvitationCommandBodySchema,
  adminStatusBodySchema,
  adminInvitationSchema,
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
