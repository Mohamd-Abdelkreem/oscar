import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { identityUserSchema } from "@template/contracts";
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn() }) }));

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
});
const open = () =>
  render(
    <QueryClientProvider client={client}>
      <EmployeeAccountScreen />
    </QueryClientProvider>,
  );
const passwordButton = () =>
  screen.getByRole("button", { name: /تغيير كلمة المرور/u });

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
  expect(requests.every((path) => path === "/users/me")).toBe(true);
});

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
  expect(screen.getByRole("status")).toHaveTextContent("جارٍ التحقق");
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
