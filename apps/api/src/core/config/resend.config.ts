export type ResendHttpTransport = typeof fetch;

export const resendConfig = Object.freeze({
  endpoint: "https://api.resend.com/emails",
  attemptTimeoutMs: 10_000,
  responseLimitBytes: 64 * 1024,
});
