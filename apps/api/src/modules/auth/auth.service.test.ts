/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest types asymmetric expect.any matchers as any; the exact atomic-update assertions intentionally use them. */
import { describe, expect, it, vi } from "vitest";

import { UserStatus, type DatabaseClient } from "@template/database";

import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ForbiddenException } from "../../core/errors/forbidden.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import type { EmailService } from "../../infrastructure/email/email.service.js";
import { generateVerificationToken } from "../../infrastructure/security/index.js";
import { SAFE_USER_SELECT } from "../users/users.mapper.js";
import { AuthService } from "./auth.service.js";

describe("AuthService registration delivery", () => {
  it("rejects registration when verification email delivery fails", async () => {
    const deleteMany = vi
      .fn<(input: unknown) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 1 });
    const database = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
          email: "user@example.com",
          passwordHash: "not-returned",
          fullName: "Template User",
          phone: null,
          role: "USER",
          status: "PENDING_VERIFICATION",
          emailVerifiedAt: null,
          verificationTokenHash: "hash",
          verificationTokenExpiresAt: new Date(),
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        deleteMany,
      },
    } as unknown as DatabaseClient;
    const deliveryError = new Error("delivery unavailable");
    const emailService = {
      sendVerificationEmail: vi.fn().mockRejectedValue(deliveryError),
    } as unknown as EmailService;
    const service = new AuthService(database, emailService);

    const registration = service.register({
      fullName: "Template User",
      email: "user@example.com",
      phone: null,
      password: "a-secure-test-password",
    });
    await expect(registration).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(registration).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Registration is temporarily unavailable. Please try again.",
    });
    await expect(registration).rejects.not.toBe(deliveryError);
    expect(deleteMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
        status: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
      },
    });
    const cleanup = deleteMany.mock.calls[0]?.[0] as
      { where?: { verificationTokenHash?: unknown } } | undefined;
    expect(typeof cleanup?.where?.verificationTokenHash).toBe("string");
  });
});

type VerificationCandidate = Readonly<{
  id: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
}>;

const verificationCandidate: VerificationCandidate = {
  id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
  status: UserStatus.PENDING_VERIFICATION,
  emailVerifiedAt: null,
};

const activatedUser = {
  id: verificationCandidate.id,
  fullName: "Template User",
  email: "user@example.com",
  phone: null,
  role: "USER",
  status: UserStatus.ACTIVE,
  emailVerifiedAt: new Date("2026-08-18T00:00:00.000Z"),
  createdAt: new Date("2026-08-18T00:00:00.000Z"),
  updatedAt: new Date("2026-08-18T00:00:00.000Z"),
};

const createVerificationHarness = ({
  candidate = verificationCandidate,
  consumedCount = 1,
}: Readonly<{
  candidate?: VerificationCandidate;
  consumedCount?: number;
}> = {}) => {
  const findFirst = vi.fn().mockResolvedValue(candidate);
  const updateMany = vi.fn().mockResolvedValue({ count: consumedCount });
  const findUnique = vi.fn().mockResolvedValue(activatedUser);
  const transaction = { user: { findFirst, findUnique, updateMany } };
  const runTransaction = vi
    .fn<
      (
        callback: (value: typeof transaction) => Promise<unknown>,
      ) => Promise<unknown>
    >()
    .mockImplementation(async (callback) => callback(transaction));
  const database = {
    $transaction: runTransaction,
  } as unknown as DatabaseClient;
  const service = new AuthService(database, {} as EmailService);

  return { findFirst, findUnique, service, updateMany };
};

describe("AuthService email verification", () => {
  it("atomically consumes a pending verification token and returns a safe user", async () => {
    const token = generateVerificationToken(" User@Example.com ");
    const { findFirst, findUnique, service, updateMany } =
      createVerificationHarness();

    await expect(service.verifyEmail(token)).resolves.toMatchObject({
      user: {
        id: verificationCandidate.id,
        email: "user@example.com",
        status: UserStatus.ACTIVE,
      },
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        verificationTokenHash: expect.any(String),
        verificationTokenExpiresAt: { gt: expect.any(Date) },
      },
      select: {
        id: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: expect.any(String),
        email: expect.any(String),
        status: UserStatus.PENDING_VERIFICATION,
        emailVerifiedAt: null,
        verificationTokenHash: expect.any(String),
        verificationTokenExpiresAt: { gt: expect.any(Date) },
      },
      data: {
        status: UserStatus.ACTIVE,
        emailVerifiedAt: expect.any(Date),
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: verificationCandidate.id },
      select: SAFE_USER_SELECT,
    });
  });

  it("rejects an active candidate without attempting to consume the token", async () => {
    const token = generateVerificationToken("user@example.com");
    const { findUnique, service, updateMany } = createVerificationHarness({
      candidate: {
        ...verificationCandidate,
        status: UserStatus.ACTIVE,
      },
    });

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a candidate that is already verified", async () => {
    const token = generateVerificationToken("user@example.com");
    const { findUnique, service, updateMany } = createVerificationHarness({
      candidate: {
        ...verificationCandidate,
        emailVerifiedAt: new Date(),
      },
    });

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a suspended candidate without changing its status", async () => {
    const token = generateVerificationToken("user@example.com");
    const { findUnique, service, updateMany } = createVerificationHarness({
      candidate: {
        ...verificationCandidate,
        status: UserStatus.SUSPENDED,
      },
    });

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(updateMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a token that loses the atomic consumption race", async () => {
    const token = generateVerificationToken("user@example.com");
    const { findUnique, service, updateMany } = createVerificationHarness({
      consumedCount: 0,
    });

    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(updateMany).toHaveBeenCalledOnce();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
