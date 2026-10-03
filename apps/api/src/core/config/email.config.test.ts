import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEmailEnvironment } from "./email.config.js";

const configured = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_sentinel_generated_provider_credential",
  MAIL_FROM_NAME: "Configured Company",
  MAIL_FROM_ADDRESS: "sender@configured-company.test",
  MAIL_REPLY_TO: "support@configured-company.test",
  WEB_APP_URL: "https://configured-company.test",
  ADMIN_INVITATION_ACCEPT_URL:
    "https://configured-company.test/approved-recipient-surface",
};
describe("production email configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it.each(["MAIL_FROM_ADDRESS", "ADMIN_INVITATION_ACCEPT_URL"])(
    "fails module initialization without %s instead of inheriting a local default",
    async (missing) => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      for (const [key, setting] of Object.entries(configured))
        vi.stubEnv(key, key === missing ? undefined : setting);
      await expect(import("./email.config.js")).rejects.toThrow(missing);
    },
  );
  it("requires explicit company identity and same-origin HTTPS invitation destination", () => {
    expect(parseEmailEnvironment(configured, "production")).toMatchObject({
      provider: "resend",
      publicWebUrl: configured.WEB_APP_URL,
      invitationAcceptUrl: configured.ADMIN_INVITATION_ACCEPT_URL,
    });
  });
  it.each(Object.keys(configured))(
    "rejects missing or blank required %s without values",
    (key) => {
      for (const missing of [undefined, " "])
        expect(() =>
          parseEmailEnvironment(
            { ...configured, [key]: missing },
            "production",
          ),
        ).toThrow();
    },
  );
  it.each([
    { EMAIL_PROVIDER: "console" },
    { EMAIL_PROVIDER: "smtp" },
    { RESEND_API_KEY: "re_test_placeholder_0000" },
    { MAIL_FROM_NAME: "Full-Stack Boilerplate" },
    { MAIL_FROM_ADDRESS: "no-reply@example.com" },
    { MAIL_REPLY_TO: "support@example.com" },
    { WEB_APP_URL: "http://configured-company.test" },
    { WEB_APP_URL: "https://configured-company.test/unapproved-base" },
    {
      ADMIN_INVITATION_ACCEPT_URL:
        "https://configured-company.test:444/recipient",
    },
    {
      ADMIN_INVITATION_ACCEPT_URL:
        "https://configured-company.test/recipient?token=private-destination-sentinel",
    },
    {
      ADMIN_INVITATION_ACCEPT_URL:
        "https://configured-company.test/recipient#private-destination-sentinel",
    },
    { ADMIN_INVITATION_ACCEPT_URL: "https://another-origin.test/recipient" },
    { ADMIN_INVITATION_ACCEPT_URL: "http://configured-company.test/recipient" },
    {
      ADMIN_INVITATION_ACCEPT_URL:
        "https://private:sentinel@configured-company.test/recipient",
    },
  ])(
    "fails closed for invalid provider/company/destination settings",
    (invalid) => {
      let failure: unknown;
      try {
        parseEmailEnvironment({ ...configured, ...invalid }, "production");
      } catch (caught) {
        failure = caught;
      }
      expect(failure).toBeInstanceOf(Error);
      if (failure instanceof Error)
        for (const setting of Object.values(invalid))
          expect(failure.message).not.toContain(setting);
    },
  );
  it("projects value-free malformed URL failures and supports existing local console settings", () => {
    expect(() =>
      parseEmailEnvironment(
        { ...configured, WEB_APP_URL: "malformed-private-sentinel" },
        "production",
      ),
    ).toThrow("WEB_APP_URL");
    expect(parseEmailEnvironment({}, "test")).toMatchObject({
      provider: "console",
      invitationAcceptUrl: null,
    });
  });
});
