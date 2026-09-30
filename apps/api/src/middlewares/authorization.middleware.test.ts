import { UserRole } from "@template/database";
import { describe, expect, it, vi } from "vitest";

import { ForbiddenException } from "../core/errors/forbidden.error.js";
import { UnauthorizedException } from "../core/errors/unauthorized.error.js";
import { authorizeRoles } from "./authorization.middleware.js";

const response = {} as never;

describe("authorizeRoles", () => {
  it("rejects a missing authenticated user", () => {
    const middleware = authorizeRoles(UserRole.ADMIN);
    expect(() => {
      middleware({} as never, response, vi.fn());
    }).toThrow(UnauthorizedException);
  });

  it("rejects a user outside the allowlist", () => {
    const middleware = authorizeRoles(UserRole.ADMIN);
    expect(() => {
      middleware({ user: { role: UserRole.USER } } as never, response, vi.fn());
    }).toThrow(ForbiddenException);
  });

  it("continues for an allowed generic role", () => {
    const next = vi.fn();
    authorizeRoles(UserRole.ADMIN)(
      { user: { role: UserRole.ADMIN } } as never,
      response,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
