import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { usersApi } from "@/features/users/api/users.api";
import { authApi } from "@/features/auth/api/auth.api";
import { clearAccessToken, setAccessToken } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { GuestOnlyRoute } from "./guest-only-route";
import { ProtectedRoute } from "./protected-route";
import { LoginForm } from "@/features/auth/components/login-form";
import { AdminRouteBoundary } from "@/features/admin/components/common/admin-route-boundary";
import AuthLayout from "@/app/auth/layout";

const navigation = vi.hoisted(() => ({
  pathname: "/employee",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
const account = {
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    fullName: "Employee",
    email: "employee@example.test",
    phone: null,
    role: "USER" as const,
    status: "ACTIVE" as const,
    emailVerifiedAt: "2026-10-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    referralCode: "a".repeat(32),
    tasksBlocked: false,
    withdrawalsBlocked: false,
    accountVersion: 0,
  },
};
let client: QueryClient;
let lookup: MockInstance<typeof usersApi.getMe>;
const mount = (children: ReactNode) =>
  render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  navigation.pathname = "/employee";
  navigation.replace.mockClear();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => callback(),
    },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setAccessToken("test-only-token");
  lookup = vi.spyOn(usersApi, "getMe").mockResolvedValue(account);
  vi.spyOn(authApi, "refresh").mockRejectedValue(
    safeApiError("denied", "UNAUTHORIZED", 401),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  clearAccessToken();
  getSessionRuntime().dispose();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("current route authority", () => {
  it.each(["/admin/auth/login", "/admin/auth/accept-invitation"])(
    "keeps exact public entry %s outside the dashboard even when discovery fails",
    (pathname) => {
      navigation.pathname = pathname;
      lookup.mockRejectedValue(safeApiError("transient", "CHECK_FAILED"));
      mount(<AdminRouteBoundary>Public action</AdminRouteBoundary>);
      expect(screen.getByText("Public action")).toBeVisible();
      expect(lookup).not.toHaveBeenCalled();
      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    },
  );
  it.each([
    "/admin/auth/unknown",
    "/admin/auth/login/extra",
    "/admin/settings/admins",
  ])(
    "guards %s before mounting the dashboard or private children",
    async (pathname) => {
      navigation.pathname = pathname;
      lookup.mockImplementation(() => new Promise(() => undefined));
      mount(<AdminRouteBoundary>Private dashboard</AdminRouteBoundary>);
      expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(lookup).toHaveBeenCalled();
      });
    },
  );
  it("denies employee authority before the admin shell mounts", async () => {
    navigation.pathname = "/admin";
    mount(<AdminRouteBoundary>Private dashboard</AdminRouteBoundary>);
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/employee");
    });
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument();
  });
  it.each(["signed-in", "unavailable"])(
    "leaves shared public actions reachable with %s discovery",
    (mode) => {
      if (mode === "unavailable")
        lookup.mockRejectedValue(safeApiError("transient", "CHECK_FAILED"));
      mount(<AuthLayout>Shared recovery</AuthLayout>);
      expect(screen.getByText("Shared recovery")).toBeVisible();
      expect(lookup).not.toHaveBeenCalled();
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );
  it("keeps the generic credential form mounted while login retires anonymous authority", async () => {
    clearAccessToken();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.spyOn(authApi, "login").mockImplementation(async () => {
      getSessionRuntime().retire();
      await gate;
      setAccessToken("test-only-token");
      return { success: true, statusCode: 200, data: account };
    });
    mount(
      <GuestOnlyRoute>
        <LoginForm />
      </GuestOnlyRoute>,
    );
    await screen.findByLabelText("Work email");
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "employee@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "existing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in securely" }));
    await screen.findByRole("button", { name: "Establishing session…" });
    expect(screen.getByLabelText("Password")).toHaveValue("existing");
    await act(async () => {
      finish();
      await gate;
    });
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/employee");
    });
  });
  it("restores the latest check after a positively settled superseded refresh", async () => {
    clearAccessToken();
    let first = true;
    vi.mocked(authApi.refresh).mockImplementation(async () => {
      await Promise.resolve();
      if (first) {
        first = false;
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      }
      setAccessToken("test-only-token");
      return { success: true, statusCode: 200, data: account };
    });
    mount(
      <ProtectedRoute allowedRoles={["USER"]}>Private content</ProtectedRoute>,
    );
    await screen.findByText("Private content");
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("never mounts a private reader until the current server check permits it", async () => {
    let release!: (value: typeof account) => void;
    lookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const privateRead = vi.fn();
    function PrivateReader() {
      useEffect(() => {
        privateRead();
      }, []);
      return <p>Private content</p>;
    }
    mount(
      <ProtectedRoute allowedRoles={["USER"]}>
        <PrivateReader />
      </ProtectedRoute>,
    );
    expect(privateRead).not.toHaveBeenCalled();
    await act(async () => {
      release(account);
      await Promise.resolve();
    });
    await act(async () => {
      release(account);
      await Promise.resolve();
    });
    await screen.findByText("Private content");
    expect(privateRead).toHaveBeenCalledOnce();
  });
  it.each(["contract", "transient"] as const)(
    "blocks failed %s checks and permits explicit safe retry",
    async (category) => {
      lookup.mockRejectedValue(safeApiError(category, "CHECK_FAILED"));
      mount(
        <ProtectedRoute allowedRoles={["USER"]}>
          Private content
        </ProtectedRoute>,
      );
      await screen.findByRole("alert");
      expect(screen.queryByText("Private content")).not.toBeInTheDocument();
      expect(navigation.replace).not.toHaveBeenCalled();
      lookup.mockResolvedValue(account);
      fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
      await screen.findByText("Private content");
    },
  );
  it("blocks immediately on protected navigation despite an old allowed account", async () => {
    const view = mount(
      <ProtectedRoute allowedRoles={["USER"]}>Private content</ProtectedRoute>,
    );
    await screen.findByText("Private content");
    lookup.mockImplementation(() => new Promise(() => undefined));
    navigation.pathname = "/employee/account";
    view.rerender(
      <QueryClientProvider client={client}>
        <ProtectedRoute allowedRoles={["USER"]}>Private content</ProtectedRoute>
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });
  it.each(["focus", "online"])(
    "starts a new generation on %s and never revives denied authority",
    async (event) => {
      mount(
        <ProtectedRoute allowedRoles={["USER"]}>
          Private content
        </ProtectedRoute>,
      );
      await screen.findByText("Private content");
      const previous = getSessionRuntime().scope().check;
      lookup.mockRejectedValue(safeApiError("denied", "UNAUTHORIZED", 401));
      act(() => {
        window.dispatchEvent(new Event(event));
      });
      expect(screen.queryByText("Private content")).not.toBeInTheDocument();
      expect(getSessionRuntime().scope().check).toBeGreaterThan(previous);
      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledWith(
          "/employee/auth/login?returnTo=%2Femployee",
        );
      });
    },
  );
  it("sends an administrator to its audience without mounting employee content", async () => {
    lookup.mockResolvedValue({ user: { ...account.user, role: "ADMIN" } });
    mount(
      <ProtectedRoute allowedRoles={["USER"]}>Private content</ProtectedRoute>,
    );
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/admin");
    });
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });
  it("allows anonymous guest content and redirects valid employee sessions", async () => {
    clearAccessToken();
    const view = mount(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    await screen.findByText("Guest content");
    view.unmount();
    setAccessToken("test-only-token");
    mount(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/employee");
    });
  });
});
