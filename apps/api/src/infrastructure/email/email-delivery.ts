import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import type { ReadableStreamReadResult } from "node:stream/web";

import { z } from "zod";

import {
  emailConfig,
  getSmtpTransporter,
  type EmailProvider,
} from "../../core/config/index.js";
import {
  resendConfig,
  type ResendHttpTransport,
} from "../../core/config/resend.config.js";
import { logger } from "../logger/logger.js";

const maximumAttempts = 3;

export type EmailSendRequest = Readonly<{
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  localPreviewUrl?: string;
  assertCanDispatch?: () => Promise<void>;
  retainLocalPreview?: false;
}>;

export type EmailSendResult = Readonly<{
  providerMessageId: string | null;
}>;

export interface EmailDelivery {
  readonly provider: EmailProvider;
  send(request: EmailSendRequest): Promise<EmailSendResult>;
}

export interface SmtpEmailTransport {
  sendMail(
    options: EmailSendRequest,
  ): Promise<Readonly<{ messageId?: string }>>;
}

type RetryWait = (delayMs: number) => Promise<void>;

const wait: RetryWait = async (delayMs) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

export type EmailFailureCode =
  | "TIMEOUT"
  | "TRANSPORT"
  | "RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_REJECTED"
  | "INVALID_RESPONSE"
  | "RESPONSE_TOO_LARGE";
export class EmailDeliveryError extends Error {
  constructor(
    readonly provider: EmailProvider,
    readonly attempts: number,
    readonly disposition: "UNKNOWN" | "REJECTED" = "UNKNOWN",
    readonly code: EmailFailureCode = "TRANSPORT",
  ) {
    super(
      `${provider} email delivery failed after ${String(attempts)} attempt(s).`,
    );
    this.name = "EmailDeliveryError";
  }
}
const logFailure = (
  provider: EmailProvider,
  attempt: number,
  code: EmailFailureCode = "TRANSPORT",
): void => {
  logger.error(
    { provider, attempt, outcome: "email_send_failed", code },
    "Email send attempt failed.",
  );
};

export type ConsoleEmailPreview = (
  request: EmailSendRequest,
) => void | Promise<void>;

export const findWorkspaceRoot = async (
  startDirectory = process.cwd(),
): Promise<string> => {
  let currentDirectory = resolve(startDirectory);
  const fileSystemRoot = parse(currentDirectory).root;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The upward search terminates by returning or throwing at the filesystem root.
  while (true) {
    try {
      await access(join(currentDirectory, "pnpm-workspace.yaml"));
      return currentDirectory;
    } catch (error) {
      if (currentDirectory === fileSystemRoot) {
        throw new Error("Could not locate the pnpm workspace root.", {
          cause: error,
        });
      }

      currentDirectory = dirname(currentDirectory);
    }
  }
};

export const createFileConsolePreview =
  (providedPreviewDirectory?: string): ConsoleEmailPreview =>
  async (request) => {
    if (request.retainLocalPreview === false)
      throw new EmailDeliveryError(
        "console",
        0,
        "REJECTED",
        "PROVIDER_REJECTED",
      );
    const previewDirectory =
      providedPreviewDirectory === undefined
        ? join(await findWorkspaceRoot(process.cwd()), ".local-emails")
        : resolve(providedPreviewDirectory);

    const previewPath = join(
      previewDirectory,
      `${String(Date.now())}-${randomUUID()}.html`,
    );

    await mkdir(previewDirectory, {
      recursive: true,
      mode: 0o700,
    });

    await writeFile(previewPath, request.html, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });

    logger.info(
      {
        provider: "console",
        outcome: "email_preview_available",
        recipientDomain: request.to.split("@")[1] ?? null,
        subject: request.subject,
        previewPath,
      },
      "Email captured by the local console provider.",
    );
  };

export class ConsoleEmailDelivery implements EmailDelivery {
  readonly provider = "console" as const;

  constructor(
    private readonly preview: ConsoleEmailPreview = createFileConsolePreview(),
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    await request.assertCanDispatch?.();
    if (request.retainLocalPreview === false)
      throw new EmailDeliveryError(
        this.provider,
        0,
        "REJECTED",
        "PROVIDER_REJECTED",
      );
    try {
      await this.preview(request);
    } catch {
      logFailure(this.provider, 1);
      throw new EmailDeliveryError(this.provider, 1);
    }
    return { providerMessageId: `console/${randomUUID()}` };
  }
}

type FailedAttempt = Readonly<{
  code: EmailFailureCode;
  uncertain: boolean;
  retryable: boolean;
}>;
type ResendAttempt = Readonly<{ providerMessageId: string }> | FailedAttempt;
export type ResendDeliveryDependencies = Readonly<{
  fetch?: ResendHttpTransport;
  wait?: RetryWait;
  idempotencyKey?: () => string;
  apiKey?: string;
  timeoutSignal?: () => AbortSignal;
}>;
class ResponseLimitError extends Error {}

const abortable = async <T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  if (signal.aborted)
    throw new DOMException("Email attempt expired.", "TimeoutError");
  let abort = () => {};
  const expired = new Promise<never>((_resolve, reject) => {
    abort = () => {
      reject(new DOMException("Email attempt expired.", "TimeoutError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([pending, expired]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
};

const boundedResponseBody = async (
  response: Response,
  signal: AbortSignal,
): Promise<string> => {
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk: ReadableStreamReadResult<unknown> = await abortable(
        reader.read(),
        signal,
      );
      if (chunk.done) break;
      if (!(chunk.value instanceof Uint8Array)) throw new ResponseLimitError();
      size += chunk.value.byteLength;
      if (size > resendConfig.responseLimitBytes)
        throw new ResponseLimitError();
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    // Cancel unread provider bytes on every failure without exposing stream diagnostics.
    await abortable(reader.cancel(), signal).catch(() => {});
    reader.releaseLock();
  }
};

const resendHttpFailure = (status: number): FailedAttempt => ({
  uncertain: status >= 500 || status === 408 || status === 409 || status < 400,
  retryable: [429, 500, 502, 503, 504].includes(status),
  code:
    status === 429
      ? "RATE_LIMIT"
      : status >= 500
        ? "PROVIDER_UNAVAILABLE"
        : "PROVIDER_REJECTED",
});
const resendSuccessSchema = z.object({ id: z.uuid() });

export class ResendEmailDelivery implements EmailDelivery {
  readonly provider = "resend" as const;
  private readonly fetchEmail: ResendHttpTransport;
  private readonly retryWait: RetryWait;
  private readonly keyFactory: () => string;
  private readonly apiKey: string;
  private readonly timeoutSignal: () => AbortSignal;

  constructor(dependencies: ResendDeliveryDependencies = {}) {
    this.fetchEmail = dependencies.fetch ?? fetch;
    this.retryWait = dependencies.wait ?? wait;
    this.keyFactory =
      dependencies.idempotencyKey ?? (() => `identity-email/${randomUUID()}`);
    this.apiKey = dependencies.apiKey ?? emailConfig.resendApiKey;
    this.timeoutSignal =
      dependencies.timeoutSignal ??
      (() => AbortSignal.timeout(resendConfig.attemptTimeoutMs));
  }

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const idempotencyKey = this.keyFactory();
    const payload = JSON.stringify({
      from: request.from,
      to: request.to,
      subject: request.subject,
      html: request.html,
      ...(request.replyTo === undefined ? {} : { reply_to: request.replyTo }),
    });
    let uncertain = false;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        await request.assertCanDispatch?.();
      } catch (failure) {
        if (!uncertain) throw failure;
        // Closure stops retries but cannot erase a possibly accepted earlier dispatch.
        throw new EmailDeliveryError(
          this.provider,
          attempt - 1,
          "UNKNOWN",
          "TRANSPORT",
        );
      }
      const outcome = await this.attempt(payload, idempotencyKey);
      if ("providerMessageId" in outcome) return outcome;
      uncertain ||= outcome.uncertain;
      logFailure(this.provider, attempt, outcome.code);
      if (!outcome.retryable || attempt === maximumAttempts)
        throw new EmailDeliveryError(
          this.provider,
          attempt,
          uncertain ? "UNKNOWN" : "REJECTED",
          outcome.code,
        );
      await this.retryWait(attempt === 1 ? 100 : 250);
    }
    throw new EmailDeliveryError(this.provider, maximumAttempts);
  }

  private async attempt(
    payload: string,
    idempotencyKey: string,
  ): Promise<ResendAttempt> {
    const signal = this.timeoutSignal();
    try {
      const response = await abortable(
        this.fetchEmail(resendConfig.endpoint, {
          method: "POST",
          redirect: "error",
          signal,
          body: payload,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
        }),
        signal,
      );
      const body = await boundedResponseBody(response, signal);
      if (!response.ok) return resendHttpFailure(response.status);
      let decoded: unknown;
      try {
        decoded = JSON.parse(body);
      } catch {
        return { code: "INVALID_RESPONSE", uncertain: true, retryable: false };
      }
      const parsed = resendSuccessSchema.safeParse(decoded);
      return parsed.success
        ? { providerMessageId: parsed.data.id }
        : { code: "INVALID_RESPONSE", uncertain: true, retryable: false };
    } catch (failure) {
      if (failure instanceof ResponseLimitError)
        return {
          code: "RESPONSE_TOO_LARGE",
          uncertain: true,
          retryable: false,
        };
      if (signal.aborted)
        return { code: "TIMEOUT", uncertain: true, retryable: true };
      const redirect =
        failure instanceof TypeError &&
        failure.cause instanceof Error &&
        failure.cause.message === "unexpected redirect";
      return { code: "TRANSPORT", uncertain: true, retryable: !redirect };
    }
  }
}

export class SmtpEmailDelivery implements EmailDelivery {
  readonly provider = "smtp" as const;

  constructor(
    private readonly getTransporter: () => SmtpEmailTransport = getSmtpTransporter,
    private readonly retryWait: RetryWait = wait,
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    let uncertain = false;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        await request.assertCanDispatch?.();
      } catch (failure) {
        if (!uncertain) throw failure;
        throw new EmailDeliveryError(this.provider, attempt - 1, "UNKNOWN");
      }
      try {
        const result = await this.getTransporter().sendMail({
          from: request.from,
          to: request.to,
          subject: request.subject,
          html: request.html,
          ...(request.replyTo === undefined
            ? {}
            : { replyTo: request.replyTo }),
        });
        return { providerMessageId: result.messageId ?? null };
      } catch {
        uncertain = true;
        logFailure(this.provider, attempt);
        if (attempt === maximumAttempts) {
          throw new EmailDeliveryError(this.provider, attempt);
        }
        await this.retryWait(attempt * 1_000);
      }
    }

    throw new EmailDeliveryError(this.provider, maximumAttempts);
  }
}

export type EmailDeliveryDependencies = Readonly<{
  consolePreview?: ConsoleEmailPreview;
  resendFetch?: ResendHttpTransport;
  getSmtpTransporter?: () => SmtpEmailTransport;
}>;

export const createEmailDelivery = (
  provider: EmailProvider = emailConfig.provider,
  dependencies: EmailDeliveryDependencies = {},
): EmailDelivery =>
  provider === "console"
    ? new ConsoleEmailDelivery(dependencies.consolePreview)
    : provider === "resend"
      ? new ResendEmailDelivery(
          dependencies.resendFetch === undefined
            ? {}
            : { fetch: dependencies.resendFetch },
        )
      : new SmtpEmailDelivery(dependencies.getSmtpTransporter);
