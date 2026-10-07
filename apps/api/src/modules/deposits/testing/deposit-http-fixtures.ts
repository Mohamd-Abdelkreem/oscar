import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import type { DatabaseClient } from "@template/database";
import { createApp } from "../../../app.js";
import { generateTokenPair } from "../../../infrastructure/security/index.js";
import type { createIdentityFixture } from "../../auth/testing/identity-fixtures.js";
import { financialFixtureAdmission } from "../../ledger/testing/financial-fixtures.js";
import { depositToken } from "./deposit-fixtures.js";

export type DepositIdentity = Awaited<ReturnType<typeof createIdentityFixture>>;
export const depositIdentity = (account: DepositIdentity) => ({
  userId: account.user.id,
  sessionId: account.session.id,
});
export function depositHttp(database: DatabaseClient) {
  const app = createApp({
    database,
    logger: pino({ level: "silent" }),
    financialAdmission: financialFixtureAdmission(database),
    depositMetadata: {
      network: "TRON_NILE",
      token: { symbol: "USDT", contract: depositToken, decimals: 6 },
    },
    emailDelivery: {
      provider: "console",
      send: () => Promise.resolve({ providerMessageId: "unused" }),
    },
  });
  const token = (account: DepositIdentity) =>
    generateTokenPair({
      ...depositIdentity(account),
      tokenId: randomUUID(),
      email: account.user.email,
      role: account.user.role,
      rememberMe: false,
      absoluteExpiresAt: account.session.expiresAt,
    }).accessToken;
  return {
    app,
    credential: token,
    read: (path: string, account: DepositIdentity) =>
      request(app)
        .get(`/api/v1${path}`)
        .auth(token(account), { type: "bearer" }),
    write: (path: string, account: DepositIdentity) =>
      request(app)
        .post(`/api/v1${path}`)
        .auth(token(account), { type: "bearer" })
        .set("Cookie", "csrfToken=p06-test")
        .set("X-CSRF-Token", "p06-test"),
  };
}
export const manualGrant = (employeeId: string) => ({
  actionId: randomUUID(),
  employeeId,
  amount: "1.000001",
  confirmed: true as const,
  reason: "Initial administrative grant",
  reference: { kind: "EXTERNAL" as const, value: "Ticket 123" },
});
export async function manualState(database: DatabaseClient) {
  const orderBy = { id: "asc" as const };
  return {
    wallets: await database.wallet.findMany({ orderBy }),
    grants: await database.manualCredit.findMany({ orderBy }),
    operations: await database.financialOperation.findMany({ orderBy }),
    postings: await database.ledgerPosting.findMany({ orderBy }),
    audit: await database.auditRecord.findMany({ orderBy }),
    aliases: await database.requestIdentity.findMany({ orderBy }),
    receipts: await database.depositReceipt.findMany({ orderBy }),
    allocations: await database.reservationAllocation.findMany({ orderBy }),
  };
}
