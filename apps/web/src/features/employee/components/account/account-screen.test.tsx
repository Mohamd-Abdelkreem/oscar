import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  identityUserSchema,
  withdrawalDestinationSchema,
} from "@template/contracts";
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  apiClient,
  clearAccessToken,
  setAccessToken,
} from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { EmployeeAccountScreen } from "./account-screen";
import { WithdrawalDestinationBoundary } from "../withdraw/withdrawal-destination-boundary";
import {
  destination,
  pendingDestination,
  withdrawalStatus,
} from "@/test/p09-withdrawals";
import {
  wallet as persistedWallet,
  membership as persistedMembership,
  purchase,
} from "@/test/p04-network";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
  usePathname: () => "/employee/account",
}));

const employee = (suffix = "1") =>
  identityUserSchema.parse({
    id: `00000000-0000-4000-8000-00000000000${suffix}`,
    fullName: `الموظف ${suffix}`,
    email: `employee${suffix}@example.test`,
    phone: null,
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    referralCode: "a".repeat(32),
    tasksBlocked: false,
    withdrawalsBlocked: false,
    accountVersion: 0,
  });
const originalAdapter = apiClient.defaults.adapter;
let client: QueryClient;
const reply = (
  config: InternalAxiosRequestConfig,
  data: unknown,
): AxiosResponse<unknown> => ({
  config,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  data: {
    success: true,
    statusCode: 200,
    message: "OK",
    requestId: "test",
    timestamp: "2026-10-01T00:00:00.000Z",
    path: config.url,
    data,
  },
});
beforeEach(() => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => callback(),
    },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  setAccessToken("account-test-token");
});
afterEach(async () => {
  cleanup();
  await client.cancelQueries();
  if (originalAdapter === undefined) delete apiClient.defaults.adapter;
  else apiClient.defaults.adapter = originalAdapter;
  client.clear();
  getSessionRuntime().dispose();
  clearAccessToken();
  localStorage.clear();
  history.replaceState(null, "", "/");
});
const open = () =>
  render(
    <QueryClientProvider client={client}>
      <EmployeeAccountScreen />
    </QueryClientProvider>,
  );
const passwordButton = () =>
  screen.getByRole("button", { name: /تغيير كلمة المرور/u });

it("the account retains accepted financial terms and exact work dates independently of catalog changes", async () => {
  const { stateAtPurchase: _, ...saved } = purchase.subscriptionAtPurchase;
  apiClient.defaults.adapter = (config) =>
    Promise.resolve(
      reply(
        config,
        config.url === "/users/me"
          ? { user: employee() }
          : config.url === "/wallet/me"
            ? persistedWallet
            : {
                ...persistedMembership,
                effective: "PAID",
                subscription: { ...saved, state: "CURRENT" },
              },
      ),
    );
  open();
  const accepted = await screen.findByLabelText("شروط الاشتراك المحفوظة");
  expect(accepted).toHaveTextContent("60.00");
  expect(accepted).toHaveTextContent("730.00");
  expect(accepted).toHaveTextContent(saved.firstWorkDate);
  expect(accepted).toHaveTextContent(saved.finalWorkDate);
  expect(accepted).toHaveTextContent(saved.expiresAt);
  expect(accepted).toHaveTextContent("21%");
  expect(accepted).toHaveTextContent("قبل تكلفة الباقة ورسوم السحب");
  expect(passwordButton()).toBeEnabled();
});

it("displays only current A then B read-only identity and leaves later domains unavailable", async () => {
  let current = employee();
  const requests: string[] = [];
  apiClient.defaults.adapter = (config) => {
    requests.push(config.url ?? "");
    return Promise.resolve(reply(config, { user: current }));
  };
  open();
  await screen.findByText(current.email);
  expect(screen.getByRole("heading", { name: current.fullName })).toBeVisible();
  expect(screen.getAllByText("غير متاح حالياً")).toHaveLength(3);
  expect(
    screen.getByRole("button", { name: "نسخ عنوان السحب" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "طلب تغيير العنوان" }),
  ).toBeDisabled();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByText(/USDT|Free|المجاني/u)).toBeNull();
  expect(
    screen.getByRole("link", { name: "المحفظة وسجل المعاملات" }),
  ).toHaveAttribute("href", "/employee/wallet");
  fireEvent.click(passwordButton());
  expect(screen.getByRole("dialog")).toBeVisible();
  const old = current;
  act(() => {
    getSessionRuntime().retire();
    current = employee("2");
    setAccessToken("account-b-test-token");
  });
  await screen.findByText(current.email);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText(old.email)).toBeNull();
  expect(screen.queryByRole("heading", { name: old.fullName })).toBeNull();
  expect(
    requests.every((path) =>
      [
        "/users/me",
        "/subscriptions/me",
        "/wallet/me",
        "/withdrawals/me",
        "/withdrawals/me/destination",
      ].includes(path),
    ),
  ).toBe(true);
});

it.each([false, true])(
  "reviews inline and resolves confirmation with delayed precommit reply loss=%s without replay",
  async (lost) => {
    let consumed = false,
      writes = 0;
    history.replaceState(
      null,
      "",
      `/employee/account#withdrawal-confirmation=${"a".repeat(43)}`,
    );
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        if (config.url === "/users/me")
          return reply(config, { user: employee() });
        if (config.url === "/wallet/me") return reply(config, persistedWallet);
        if (config.url === "/subscriptions/me")
          return reply(config, persistedMembership);
        if (config.method === "post") {
          writes++;
          if (lost) throw new AxiosError("lost", "ERR_NETWORK", config);
          consumed = true;
        }
        const saved = consumed ? destination : pendingDestination;
        return reply(
          config,
          config.url === "/withdrawals/me"
            ? { ...withdrawalStatus, destination: saved }
            : saved,
        );
      });
    render(
      <QueryClientProvider client={client}>
        <WithdrawalDestinationBoundary>
          <EmployeeAccountScreen />
        </WithdrawalDestinationBoundary>
      </QueryClientProvider>,
    );
    const confirm = await screen.findByRole("button", {
      name: "تأكيد عنوان السحب",
    });
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    expect(location.hash).toBe("");
    expect(writes).toBe(0);
    expect(screen.getByText(/عنوان بانتظار تأكيد البريد/u)).toHaveTextContent(
      destination.address,
    );
    fireEvent.click(confirm);
    if (lost) {
      await screen.findByText(/نتيجة التأكيد غير مؤكدة/u);
      expect(screen.queryByText(/افتح أحدث رابط بريد/u)).toBeNull();
      consumed = true;
    }
    await screen.findByText("تم تأكيد عنوان السحب.", {}, { timeout: 15_000 });
    expect(screen.queryByText(/افتح أحدث رابط بريد/u)).toBeNull();
    expect(screen.queryByText(/نتيجة التأكيد غير مؤكدة/u)).toBeNull();
    expect(writes).toBe(1);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: "طلب تغيير العنوان" }),
    ).toBeDisabled();
  },
  20_000,
);

it.each(["expired", "superseded"] as const)(
  "replaces uncertain confirmation with latest-link guidance after later %s proof evidence",
  async (disposition) => {
    const proof = "a".repeat(43);
    let saved = withdrawalDestinationSchema.parse(pendingDestination);
    let writes = 0;
    history.replaceState(
      null,
      "",
      `/employee/account#withdrawal-confirmation=${proof}`,
    );
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        if (config.url === "/users/me")
          return reply(config, { user: employee() });
        if (config.url === "/wallet/me") return reply(config, persistedWallet);
        if (config.url === "/subscriptions/me")
          return reply(config, persistedMembership);
        if (config.method === "post") {
          writes++;
          throw new AxiosError("lost", "ERR_NETWORK", config);
        }
        return reply(
          config,
          config.url === "/withdrawals/me"
            ? { ...withdrawalStatus, destination: saved }
            : saved,
        );
      });
    render(
      <QueryClientProvider client={client}>
        <WithdrawalDestinationBoundary>
          <EmployeeAccountScreen />
        </WithdrawalDestinationBoundary>
      </QueryClientProvider>,
    );
    const confirm = await screen.findByRole("button", {
      name: "تأكيد عنوان السحب",
    });
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    fireEvent.click(confirm);
    await screen.findByText(/نتيجة التأكيد غير مؤكدة/u);
    saved = withdrawalDestinationSchema.parse({
      ...pendingDestination,
      ...(disposition === "expired"
        ? { proofStatus: "EXPIRED", serverNow: pendingDestination.expiresAt }
        : { version: pendingDestination.version + 1 }),
    });
    fireEvent.click(
      screen.getByRole("button", { name: "إعادة التحقق من التأكيد" }),
    );
    await screen.findByText(/افتح أحدث رابط بريد/u);
    expect(screen.queryByText(/نتيجة التأكيد غير مؤكدة/u)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "إعادة التحقق من التأكيد" }),
    ).toBeNull();
    expect(screen.queryByText("تم تأكيد عنوان السحب.")).toBeNull();
    expect(writes).toBe(1);
    expect(saved.state).toBe("PENDING");
    expect(location.hash).toBe("");
    expect(JSON.stringify(localStorage)).not.toContain(proof);
    expect(JSON.stringify(sessionStorage)).not.toContain(proof);
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state),
      ),
    ).not.toContain(proof);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  },
);

it("waits for identity, exposes safe failed-read retry and never supplies a fixture", async () => {
  let complete!: (response: AxiosResponse<unknown>) => void;
  let request!: InternalAxiosRequestConfig;
  apiClient.defaults.adapter = (config) => {
    request = config;
    return new Promise((resolve) => {
      complete = resolve;
    });
  };
  open();
  expect(screen.getByText("جارٍ التحقق من بيانات الحساب…")).toHaveAttribute(
    "role",
    "status",
  );
  expect(passwordButton()).toBeDisabled();
  await waitFor(() => {
    expect(complete).toBeDefined();
  });
  act(() => {
    complete(
      reply(request, {
        user: { ...employee(), passwordHash: "PRIVATE_SENTINEL" },
      }),
    );
  });
  await screen.findByRole("alert");
  expect(screen.queryByText(employee().email)).toBeNull();
  expect(document.body).not.toHaveTextContent("PRIVATE_SENTINEL");
  expect(passwordButton()).toBeDisabled();
  apiClient.defaults.adapter = (config) =>
    Promise.resolve(reply(config, { user: employee() }));
  fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
  await screen.findByText(employee().email);
  expect(passwordButton()).toBeEnabled();
});

it.each(["denied", "wrong-role", "inactive"])(
  "blocks account commands and identity for %s authority",
  async (state) => {
    apiClient.defaults.adapter = (config) => {
      if (state === "denied")
        return Promise.reject(
          new AxiosError("denied", "ERR_BAD_REQUEST", config, undefined, {
            ...reply(config, {}),
            status: 401,
            data: {
              success: false,
              statusCode: 401,
              code: "UNAUTHORIZED",
              message: "denied",
              requestId: "test",
              timestamp: employee().createdAt,
              path: config.url,
            },
          }),
        );
      const user =
        state === "wrong-role"
          ? { ...employee(), role: "ADMIN", referralCode: null }
          : { ...employee(), status: "SUSPENDED" };
      return Promise.resolve(reply(config, { user }));
    };
    open();
    await screen.findByRole("alert");
    expect(screen.queryByText(employee().email)).toBeNull();
    expect(passwordButton()).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "تسجيل الخروج من الحساب" }),
    ).toBeDisabled();
    fireEvent.click(passwordButton());
    expect(screen.queryByRole("dialog")).toBeNull();
  },
);

it("opens the real password dialog and ends the server session through the shared logout lifecycle", async () => {
  const writes: string[] = [];
  apiClient.defaults.adapter = (config) => {
    if (config.method === "post") writes.push(config.url ?? "");
    return Promise.resolve(
      reply(config, config.url === "/auth/logout" ? {} : { user: employee() }),
    );
  };
  open();
  await screen.findByText(employee().email);
  fireEvent.click(passwordButton());
  expect(
    screen.getByRole("dialog", { name: "تغيير كلمة المرور" }),
  ).toBeVisible();
  expect(screen.getByLabelText("كلمة المرور الحالية")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "إغلاق النافذة" }));
  fireEvent.click(
    screen.getByRole("button", { name: "تسجيل الخروج من الحساب" }),
  );
  await waitFor(() => {
    expect(writes).toEqual(["/auth/logout"]);
  });
  await waitFor(() => {
    expect(screen.queryByText(employee().email)).toBeNull();
  });
  expect(client.getMutationCache().getAll()).toEqual([]);
});

it("blocks duplicate logout while pending and displays uncertainty without restoring private identity", async () => {
  let loseResponse!: () => void;
  let logoutWrites = 0;
  apiClient.defaults.adapter = (config) => {
    if (config.url !== "/auth/logout")
      return Promise.resolve(reply(config, { user: employee() }));
    logoutWrites++;
    return new Promise((_resolve, reject) => {
      loseResponse = () => {
        reject(new AxiosError("network loss", "ERR_NETWORK", config));
      };
    });
  };
  open();
  await screen.findByText(employee().email);
  const logout = screen.getByRole("button", { name: "تسجيل الخروج من الحساب" });
  fireEvent.click(logout);
  await waitFor(() => {
    expect(logoutWrites).toBe(1);
  });
  expect(logout).toBeDisabled();
  fireEvent.click(logout);
  act(() => {
    loseResponse();
  });
  await waitFor(() => {
    expect(screen.getByText(/ملف متصفح منفصلاً/u)).toBeVisible();
  });
  expect(logoutWrites).toBe(1);
  expect(screen.queryByText(employee().email)).toBeNull();
  expect(passwordButton()).toBeDisabled();
  expect(logout).toBeDisabled();
});

it("shows persisted purchase-eligible balance while preserving current identity and password controls", async () => {
  apiClient.defaults.adapter = (config) =>
    Promise.resolve(
      reply(
        config,
        config.url === "/users/me"
          ? { user: employee() }
          : config.url === "/wallet/me"
            ? persistedWallet
            : persistedMembership,
      ),
    );
  open();
  await screen.findByText("40.00", { exact: true });
  expect(screen.getByText(employee().email)).toBeVisible();
  expect(passwordButton()).toBeEnabled();
});
it("a delayed financial response cannot restore an account balance after retirement", async () => {
  let completeWallet: (() => void) | undefined;
  apiClient.defaults.adapter = (config) =>
    config.url === "/wallet/me"
      ? new Promise((resolve) => {
          completeWallet = () => {
            resolve(reply(config, persistedWallet));
          };
        })
      : Promise.resolve(
          reply(
            config,
            config.url === "/users/me"
              ? { user: employee() }
              : persistedMembership,
          ),
        );
  open();
  await waitFor(() => {
    expect(completeWallet).toBeDefined();
  });
  act(() => {
    getSessionRuntime().retire();
    clearAccessToken();
  });
  await act(async () => {
    completeWallet?.();
    await Promise.resolve();
  });
  expect(screen.queryByText("40.00", { exact: true })).toBeNull();
  expect(screen.queryByText(employee().email)).toBeNull();
  expect(passwordButton()).toBeDisabled();
});
