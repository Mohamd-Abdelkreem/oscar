import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { cookieConfig } from "../../core/config/cookie.config.js";
import { InternalServerError } from "../../core/errors/internal-server.error.js";
import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";

const user = {
  id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
  fullName: "Template User",
  email: "user@example.com",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: "2026-08-18T00:00:00.000Z",
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
} as const;

const responseMock = () => {
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

const loginRequest = {
  path: "/auth/login",
  requestId: "request-id",
  validated: {
    body: {
      email: "user@example.com",
      password: "a-secure-test-password",
      rememberMe: false,
    },
  },
} as unknown as Request;

describe("AuthController cookie options", () => {
  it.each(["logout", "logoutAll", "changePassword"] as const)(
    "%s rejects missing internal session context without clearing cookies or returning success",
    async (method) => {
      const controller = new AuthController({} as AuthService);
      const response = responseMock();
      await expect(
        controller[method](
          { user, path: "/auth/action", validated: { body: {} } } as Request,
          response as unknown as Response,
        ),
      ).rejects.toBeInstanceOf(InternalServerError);
      expect(response.clearCookie).not.toHaveBeenCalled();
      expect(response.json).not.toHaveBeenCalled();
    },
  );

  it("does not acknowledge or clear cookies while revocation is uncommitted or fails", async () => {
    let fail = (_failure: Error) => {};
    const pending = new Promise<void>((_resolve, reject) => {
      fail = reject;
    });
    const controller = new AuthController({
      logout: () => pending,
    } as unknown as AuthService);
    const response = responseMock();
    const completion = controller.logout(
      {
        user,
        authSession: {
          userId: user.id,
          sessionId: "6e61e019-6895-4e57-bfbd-e376502a7aa0",
        },
      } as Request,
      response as unknown as Response,
    );
    expect(response.clearCookie).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
    const failure = new Error("test-only-transaction-failure");
    fail(failure);
    await expect(completion).rejects.toBe(failure);
    expect(response.clearCookie).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "sets exact refresh and CSRF options for rememberMe=%s",
    async (rememberMe) => {
      const authService = {
        login: vi.fn().mockResolvedValue({
          user,
          tokens: { accessToken: "access", refreshToken: "refresh" },
          rememberMe,
        }),
      } as unknown as AuthService;
      const controller = new AuthController(authService);
      const response = responseMock();
      await controller.login(
        {
          ...loginRequest,
          validated: {
            body: {
              ...(loginRequest.validated?.body as object),
              rememberMe,
            },
          },
        } as Request,
        response as unknown as Response,
      );

      const lifetime = rememberMe
        ? { maxAge: cookieConfig.refreshMaxAgeSeconds * 1_000 }
        : {};
      expect(response.cookie).toHaveBeenNthCalledWith(
        1,
        "refreshToken",
        "refresh",
        {
          httpOnly: true,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
          path: cookieConfig.refreshPath,
          ...lifetime,
        },
      );
      expect(response.cookie).toHaveBeenNthCalledWith(
        2,
        "csrfToken",
        expect.any(String),
        {
          httpOnly: false,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
          path: "/",
          ...lifetime,
        },
      );
      expect(response.cookie.mock.calls[1]?.[1]).toMatch(/^[a-f0-9]{64}$/u);
    },
  );

  it("clears both cookies with matching security and path attributes", async () => {
    const authService = {
      logout: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const response = responseMock();
    await controller.logout(
      {
        path: "/auth/logout",
        requestId: "request-id",
        user,
        authSession: {
          userId: user.id,
          sessionId: "6e61e019-6895-4e57-bfbd-e376502a7aa0",
        },
        cookies: { refreshToken: "refresh" },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(1, "refreshToken", {
      path: cookieConfig.refreshPath,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
    expect(response.clearCookie).toHaveBeenNthCalledWith(2, "csrfToken", {
      path: "/",
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
  });
});
