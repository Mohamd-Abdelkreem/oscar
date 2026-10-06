import { randomUUID } from "node:crypto";
import pino from "pino";
import type { DatabaseClient } from "@template/database";
import {
  successEnvelopeSchema,
  errorEnvelopeSchema,
} from "@template/contracts";
import { createApp } from "../../../app.js";
import { generateTokenPair } from "../../../infrastructure/security/index.js";
import type { createIdentityFixture } from "../../auth/testing/identity-fixtures.js";
import type { TaskClock } from "../task-transaction.js";

export function taskHttpApp(
  database: DatabaseClient,
  financialClock: TaskClock,
) {
  return createApp({
    database,
    financialClock,
    logger: pino({ level: "silent" }),
    emailDelivery: {
      provider: "console",
      send: () => Promise.resolve({ providerMessageId: "unused" }),
    },
  });
}
export function taskHttpToken(
  account: Awaited<ReturnType<typeof createIdentityFixture>>,
) {
  return generateTokenPair({
    userId: account.user.id,
    sessionId: account.session.id,
    role: account.user.role,
    email: account.user.email,
    tokenId: randomUUID(),
    rememberMe: false,
    absoluteExpiresAt: account.session.expiresAt,
  }).accessToken;
}

export const taskHttpEnvelope = (response: { body: unknown }) =>
  successEnvelopeSchema.parse(response.body);
export const taskHttpError = (response: { body: unknown }) =>
  errorEnvelopeSchema.parse(response.body);
