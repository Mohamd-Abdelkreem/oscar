import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppSubtreeLayout from "@/app/employee/(app)/layout";
import { AdminRouteBoundary } from "@/features/admin/components/common/admin-route-boundary";
import { WithdrawalsScreen } from "@/features/admin/components/withdrawals/withdrawals-screen";
import { apiClient } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import {
  cleanupQueries,
  deferred,
  employee,
  queryHarness,
} from "@/test/p04-query";
import {
  actorId,
  otherId,
  pagination,
  reply,
  wallet,
} from "@/test/p04-network";
import { withdrawal, withdrawalStatus } from "@/test/p09-withdrawals";
import { WithdrawalForm } from "./withdrawal-form";

const navigation = vi.hoisted(() => ({
  pathname: "/employee/withdraw",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
cleanupQueries();
beforeEach(() => {
  navigation.replace.mockClear();
});

describe("P09 protected route draft retention", () => {
  it.each(["employee", "EXTEND", "REJECT"] as const)(
    "conceals and preserves %s drafts through focus/online and transient checks, then retires on account switch and denial",
    async (kind) => {
      const role = kind === "employee" ? "USER" : "ADMIN";
      navigation.pathname =
        role === "USER" ? "/employee/withdraw" : "/admin/withdrawals";
      let sends = 0;
      const row = {
        ...withdrawal,
        employee: {
          id: actorId,
          fullName: "Current Employee",
          email: "current@example.test",
        },
        canExtend: true,
        canReject: true,
      };
      const h = queryHarness(role, (config) => {
        if (config.method === "post") sends++;
        if (config.url === "/wallet/me") return reply(config, wallet);
        if (config.url === "/withdrawals/me")
          return reply(config, withdrawalStatus);
        if (config.url === "/withdrawals/me/destination")
          return reply(config, withdrawalStatus.destination);
        if (config.url === "/admin/withdrawals")
          return reply(config, {
            items: [row],
            pagination: { ...pagination, limit: 10, total: 1, totalPages: 1 },
          });
        return reply(config, row);
      });
      const adapter = apiClient.defaults.adapter;
      if (typeof adapter !== "function")
        throw new Error("TEST_ADAPTER_MISSING");
      let held: ReturnType<typeof deferred<undefined>> | null = null;
      let unavailable = false;
      let denied = false;
      let currentActorId = actorId;
      apiClient.defaults.adapter = async (config) => {
        const user = {
          ...employee,
          id: currentActorId,
          role,
          referralCode: role === "ADMIN" ? null : employee.referralCode,
          status: denied
            ? role === "ADMIN"
              ? "DEACTIVATED"
              : "SUSPENDED"
            : "ACTIVE",
        };
        if (config.url === "/auth/refresh")
          return reply(config, {
            user,
            tokens: { accessToken: "test-only-refreshed-token" },
          });
        if (config.url !== "/users/me") return adapter(config);
        await held?.promise;
        if (unavailable) throw safeApiError("transient", "NETWORK_ERROR");
        return reply(config, {
          user,
        });
      };
      render(
        role === "USER" ? (
          <AppSubtreeLayout>
            <WithdrawalForm />
          </AppSubtreeLayout>
        ) : (
          <AdminRouteBoundary>
            <WithdrawalsScreen />
          </AdminRouteBoundary>
        ),
        { wrapper: h.wrapper },
      );
      const label =
        kind === "employee"
          ? "المبلغ المطلوب سحبه (USDT)"
          : kind === "EXTEND"
            ? /سبب زيادة الجدولة/u
            : /سبب رفض السحب/u;
      const draft =
        kind === "employee" ? "123.456789" : "Private retained reason";
      if (kind !== "employee") {
        fireEvent.click(
          await screen.findByRole("button", {
            name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
          }),
        );
        await screen.findByLabelText(label);
      }
      const field = await screen.findByLabelText(label);
      fireEvent.change(field, { target: { value: draft } });
      if (kind === "EXTEND")
        fireEvent.change(
          screen.getByLabelText(/الساعات الإضافية المراد زيادتها/u),
          { target: { value: "2.5" } },
        );
      held = deferred<undefined>();
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      await waitFor(() => {
        expect(field).not.toBeVisible();
      });
      held.resolve(undefined);
      held = null;
      await waitFor(
        () => {
          expect(screen.getByLabelText(label)).toBeVisible();
        },
        { timeout: 15000 },
      );
      expect(screen.getByLabelText(label)).toHaveValue(draft);
      if (kind === "EXTEND")
        expect(
          screen.getByLabelText(/الساعات الإضافية المراد زيادتها/u),
        ).toHaveValue("2.5");
      unavailable = true;
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      await screen.findByRole("button", { name: "إعادة المحاولة" });
      expect(field).not.toBeVisible();
      unavailable = false;
      fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
      await waitFor(
        () => {
          expect(screen.getByLabelText(label)).toBeVisible();
        },
        { timeout: 15000 },
      );
      expect(screen.getByLabelText(label)).toHaveValue(draft);
      expect(sends).toBe(0);
      currentActorId = otherId;
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      await waitFor(() => {
        expect(h.runtime.scope().accountId).toBe(otherId);
      });
      expect(screen.queryByDisplayValue(draft)).not.toBeInTheDocument();
      if (kind !== "employee")
        fireEvent.click(
          await screen.findByRole("button", {
            name: kind === "EXTEND" ? "زيادة الجدولة" : "رفض",
          }),
        );
      const newActorField = await screen.findByLabelText(label);
      expect(newActorField).toHaveValue(kind === "employee" ? "100" : "");
      fireEvent.change(newActorField, { target: { value: draft } });
      navigation.replace.mockClear();
      denied = true;
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalled();
      });
      expect(screen.queryByDisplayValue(draft)).not.toBeInTheDocument();
      expect(sends).toBe(0);
    },
    30000,
  );
});
