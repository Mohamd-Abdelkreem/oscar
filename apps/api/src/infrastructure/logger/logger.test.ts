import { describe, expect, it } from "vitest";

import { createLogger, LOGGER_REDACT_PATHS } from "./logger.js";

describe("logger redaction", () => {
  it("explicitly redacts the double-submit CSRF request header", () => {
    expect(LOGGER_REDACT_PATHS).toContain("req.headers['x-csrf-token']");
  });

  it("redacts credentials from actual serialized Pino output", () => {
    const chunks: string[] = [];
    const testLogger = createLogger({
      level: "info",
      pretty: false,
      destination: {
        write: (chunk) => {
          chunks.push(chunk);
        },
      },
    });
    const secrets = [
      "Bearer access-secret",
      "refreshToken=refresh-secret",
      "csrf-secret",
      "password-secret",
      "new-password-secret",
      "top-level-access-secret",
      "reset-token-secret",
      "smtp-secret",
      "refreshToken=response-secret",
    ];

    testLogger.info({
      req: {
        headers: {
          authorization: secrets[0],
          cookie: secrets[1],
          "x-csrf-token": secrets[2],
        },
        body: { password: secrets[3], newPassword: secrets[4] },
      },
      accessToken: secrets[5],
      resetToken: secrets[6],
      credentials: { smtpPassword: secrets[7] },
      res: { headers: { "set-cookie": secrets[8] } },
    });

    const serialized = chunks.join("");
    for (const secret of secrets) expect(serialized).not.toContain(secret);
    const event = JSON.parse(serialized) as {
      req: { headers: Record<string, string>; body: Record<string, string> };
      accessToken: string;
      resetToken: string;
      credentials: { smtpPassword: string };
      res: { headers: Record<string, string> };
    };
    expect(event.req.headers).toMatchObject({
      authorization: "[REDACTED]",
      cookie: "[REDACTED]",
      "x-csrf-token": "[REDACTED]",
    });
    expect(event.req.body).toMatchObject({
      password: "[REDACTED]",
      newPassword: "[REDACTED]",
    });
    expect(event.accessToken).toBe("[REDACTED]");
    expect(event.resetToken).toBe("[REDACTED]");
    expect(event.credentials.smtpPassword).toBe("[REDACTED]");
    expect(event.res.headers["set-cookie"]).toBe("[REDACTED]");
  });
});
