import type { AuthUserData, SafeUser } from "@template/contracts";
import { describe, expect, it } from "vitest";

import { resolveGuestOnlyRouteState } from "./guest-only-route";
import { resolveProtectedRouteState } from "./protected-route";
import { isPublicAdminPath } from "@/features/admin/components/common/admin-route-boundary";

const user = (overrides: Partial<SafeUser> = {}): AuthUserData => ({
  user: {
    id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
    fullName: "Template User",
    email: "user@example.com",
    phone: null,
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: "2026-08-18T00:00:00.000Z",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  },
});

const settled = {
  isPending: false,
  isFetched: true,
  isError: false,
  isFetching: false,
};

describe("pure route states", () => {
  it.each([
    ["/admin/auth/login", true],
    ["/admin/auth/accept-invitation", true],
    ["/admin/auth/login/extra", false],
    ["/admin/auth/unknown", false],
    ["/admin", false],
    ["/admin/settings/admins", false],
  ])("exact public administrator allowlist: %s", (pathname, permitted) => {
    expect(isPublicAdminPath(pathname)).toBe(permitted);
  });
  it("blocks cached authority during checks and sends wrong roles to their audience", () => {
    expect(
      resolveProtectedRouteState(
        { ...settled, isFetching: true },
        user(),
        "/employee",
        ["USER"],
      ).kind,
    ).toBe("pending");
    expect(
      resolveProtectedRouteState(
        { ...settled, isError: true },
        user(),
        "/employee",
        ["USER"],
      ).kind,
    ).toBe("error");
    expect(
      resolveProtectedRouteState(
        settled,
        user({ role: "ADMIN" }),
        "/employee",
        ["USER"],
      ),
    ).toEqual({ kind: "redirecting", target: "/admin" });
    expect(
      resolveProtectedRouteState(settled, null, "/employee/account", ["USER"]),
    ).toEqual({
      kind: "redirecting",
      target: "/employee/auth/login?returnTo=%2Femployee%2Faccount",
    });
  });
  it("keeps pending and unexpected failures distinct", () => {
    expect(
      resolveProtectedRouteState(
        { ...settled, isPending: true },
        null,
        "/dashboard",
        undefined,
      ).kind,
    ).toBe("pending");
    expect(
      resolveGuestOnlyRouteState({ ...settled, isError: true }, null).kind,
    ).toBe("error");
  });

  it("redirects anonymous users with only a safe return path", () => {
    expect(
      resolveProtectedRouteState(
        settled,
        null,
        "/settings?section=profile",
        undefined,
      ),
    ).toEqual({
      kind: "redirecting",
      target: "/auth/login?returnTo=%2Fsettings%3Fsection%3Dprofile",
    });
    expect(
      resolveProtectedRouteState(
        settled,
        null,
        "/settings?token=secret",
        undefined,
      ),
    ).toEqual({ kind: "redirecting", target: "/auth/login" });
  });

  it("requires active verified accounts and the requested generic role", () => {
    expect(
      resolveProtectedRouteState(
        settled,
        user({ status: "SUSPENDED" }),
        "/dashboard",
        undefined,
      ),
    ).toEqual({ kind: "redirecting", target: "/auth/login" });
    expect(
      resolveProtectedRouteState(settled, user(), "/dashboard", ["ADMIN"]),
    ).toEqual({ kind: "redirecting", target: "/employee" });
    expect(
      resolveProtectedRouteState(
        settled,
        user({ role: "ADMIN" }),
        "/dashboard",
        ["ADMIN"],
      ).kind,
    ).toBe("authorized");
  });

  it("allows guests and redirects a valid authenticated account", () => {
    expect(resolveGuestOnlyRouteState(settled, null).kind).toBe("authorized");
    expect(resolveGuestOnlyRouteState(settled, user())).toEqual({
      kind: "redirecting",
      target: "/employee",
    });
  });
});
