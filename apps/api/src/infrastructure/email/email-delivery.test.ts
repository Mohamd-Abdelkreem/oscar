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

describe("bounded Resend HTTP dispatch", () => {
  it("rejects protected proof previews before writing or exposing the credential", async () => {
    const directory = await mkdtemp(join(tmpdir(), "withdrawal-preview-"));
    const preview = vi.fn();
    const protectedMail = {
      ...request,
      retainLocalPreview: false as const,
      html: "private-proof-sentinel",
    };
    try {
      await expect(
        new ConsoleEmailDelivery(preview).send(protectedMail),
      ).rejects.toMatchObject({ disposition: "REJECTED", attempts: 0 });
      expect(preview).not.toHaveBeenCalled();
      await expect(
        createFileConsolePreview(directory)(protectedMail),
      ).rejects.toMatchObject({ disposition: "REJECTED" });
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it.each([429, 500, 502, 503, 504])(
    "exhausts retryable status %i within three attempts without private response diagnostics",
    async (status) => {
      const sentinel = "sentinel-private-provider-response";
      let attempts = 0;
      const delivery = new ResendEmailDelivery({
        apiKey: sentinel,
        wait: noWait,
        fetch: () => {
          attempts += 1;
          return Promise.resolve(
            new Response(sentinel, {
              status,
              headers: { "Retry-After": "86400" },
            }),
          );
        },
      });
      let failure: unknown;
      try {
        await delivery.send({ ...request, html: sentinel });
      } catch (caught) {
        failure = caught;
      }
      expect(failure).toMatchObject({
        attempts: 3,
        disposition: status === 429 ? "REJECTED" : "UNKNOWN",
        code: status === 429 ? "RATE_LIMIT" : "PROVIDER_UNAVAILABLE",
      });
      expect(attempts).toBe(3);
      expect(String(failure)).not.toContain(sentinel);
      expect(JSON.stringify(failure)).not.toContain(sentinel);
    },
  );
  it("does not dispatch an invitation known closed before any attempt", async () => {
    let attempts = 0;
    const delivery = new ResendEmailDelivery({
      apiKey: "sentinel-test-only",
      wait: noWait,
      fetch: () => {
        attempts += 1;
        return Promise.resolve(new Response("private", { status: 503 }));
      },
    });
    await expect(
      delivery.send({
        ...request,
        assertCanDispatch: () => Promise.reject(new Error("closed generation")),
      }),
    ).rejects.toThrow("closed generation");
    expect(attempts).toBe(0);
  });
  const providerId = "11111111-1111-4111-8111-111111111111";
  it("uses the fixed origin, no redirects and identical payload/key across approved retries", async () => {
    const requests: { url: string; options: RequestInit | undefined }[] = [];
    const delays: number[] = [];
    const delivery = new ResendEmailDelivery({
      fetch: (url, options) => {
        requests.push({
          url:
            typeof url === "string"
              ? url
              : url instanceof URL
                ? url.toString()
                : url.url,
          options,
        });
        return Promise.resolve(
          requests.length < 3
            ? new Response("private", {
                status: requests.length === 1 ? 429 : 503,
              })
            : Response.json({ id: providerId }),
        );
      },
      apiKey: "sentinel-provider-key",
      idempotencyKey: () => "identity-attempt/test",
      wait: (delay) => {
        delays.push(delay);
        return Promise.resolve();
      },
    });
    expect(
      await delivery.send({ ...request, replyTo: "support@example.com" }),
    ).toEqual({ providerMessageId: providerId });
    expect(delays).toEqual([100, 250]);
    expect(new Set(requests.map(({ url }) => url))).toEqual(
      new Set(["https://api.resend.com/emails"]),
    );
    expect(new Set(requests.map(({ options }) => options?.body)).size).toBe(1);
    for (const { options } of requests) {
      expect(options?.redirect).toBe("error");
      expect(options?.headers).toMatchObject({
        "Idempotency-Key": "identity-attempt/test",
      });
      expect(
        JSON.parse(typeof options?.body === "string" ? options.body : ""),
      ).toMatchObject({ reply_to: "support@example.com" });
      expect(options?.body).not.toContain("localPreviewUrl");
    }
  });
  it.each([302, 408, 409, 422])(
    "stops on nonretryable status %i with truthful uncertainty",
    async (status) => {
      const fetchBoundary = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("private", { status }));
      const delivery = new ResendEmailDelivery({
        fetch: fetchBoundary,
        wait: noWait,
        apiKey: "sentinel",
      });
      await expect(delivery.send(request)).rejects.toMatchObject({
        disposition: status === 422 ? "REJECTED" : "UNKNOWN",
        attempts: 1,
      });
      expect(fetchBoundary).toHaveBeenCalledOnce();
    },
  );
  it.each([
    "{",
    JSON.stringify({ id: "private-provider-value" }),
    "x".repeat(65537),
  ])(
    "rejects malformed, invalid-ID and oversized success without exposing bodies",
    async (body) => {
      const fetchBoundary = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body));
      await expect(
        new ResendEmailDelivery({
          fetch: fetchBoundary,
          wait: noWait,
          apiKey: "sentinel",
        }).send(request),
      ).rejects.toMatchObject({ disposition: "UNKNOWN", attempts: 1 });
      expect(fetchBoundary).toHaveBeenCalledOnce();
    },
  );
  it("keeps uncertainty after a later definite rejection", async () => {
    const fetchBoundary = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("private-network-failure"))
      .mockResolvedValueOnce(new Response("private", { status: 422 }));
    await expect(
      new ResendEmailDelivery({
        fetch: fetchBoundary,
        wait: noWait,
        apiKey: "sentinel",
      }).send(request),
    ).rejects.toMatchObject({
      disposition: "UNKNOWN",
      code: "PROVIDER_REJECTED",
      attempts: 2,
    });
  });
  it("bounds body consumption after response headers and retries the same safe attempt", async () => {
    const controller = new AbortController();
    let attempts = 0;
    const delivery = new ResendEmailDelivery({
      fetch: () => {
        attempts += 1;
        const body = new ReadableStream<Uint8Array>({
          start: () => {
            queueMicrotask(() => {
              controller.abort(
                new DOMException("private-timeout", "TimeoutError"),
              );
            });
          },
        });
        return Promise.resolve(new Response(body));
      },
      timeoutSignal: () => controller.signal,
      wait: noWait,
      apiKey: "sentinel",
    });
    await expect(delivery.send(request)).rejects.toMatchObject({
      disposition: "UNKNOWN",
      code: "TIMEOUT",
      attempts: 3,
    });
    expect(attempts).toBe(3);
  });
  it("rechecks generation before each retry and preserves unknown dispatch on closure", async () => {
    const fetchBoundary = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("private", { status: 503 }));
    let checks = 0;
    await expect(
      new ResendEmailDelivery({
        fetch: fetchBoundary,
        wait: noWait,
        apiKey: "sentinel",
      }).send({
        ...request,
        assertCanDispatch: () => {
          checks += 1;
          return checks === 2
            ? Promise.reject(new Error("closed-intent"))
            : Promise.resolve();
        },
      }),
    ).rejects.toMatchObject({ disposition: "UNKNOWN", attempts: 1 });
    expect(fetchBoundary).toHaveBeenCalledOnce();
  });
});

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
      resendFetch: resendClient,
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
    const delivery = new ResendEmailDelivery({
      fetch: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ name: rawMessage, message: rawMessage }),
            { status: 422 },
          ),
        ),
      wait: noWait,
      apiKey: "sentinel-provider-credential",
    });

    await expect(delivery.send(request)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "PROVIDER_REJECTED",
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
