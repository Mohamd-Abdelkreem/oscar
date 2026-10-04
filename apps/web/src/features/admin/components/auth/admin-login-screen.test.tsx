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
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { authApi } from "@/features/auth/api/auth.api";
import { usersApi } from "@/features/users/api/users.api";
import { clearAccessToken, setAccessToken } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { AdminLoginScreen } from "./admin-login-screen";
import { AdminTopbar } from "../common/admin-topbar";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const account = {
  user: {
    id: "00000000-0000-4000-8000-000000000003",
    fullName: "مديرة الاختبار",
    email: "admin@example.test",
    phone: null,
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    emailVerifiedAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    referralCode: null,
    tasksBlocked: false,
    withdrawalsBlocked: false,
    accountVersion: 0,
  },
};
let client: QueryClient;
let lookup: MockInstance<typeof usersApi.getMe>;
const mount = (children: React.ReactNode) =>
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
const submit = () => {
  fireEvent.change(screen.getByLabelText("البريد الإلكتروني للعمل"), {
    target: { value: "ADMIN@example.test" },
  });
  fireEvent.change(screen.getByLabelText("كلمة المرور"), {
    target: { value: " short " },
  });
  const form = screen
    .getByRole("button", { name: "تسجيل الدخول" })
    .closest("form");
  if (form === null) throw new Error("Missing sign-in form");
  fireEvent.submit(form);
};
beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  clearAccessToken();
  navigation.replace.mockClear();
  window.history.replaceState(
    null,
    "",
    "/admin/auth/login?returnTo=%2Fadmin%2Fsettings%2Fadmins",
  );
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => callback(),
    },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(authApi, "adminLogin").mockImplementation(() => {
    setAccessToken("test-only-token");
    return Promise.resolve({ success: true, statusCode: 200, data: account });
  });
  lookup = vi.spyOn(usersApi, "getMe").mockResolvedValue(account);
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAccessToken();
  getSessionRuntime().dispose();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("dedicated administrator entry", () => {
  it("uses admin-only credentials and waits for current matching authority before navigating", async () => {
    let release!: (saved: typeof account) => void;
    lookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const generic = vi.spyOn(authApi, "login");
    mount(<AdminLoginScreen />);
    expect(screen.getByLabelText("كلمة المرور")).toHaveValue("");
    expect(
      screen.getByRole("link", { name: "نسيت كلمة المرور؟" }),
    ).toHaveAttribute("href", "/auth/forgot-password");
    expect(
      screen.queryByRole("link", { name: /إنشاء/ }),
    ).not.toBeInTheDocument();
    submit();
    submit();
    await waitFor(() => {
      expect(lookup).toHaveBeenCalled();
    });
    expect(authApi.adminLogin).toHaveBeenCalledExactlyOnceWith({
      email: "admin@example.test",
      password: " short ",
      rememberMe: false,
    });
    expect(generic).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    act(() => {
      release(account);
    });
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/admin/settings/admins");
    });
    expect(screen.getByLabelText("كلمة المرور")).toHaveValue("");
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain("test-only-token");
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });
  it.each(["role", "identity"])(
    "rejects a mismatching current %s without navigation",
    async (mismatch) => {
      lookup.mockResolvedValue({
        user: {
          ...account.user,
          ...(mismatch === "role"
            ? { role: "USER" as const }
            : { id: "00000000-0000-4000-8000-000000000004" }),
        },
      });
      mount(<AdminLoginScreen />);
      submit();
      await screen.findByRole("alert");
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );
  it.each([401, 429, 503])(
    "shows safe denial/unavailability for HTTP %s without replay",
    async (status) => {
      vi.mocked(authApi.adminLogin).mockRejectedValue(
        safeApiError(
          status === 503 ? "transient" : "denied",
          "AUTH_FAILED",
          status,
        ),
      );
      mount(<AdminLoginScreen />);
      submit();
      await screen.findByRole("alert");
      expect(authApi.adminLogin).toHaveBeenCalledOnce();
      expect(navigation.replace).not.toHaveBeenCalled();
      if (status === 429)
        expect(screen.getByRole("alert")).toHaveTextContent("محاولات كثيرة");
      if (status === 503)
        expect(
          screen.getByRole("button", { name: "تسجيل الدخول" }),
        ).toBeDisabled();
    },
  );
  it("displays the current header identity and ends only the current session", async () => {
    setAccessToken("test-only-token");
    const logout = vi
      .spyOn(authApi, "logout")
      .mockResolvedValue({ success: true, statusCode: 200, data: {} });
    const all = vi.spyOn(authApi, "logoutAll");
    mount(
      <AdminTopbar
        isCollapsed={false}
        onOpenMobile={() => undefined}
        onToggleCollapse={() => undefined}
      />,
    );
    await screen.findByText(account.user.fullName);
    expect(screen.getByRole("link", { name: /واجهة الموظف/ })).toHaveAttribute(
      "href",
      "/employee/tasks",
    );
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الخروج" }));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledOnce();
    });
    expect(all).not.toHaveBeenCalled();
  });
});
