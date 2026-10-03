import { describe, expect, it, vi } from "vitest";

import { EmailDeliveryError, type EmailDelivery } from "./email-delivery.js";
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
  it("retains rejected and unknown invitation outcomes without retaining or logging recipient action credentials", async () => {
    const { send } = createService();
    const service = new EmailService(
      { provider: "resend", send },
      "sender@company.test",
      "Company",
      "support@company.test",
      "https://company.test",
      "https://company.test/approved-invitation",
    );
    for (const disposition of ["REJECTED", "UNKNOWN"] as const) {
      const failure = new EmailDeliveryError(
        "resend",
        3,
        disposition,
        "PROVIDER_UNAVAILABLE",
      );
      send.mockRejectedValueOnce(failure);
      await expect(
        service.sendAdminInvitation({
          fullName: "Recipient",
          email: "recipient@company.test",
          token: "sentinel-recipient-invitation-credential",
          assertCanDispatch: () => Promise.resolve(),
        }),
      ).rejects.toBe(failure);
      expect(JSON.stringify(failure)).not.toContain(
        "sentinel-recipient-invitation-credential",
      );
    }
  });
  it("propagates a bounded unknown provider outcome without announcing successful delivery", async () => {
    const { send, service } = createService();
    const failure = new EmailDeliveryError("resend", 3, "UNKNOWN", "TIMEOUT");
    send.mockRejectedValueOnce(failure);
    await expect(
      service.sendVerificationEmail(
        "Template User",
        "user@example.com",
        "verification-token",
      ),
    ).rejects.toBe(failure);
    expect(send).toHaveBeenCalledOnce();
  });
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
