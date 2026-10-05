import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { identityAuditInputSchema } from "./identity-audit.js";

const actor = randomUUID();
const target = randomUUID();
const command = {
  action: "EMPLOYEE_CONTROL",
  actorKind: "ADMIN",
  actorUserId: actor,
  targetUserId: target,
  reason: "Independent restriction",
  afterSnapshot: {
    id: target,
    status: "ACTIVE",
    tasksBlocked: true,
    accountVersion: 1,
  },
};

describe("credential-free identity audit", () => {
  it("accepts only the enumerated actor/action/reason matrix", () => {
    expect(identityAuditInputSchema.parse(command)).toEqual(command);
    for (const invalid of [
      { action: "UNKNOWN" },
      { actorKind: "OPERATOR" },
      { reason: " " },
      { actorUserId: null },
      { outcome: "DENIED" },
      { occurredAt: "client-time" },
    ])
      expect(
        identityAuditInputSchema.safeParse({ ...command, ...invalid }).success,
      ).toBe(false);
    expect(
      identityAuditInputSchema.safeParse({
        action: "ADMIN_EMAIL_ACTIVATE",
        actorKind: "VERIFIED_EMAIL_RECIPIENT",
        actorUserId: target,
        targetUserId: target,
      }).success,
    ).toBe(true);
    expect(
      identityAuditInputSchema.safeParse({
        action: "ADMIN_EMAIL_ACTIVATE",
        actorKind: "VERIFIED_EMAIL_RECIPIENT",
        actorUserId: actor,
        targetUserId: target,
      }).success,
    ).toBe(false);
  });
  it("rejects credentials even when nested beneath an allowlisted snapshot key", () => {
    for (const afterSnapshot of [
      { passwordHash: "sentinel" },
      { id: { token: "sentinel" } },
      { status: "sentinel" },
      { accountVersion: -1 },
      { sessionId: actor },
    ])
      expect(
        identityAuditInputSchema.safeParse({ ...command, afterSnapshot })
          .success,
      ).toBe(false);
  });
  it("requires invitation attribution and positive generation without recipient reason", () => {
    const acceptance = {
      action: "INVITATION_ACCEPT",
      actorKind: "INVITED_RECIPIENT",
      actorUserId: target,
      targetUserId: target,
      invitationId: randomUUID(),
      issuerUserId: actor,
      tokenVersion: 1,
    };
    expect(identityAuditInputSchema.safeParse(acceptance).success).toBe(true);
    expect(
      identityAuditInputSchema.safeParse({ ...acceptance, tokenVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      identityAuditInputSchema.safeParse({ ...acceptance, reason: "Unneeded" })
        .success,
    ).toBe(false);
  });
});
