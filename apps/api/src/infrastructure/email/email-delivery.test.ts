import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResendEmailClient } from "../../core/config/resend.config.js";
import { logger } from "../logger/logger.js";
import {
  ConsoleEmailDelivery,
  createEmailDelivery,
  createFileConsolePreview,
  EmailDeliveryError,
  findWorkspaceRoot,
  ResendEmailDelivery,
  SmtpEmailDelivery,
  type SmtpEmailTransport,
} from "./email-delivery.js";

const localPreviewUrl =
  "http://localhost:3000/auth/verify-email?token=local-verification-token";
const request = {
  from: "Template <no-reply@example.com>",
  to: "user@example.com",
  subject: "Local preview",
  html: `<!doctype html><html><body><p>Preview body</p><a href="${localPreviewUrl}">Verify email</a></body></html>`,
  localPreviewUrl,
};

const noWait = (): Promise<void> => Promise.resolve();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsoleEmailDelivery", () => {
  it("captures a local preview without constructing a network client", async () => {
    const preview = vi.fn();
    const delivery = new ConsoleEmailDelivery(preview);
    const result = await delivery.send(request);
    expect(result.providerMessageId).toMatch(/^console\//u);
    expect(preview).toHaveBeenCalledOnce();
    expect(preview).toHaveBeenCalledWith(request);
  });

  it("is selected through injectable delivery dependencies", async () => {
    const preview = vi.fn();
    const resendClient = vi.fn();
    const smtpTransporter = vi.fn();
    const delivery = createEmailDelivery("console", {
      consolePreview: preview,
      getResendClient: resendClient,
      getSmtpTransporter: smtpTransporter,
    });
    await delivery.send(request);
    expect(preview).toHaveBeenCalledOnce();
    expect(resendClient).not.toHaveBeenCalled();
    expect(smtpTransporter).not.toHaveBeenCalled();
  });

  it("discovers the pnpm workspace root from a nested API directory", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "template-workspace-"));
    const nestedDirectory = join(workspaceRoot, "apps", "api");
    try {
      await mkdir(nestedDirectory, { recursive: true });
      await writeFile(
        join(workspaceRoot, "pnpm-workspace.yaml"),
        "packages:\n  - apps/*\n",
      );

      await expect(findWorkspaceRoot(nestedDirectory)).resolves.toBe(
        workspaceRoot,
      );
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("rejects workspace discovery when no pnpm marker exists", async () => {
    const isolatedTemporaryRoot = join(parse(tmpdir()).root, "tmp");
    await mkdir(isolatedTemporaryRoot, { recursive: true });
    const markerlessRoot = await mkdtemp(
      join(isolatedTemporaryRoot, "template-markerless-"),
    );
    const nestedDirectory = join(markerlessRoot, "apps", "api");
    try {
      await mkdir(nestedDirectory, { recursive: true });

      await expect(findWorkspaceRoot(nestedDirectory)).rejects.toThrow(
        "Could not locate the pnpm workspace root.",
      );
    } finally {
      await rm(markerlessRoot, { recursive: true, force: true });
    }
  });

  it("writes unique complete HTML previews at the real workspace root without logging secrets", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "template-workspace-"));
    const nestedDirectory = join(workspaceRoot, "apps", "api");
    const previewDirectory = join(workspaceRoot, ".local-emails");
    const originalWorkingDirectory = process.cwd();
    const infoLog = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    try {
      await mkdir(nestedDirectory, { recursive: true });
      await writeFile(
        join(workspaceRoot, "pnpm-workspace.yaml"),
        "packages:\n  - apps/*\n",
      );
      process.chdir(nestedDirectory);
      const delivery = new ConsoleEmailDelivery(createFileConsolePreview());

      await delivery.send(request);
      await delivery.send(request);

      const files = await readdir(previewDirectory);
      expect(files).toHaveLength(2);
      expect(new Set(files).size).toBe(2);
      for (const file of files) {
        expect(file).toMatch(/\.html$/u);
        expect(file).not.toContain("local-verification-token");
        expect(file).not.toContain("user@example.com");
        const contents = await readFile(join(previewDirectory, file), "utf8");
        expect(contents).toBe(request.html);
        expect(contents).toContain(localPreviewUrl);
      }

      expect(infoLog).toHaveBeenCalledTimes(2);
      for (const file of files) {
        expect(infoLog).toHaveBeenCalledWith(
          expect.objectContaining({
            previewPath: join(previewDirectory, file),
          }),
          "Email captured by the local console provider.",
        );
      }
      const serializedLogs = JSON.stringify(infoLog.mock.calls);
      expect(serializedLogs).not.toContain("local-verification-token");
      expect(serializedLogs).not.toContain(localPreviewUrl);
      expect(serializedLogs).not.toContain(request.to);
      expect(serializedLogs).not.toContain(request.html);
    } finally {
      process.chdir(originalWorkingDirectory);
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("normalizes local preview failures without exposing their messages", async () => {
    const rawMessage = "preview failure containing local-verification-token";
    const errorLog = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const delivery = new ConsoleEmailDelivery(() => {
      throw new Error(rawMessage);
    });

    await expect(delivery.send(request)).rejects.toEqual(
      expect.objectContaining({
        name: "EmailDeliveryError",
        message: "console email delivery failed after 1 attempt(s).",
      }),
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
  });
});

describe("provider failure logging", () => {
  it("omits raw Resend error messages", async () => {
    const rawMessage = "provider detail containing re_secret_fixture";
    const errorLog = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const send = vi.fn<ResendEmailClient["send"]>().mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        message: rawMessage,
      },
      headers: null,
    });
    const delivery = new ResendEmailDelivery(
      () => ({ send }),
      noWait,
      () => "template-email/test",
    );

    await expect(delivery.send(request)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        errorName: "validation_error",
        errorStatusCode: 422,
      }),
      "Email send attempt failed.",
    );
  });

  it("omits raw SMTP exception messages", async () => {
    const rawMessage = "SMTP rejected password fixture-secret";
    const errorLog = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const sendMail = vi
      .fn<SmtpEmailTransport["sendMail"]>()
      .mockRejectedValue(new Error(rawMessage));
    const delivery = new SmtpEmailDelivery(() => ({ sendMail }), noWait);

    await expect(delivery.send(request)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
    expect(errorLog).toHaveBeenCalledTimes(3);
  });
});
