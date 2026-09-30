import { describe, expect, it, vi } from "vitest";

import type { EmailDelivery } from "./email-delivery.js";
import { EmailService } from "./email.service.js";

const createService = () => {
  const send = vi.fn<EmailDelivery["send"]>();
  send.mockResolvedValue({ providerMessageId: "provider-message-id" });
  const delivery = { provider: "console", send } satisfies EmailDelivery;
  return {
    send,
    service: new EmailService(
      delivery,
      "no-reply@example.com",
      "Template",
      "",
      "http://localhost:3000",
    ),
  };
};

describe("EmailService local previews", () => {
  it("passes the exact verification action URL to delivery", async () => {
    const { send, service } = createService();

    await service.sendVerificationEmail(
      "Template User",
      "user@example.com",
      "verification-token",
    );

    expect(send.mock.calls[0]?.[0].localPreviewUrl).toBe(
      "http://localhost:3000/auth/verify-email?token=verification-token",
    );
  });

  it("passes the exact reset action URL to delivery", async () => {
    const { send, service } = createService();

    await service.sendPasswordResetEmail(
      "Template User",
      "user@example.com",
      "reset-token",
    );

    expect(send.mock.calls[0]?.[0].localPreviewUrl).toBe(
      "http://localhost:3000/auth/reset-password?token=reset-token",
    );
  });
});
