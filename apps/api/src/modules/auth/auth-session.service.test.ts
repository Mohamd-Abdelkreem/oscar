import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyAccessToken,
  verifyRefreshToken,
  sha256,
} from "../../infrastructure/security/index.js";
import { AuthSessionService } from "./auth-session.service.js";

describe("P02 US2 session credential orchestration", () => {
  it.each([false, true])(
    "binds credential records to their stable owned session for rememberMe=%s",
    (rememberMe) => {
      const session = {
        id: randomUUID(),
        userId: randomUUID(),
        rememberMe,
        expiresAt: new Date("2030-10-03T18:00:00.000Z"),
      };
      const user = {
        id: session.userId,
        role: "ADMIN" as const,
        email: "admin@example.com",
      };
      const credentials = new AuthSessionService().createCredentials(
        user,
        session,
      );
      const access = verifyAccessToken(credentials.tokens.accessToken);
      const refresh = verifyRefreshToken(credentials.tokens.refreshToken);
      expect(access.valid && access.payload.sessionId).toBe(session.id);
      expect(refresh.valid && refresh.payload.sessionId).toBe(session.id);
      expect(refresh.valid && refresh.payload.rememberMe).toBe(rememberMe);
      expect(credentials.record).toMatchObject({
        userId: session.userId,
        sessionId: session.id,
        expiresAt: session.expiresAt,
        tokenHash: sha256(credentials.tokens.refreshToken),
      });
      expect(refresh.valid && refresh.payload.tokenId).toBe(
        credentials.record.id,
      );
    },
  );
});
