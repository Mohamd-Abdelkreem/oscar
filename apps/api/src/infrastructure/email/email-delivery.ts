import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import type { ErrorResponse } from "resend";

import {
  emailConfig,
  getSmtpTransporter,
  type EmailProvider,
} from "../../core/config/index.js";
import {
  getResendEmailClient,
  type ResendEmailClient,
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

const isTransientResendError = (error: ErrorResponse): boolean =>
  error.name === "rate_limit_exceeded" ||
  error.name === "concurrent_idempotent_requests" ||
  error.name === "application_error" ||
  error.name === "internal_server_error" ||
  (error.statusCode !== null && error.statusCode >= 500);

const safeError = (
  error: unknown,
): Readonly<{ name: string; statusCode: number | null }> => {
  if (error instanceof Error) {
    return { name: error.name, statusCode: null };
  }
  if (error !== null && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      name:
        typeof record["name"] === "string" ? record["name"] : "UnknownError",
      statusCode:
        typeof record["statusCode"] === "number" ? record["statusCode"] : null,
    };
  }
  return { name: "UnknownError", statusCode: null };
};

const logFailure = (
  provider: EmailProvider,
  attempt: number,
  error: unknown,
): void => {
  const details = safeError(error);
  logger.error(
    {
      provider,
      attempt,
      outcome: "email_send_failed",
      errorName: details.name,
      errorStatusCode: details.statusCode,
    },
    "Email send attempt failed.",
  );
};

export class EmailDeliveryError extends Error {
  constructor(provider: EmailProvider, attempts: number) {
    super(
      `${provider} email delivery failed after ${String(attempts)} attempt(s).`,
    );
    this.name = "EmailDeliveryError";
  }
}

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
    try {
      await this.preview(request);
    } catch (error) {
      logFailure(this.provider, 1, error);
      throw new EmailDeliveryError(this.provider, 1);
    }
    return { providerMessageId: `console/${randomUUID()}` };
  }
}

export class ResendEmailDelivery implements EmailDelivery {
  readonly provider = "resend" as const;

  constructor(
    private readonly getClient: () => ResendEmailClient = getResendEmailClient,
    private readonly retryWait: RetryWait = wait,
    private readonly idempotencyKeyFactory: () => string = () =>
      `template-email/${randomUUID()}`,
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const idempotencyKey = this.idempotencyKeyFactory();

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        const response = await this.getClient().send(
          {
            from: request.from,
            to: request.to,
            subject: request.subject,
            html: request.html,
            ...(request.replyTo === undefined
              ? {}
              : { replyTo: request.replyTo }),
          },
          { idempotencyKey },
        );

        if (response.error === null) {
          return { providerMessageId: response.data.id };
        }

        logFailure(this.provider, attempt, response.error);
        if (
          !isTransientResendError(response.error) ||
          attempt === maximumAttempts
        ) {
          throw new EmailDeliveryError(this.provider, attempt);
        }
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        logFailure(this.provider, attempt, error);
        if (!(error instanceof TypeError) || attempt === maximumAttempts) {
          throw new EmailDeliveryError(this.provider, attempt);
        }
      }

      await this.retryWait(attempt * 1_000);
    }

    throw new EmailDeliveryError(this.provider, maximumAttempts);
  }
}

export class SmtpEmailDelivery implements EmailDelivery {
  readonly provider = "smtp" as const;

  constructor(
    private readonly getTransporter: () => SmtpEmailTransport = getSmtpTransporter,
    private readonly retryWait: RetryWait = wait,
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
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
      } catch (error) {
        logFailure(this.provider, attempt, error);
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
  getResendClient?: () => ResendEmailClient;
  getSmtpTransporter?: () => SmtpEmailTransport;
}>;

export const createEmailDelivery = (
  provider: EmailProvider = emailConfig.provider,
  dependencies: EmailDeliveryDependencies = {},
): EmailDelivery =>
  provider === "console"
    ? new ConsoleEmailDelivery(dependencies.consolePreview)
    : provider === "resend"
      ? new ResendEmailDelivery(dependencies.getResendClient)
      : new SmtpEmailDelivery(dependencies.getSmtpTransporter);
