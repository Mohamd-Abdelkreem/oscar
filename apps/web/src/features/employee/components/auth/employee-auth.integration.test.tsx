import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
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
import {
  apiClient,
  clearAccessToken,
  setAccessToken,
} from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { EmployeeLoginScreen } from "./login-screen";
import { EmployeeRegisterScreen } from "./register-screen";
import { EmployeeVerifyEmailScreen } from "./verify-email-screen";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";
import { EmployeeForgotPasswordScreen } from "./forgot-password-screen";
import { EmployeeResetPasswordScreen } from "./reset-password-screen";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { ChangePasswordModal } from "../account/change-password-modal";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const originalAdapter = apiClient.defaults.adapter;

const submitRecovery = (name: string) => {
  const form = screen.getByRole("button", { name }).closest("form");
  if (form === null) throw new Error("US4_FORM_MISSING");
  fireEvent.submit(form);
};
describe("US4 recovery", () => {
  it("shows fresh-sign-in guidance only from a committed password change, never a display query", async () => {
    renderFlow(
      <EmployeeLoginScreen />,
      "/employee/auth/login?passwordChanged=1",
    );
    expect(screen.queryByRole("status")).toBeNull();
    vi.spyOn(authApi, "changePassword").mockResolvedValue({
      success: true,
      statusCode: 200,
      data: account,
    });
    renderFlow(
      <ChangePasswordModal isOpen onClose={vi.fn()} />,
      "/employee/account",
    );
    for (const [label, value] of [
      ["كلمة المرور الحالية", "short"],
      ["كلمة المرور الجديدة (15 - 128 حرفاً)", "US4 new password!"],
      ["تأكيد كلمة المرور الجديدة", "US4 new password!"],
    ]) {
      if (label !== undefined)
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    submitRecovery("حفظ كلمة المرور الجديدة");
    await screen.findByText("تم تحديث كلمة المرور بنجاح");
    renderFlow(<EmployeeLoginScreen />, "/employee/auth/login");
    expect(screen.getByRole("status")).toHaveTextContent("سجل الدخول من جديد");
    expect(screen.getByLabelText("كلمة المرور")).toHaveValue("");
  });
  it("lost reset response clears the active secrets and keeps visible uncertainty without replay", async () => {
    vi.spyOn(authApi, "validateResetToken").mockResolvedValue({
      success: true,
      statusCode: 200,
      data: { valid: true },
    });
    let writes = 0;
    apiClient.defaults.adapter = (config) => {
      writes++;
      return Promise.reject(
        new AxiosError("TOKEN-SENTINEL", "ERR_NETWORK", config),
      );
    };
    renderFlow(
      <ResetPasswordForm />,
      "/auth/reset-password?token=TOKEN-SENTINEL",
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
      ).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText(/^كلمة المرور الجديدة/), {
      target: { value: "PASSWORD-SENTINEL" },
    });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), {
      target: { value: "PASSWORD-SENTINEL" },
    });
    submitRecovery("حفظ كلمة المرور الجديدة");
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("لا تكرر الطلب");
    });
    expect(
      screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
    ).toBeDisabled();
    expect(screen.queryByDisplayValue("PASSWORD-SENTINEL")).toBeNull();
    expect(writes).toBe(1);
    expect(localStorage.getItem("oscar.cookie-write.v1")).not.toBeNull();
    expect(JSON.stringify(client.getMutationCache().getAll())).not.toContain(
      "SENTINEL",
    );
  });
  it.each([EmployeeForgotPasswordScreen, ForgotPasswordForm])(
    "keeps recovery neutral and offers both role destinations",
    async (Component) => {
      const request = vi.spyOn(authApi, "forgotPassword").mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { message: "neutral" },
      });
      renderFlow(<Component />, "/auth/forgot-password");
      fireEvent.change(screen.getByLabelText(/البريد الإلكتروني/), {
        target: { value: "ADMIN@EXAMPLE.TEST" },
      });
      submitRecovery("إرسال رابط إعادة التعيين");
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "قبول الطلب لا يؤكد وصولها",
        ),
      );
      expect(request).toHaveBeenCalledWith({ email: "admin@example.test" });
      expect(screen.getByRole("link", { name: /المسؤول/ })).toHaveAttribute(
        "href",
        "/admin/auth/login",
      );
      expect(screen.queryByText(/ساعتان|محاكاة/)).toBeNull();
    },
  );

  it.each([EmployeeResetPasswordScreen, ResetPasswordForm])(
    "previews without consumption, cleans the URL and succeeds only after explicit reset",
    async (Component) => {
      const preview = vi
        .spyOn(authApi, "validateResetToken")
        .mockResolvedValue({
          success: true,
          statusCode: 200,
          data: { valid: true },
        });
      const reset = vi
        .spyOn(authApi, "resetPassword")
        .mockResolvedValue({ success: true, statusCode: 200, data: account });
      renderFlow(
        <Component />,
        "/auth/reset-password?token=US4-SENTINEL&state=success",
      );
      await waitFor(() => {
        expect(preview).toHaveBeenCalled();
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
        ).toBeEnabled(),
      );
      expect(window.location.search).not.toContain("US4-SENTINEL");
      expect(reset).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText(/^كلمة المرور الجديدة/), {
        target: { value: "US4 new password!" },
      });
      fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), {
        target: { value: "mismatch" },
      });
      submitRecovery("حفظ كلمة المرور الجديدة");
      expect(reset).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), {
        target: { value: "US4 new password!" },
      });
      submitRecovery("حفظ كلمة المرور الجديدة");
      await screen.findByRole("heading", {
        name: "تم تعيين كلمة المرور الجديدة بنجاح",
      });
      expect(reset).toHaveBeenCalledWith("US4-SENTINEL", {
        newPassword: "US4 new password!",
        passwordConfirmation: "US4 new password!",
      });
      expect(client.getMutationCache().getAll()).toEqual([]);
      expect(screen.queryByDisplayValue("US4 new password!")).toBeNull();
    },
  );

  it("cannot reset a missing link or trust preview after expiry; unknown results never become success", async () => {
    const preview = vi.spyOn(authApi, "validateResetToken").mockResolvedValue({
      success: true,
      statusCode: 200,
      data: { valid: true },
    });
    const reset = vi
      .spyOn(authApi, "resetPassword")
      .mockRejectedValue(safeApiError("request", "BAD_REQUEST", 400));
    renderFlow(
      <EmployeeResetPasswordScreen />,
      "/employee/auth/reset-password?state=success",
    );
    await screen.findByRole("heading", {
      name: "رابط إعادة التعيين غير صالح أو منتهي",
    });
    expect(preview).not.toHaveBeenCalled();
    renderFlow(
      <EmployeeResetPasswordScreen />,
      "/employee/auth/reset-password?token=expired-after-preview",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }),
      ).toBeEnabled(),
    );
    for (const label of ["كلمة المرور الجديدة", "تأكيد كلمة المرور"])
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "US4 new password!" },
      });
    submitRecovery("حفظ كلمة المرور الجديدة");
    await screen.findByRole("heading", {
      name: "رابط إعادة التعيين غير صالح أو منتهي",
    });
    expect(reset).toHaveBeenCalledOnce();
  });
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
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
let loginRequest: MockInstance<typeof authApi.login>;
let lookup: MockInstance<typeof usersApi.getMe>;
const submit = (password = " short ") => {
  fireEvent.change(screen.getByLabelText("البريد الإلكتروني للعمل"), {
    target: { value: "employee@example.test" },
  });
  fireEvent.change(screen.getByLabelText("كلمة المرور"), {
    target: { value: password },
  });
  const form = screen
    .getByRole("button", { name: "تسجيل الدخول" })
    .closest("form");
  if (form === null) throw new Error("Login form missing");
  fireEvent.submit(form);
};
beforeEach(() => {
  getSessionRuntime().dispose();
  localStorage.clear();
  navigation.replace.mockClear();
  window.history.replaceState(
    null,
    "",
    "/employee/auth/login?returnTo=%2Femployee%2Faccount",
  );
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<unknown>) => callback(),
    },
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  lookup = vi.spyOn(usersApi, "getMe").mockResolvedValue(account);
  loginRequest = vi.spyOn(authApi, "login").mockImplementation(() => {
    setAccessToken("test-only-token");
    return Promise.resolve({ success: true, statusCode: 200, data: account });
  });
  render(
    <QueryClientProvider client={client}>
      <EmployeeLoginScreen />
    </QueryClientProvider>,
  );
});

const renderFlow = (component: React.ReactNode, path: string) => {
  cleanup();
  window.history.replaceState(null, "", path);
  return render(
    <QueryClientProvider client={client}>{component}</QueryClientProvider>,
  );
};
const submitRegistration = (
  referralCode = "",
  confirmation = "P03 new password!",
) => {
  fireEvent.change(screen.getByLabelText("الاسم الكامل"), {
    target: { value: "  Employee  " },
  });
  fireEvent.change(screen.getByLabelText("البريد الإلكتروني للعمل"), {
    target: { value: "NEW@EXAMPLE.TEST" },
  });
  fireEvent.change(screen.getByLabelText("كلمة المرور (15 - 128 حرفاً)"), {
    target: { value: "P03 new password!" },
  });
  fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), {
    target: { value: confirmation },
  });
  fireEvent.change(screen.getByLabelText("كود الدعوة (اختياري)"), {
    target: { value: referralCode },
  });
  const form = screen
    .getByRole("button", { name: "إنشاء الحساب" })
    .closest("form");
  if (form === null) throw new Error("Registration form missing");
  fireEvent.submit(form);
};
describe("US2 registration and explicit activation", () => {
  it.each([EmployeeVerifyEmailScreen, VerifyEmailPanel])(
    "ignores forged success and malformed link context (%#)",
    async (Component) => {
      const preview = vi.spyOn(authApi, "validateVerificationToken");
      const verify = vi.spyOn(authApi, "verifyEmail");
      renderFlow(
        <Component />,
        "/employee/auth/verify-email?state=success&token=one&token=two",
      );
      await screen.findByLabelText("البريد الإلكتروني للحساب");
      expect(
        screen.queryByText("تم تفعيل بريدك الإلكتروني بنجاح!"),
      ).not.toBeInTheDocument();
      expect(preview).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
      expect(window.location.search).not.toContain("token");
    },
  );
  it("permits explicit retry of a failed nonconsuming read without activation", async () => {
    const preview = vi
      .spyOn(authApi, "validateVerificationToken")
      .mockRejectedValueOnce(safeApiError("transient", "NETWORK_ERROR"))
      .mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { valid: true },
      });
    const verify = vi.spyOn(authApi, "verifyEmail");
    renderFlow(
      <EmployeeVerifyEmailScreen />,
      "/employee/auth/verify-email?token=read-retry",
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "إعادة المحاولة" }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "تأكيد تفعيل البريد الإلكتروني" }),
      ).toBeEnabled();
    });
    expect(preview).toHaveBeenCalledTimes(2);
    expect(verify).not.toHaveBeenCalled();
  });
  it.each([
    safeApiError("transient", "NETWORK_ERROR"),
    safeApiError("contract", "CONTRACT_ERROR"),
  ])(
    "does not turn an unknown activation result into success or resubmit (%#)",
    async (failure) => {
      vi.spyOn(authApi, "validateVerificationToken").mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { valid: true },
      });
      const verify = vi
        .spyOn(authApi, "verifyEmail")
        .mockRejectedValue(failure);
      renderFlow(
        <EmployeeVerifyEmailScreen />,
        "/employee/auth/verify-email?token=uncertain-consumption",
      );
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "تأكيد تفعيل البريد الإلكتروني" }),
        ).toBeEnabled();
      });
      fireEvent.click(
        screen.getByRole("button", { name: "تأكيد تفعيل البريد الإلكتروني" }),
      );
      await screen.findByRole("alert");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "تعذر تأكيد نتيجة التفعيل",
      );
      expect(
        screen.getByRole("button", { name: "تأكيد تفعيل البريد الإلكتروني" }),
      ).toBeDisabled();
      expect(verify).toHaveBeenCalledOnce();
      expect(
        screen.queryByText("تم تفعيل بريدك الإلكتروني بنجاح!"),
      ).not.toBeInTheDocument();
    },
  );
  it("shows neutral resend rate limiting and allows an explicit corrected request", async () => {
    const resend = vi
      .spyOn(authApi, "resendVerification")
      .mockRejectedValueOnce(
        safeApiError("request", "RATE_LIMIT_EXCEEDED", 429),
      )
      .mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { message: "Neutral" },
      });
    renderFlow(<EmployeeVerifyEmailScreen />, "/employee/auth/verify-email");
    fireEvent.change(await screen.findByLabelText("البريد الإلكتروني للحساب"), {
      target: { value: "pending@example.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "إعادة إرسال رابط التفعيل" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("محاولات كثيرة");
    expect(resend).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "إعادة إرسال رابط التفعيل" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "إذا كان الحساب مؤهلاً",
    );
  });
  it.each(["", "   ", ` ${"A".repeat(32)} `])(
    "registers normalized pending identity without a session (%#)",
    async (referral) => {
      const register = vi.spyOn(authApi, "register").mockResolvedValue({
        success: true,
        statusCode: 201,
        data: {
          user: {
            ...account.user,
            status: "PENDING_VERIFICATION",
            emailVerifiedAt: null,
          },
        },
      });
      renderFlow(<EmployeeRegisterScreen />, "/employee/auth/register");
      submitRegistration(referral);
      await screen.findByRole("status");
      expect(register).toHaveBeenCalledWith({
        fullName: "Employee",
        email: "new@example.test",
        phone: null,
        password: "P03 new password!",
        ...(referral.trim() === "" ? {} : { referralCode: "a".repeat(32) }),
      });
      expect(navigation.replace).toHaveBeenCalledWith(
        "/employee/auth/verify-email",
      );
      expect(lookup).not.toHaveBeenCalled();
      expect(
        screen.queryByLabelText("كلمة المرور (15 - 128 حرفاً)"),
      ).not.toBeInTheDocument();
      expect(client.getMutationCache().getAll()).toEqual([]);
    },
  );
  it.each([
    ["invalid", "P03 new password!"],
    ["", "different password!"],
  ])(
    "rejects referral or confirmation locally (%#)",
    async (referral, confirmation) => {
      const register = vi.spyOn(authApi, "register");
      renderFlow(<EmployeeRegisterScreen />, "/employee/auth/register");
      submitRegistration(referral, confirmation);
      await screen.findByRole("alert");
      expect(register).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("link", { name: "طلب رابط تفعيل للبريد نفسه" }),
      ).not.toBeInTheDocument();
    },
  );
  it.each([
    safeApiError("transient", "SERVICE_UNAVAILABLE", 503),
    safeApiError("transient", "NETWORK_ERROR"),
  ])(
    "keeps delivery/persistence uncertainty without repeating registration (%#)",
    async (failure) => {
      const register = vi.spyOn(authApi, "register").mockRejectedValue(failure);
      renderFlow(<EmployeeRegisterScreen />, "/employee/auth/register");
      submitRegistration();
      await screen.findByRole("alert");
      expect(screen.getByRole("alert")).toHaveTextContent("قد يكون الحساب");
      expect(
        screen.getByRole("link", { name: "طلب رابط تفعيل للبريد نفسه" }),
      ).toHaveAttribute("href", "/employee/auth/verify-email");
      submitRegistration();
      expect(register).toHaveBeenCalledOnce();
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );
  it.each([EmployeeVerifyEmailScreen, VerifyEmailPanel])(
    "previews and cleans history, then consumes only on confirmation (%#)",
    async (Component) => {
      const preview = vi
        .spyOn(authApi, "validateVerificationToken")
        .mockResolvedValue({
          success: true,
          statusCode: 200,
          data: { valid: true },
        });
      const verify = vi
        .spyOn(authApi, "verifyEmail")
        .mockResolvedValue({ success: true, statusCode: 200, data: account });
      renderFlow(
        <Component />,
        "/employee/auth/verify-email?token=private-link&state=success",
      );
      await screen.findByRole("button", {
        name: "تأكيد تفعيل البريد الإلكتروني",
      });
      expect(window.location.search).not.toContain("private-link");
      expect(preview).toHaveBeenCalledOnce();
      expect(verify).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getByRole("button", { name: "تأكيد تفعيل البريد الإلكتروني" }),
      );
      await screen.findByText("تم تفعيل بريدك الإلكتروني بنجاح!");
      expect(verify).toHaveBeenCalledOnce();
      expect(client.getMutationCache().getAll()).toEqual([]);
      renderFlow(<Component />, "/employee/auth/verify-email");
      await screen.findByLabelText("البريد الإلكتروني للحساب");
      expect(
        screen.queryByText("تم تفعيل بريدك الإلكتروني بنجاح!"),
      ).not.toBeInTheDocument();
      expect(verify).toHaveBeenCalledOnce();
    },
  );
  it.each([EmployeeVerifyEmailScreen, VerifyEmailPanel])(
    "denies expiry after preview and resends neutrally without email context (%#)",
    async (Component) => {
      vi.spyOn(authApi, "validateVerificationToken").mockResolvedValue({
        success: true,
        statusCode: 200,
        data: { valid: true },
      });
      vi.spyOn(authApi, "verifyEmail").mockRejectedValue(
        safeApiError("request", "BAD_REQUEST", 400),
      );
      const resend = vi.spyOn(authApi, "resendVerification").mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          message: "إذا كان الحساب مؤهلاً، ستصلك رسالة بالخطوات المطلوبة.",
        },
      });
      renderFlow(
        <Component />,
        "/employee/auth/verify-email?token=expired-after-preview",
      );
      fireEvent.click(
        await screen.findByRole("button", {
          name: "تأكيد تفعيل البريد الإلكتروني",
        }),
      );
      await screen.findByRole("alert");
      expect(
        screen.queryByText("تم تفعيل بريدك الإلكتروني بنجاح!"),
      ).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("البريد الإلكتروني للحساب"), {
        target: { value: "MISSING@EXAMPLE.TEST" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "إعادة إرسال رابط التفعيل" }),
      );
      await screen.findByRole("status");
      expect(resend).toHaveBeenCalledWith({ email: "missing@example.test" });
    },
  );
});
afterEach(() => {
  if (originalAdapter === undefined) delete apiClient.defaults.adapter;
  else apiClient.defaults.adapter = originalAdapter;
  cleanup();
  client.clear();
  clearAccessToken();
  getSessionRuntime().dispose();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("US1 employee sign-in", () => {
  it.each(["x", " short ", "x".repeat(128)])(
    "starts blank and accepts existing passwords without trimming (%#)",
    async (password) => {
      expect(screen.getByLabelText("البريد الإلكتروني للعمل")).toHaveValue("");
      expect(screen.getByLabelText("كلمة المرور")).toHaveValue("");
      submit(password);
      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledWith("/employee/account");
      });
      expect(loginRequest).toHaveBeenCalledWith({
        email: "employee@example.test",
        password,
        rememberMe: false,
      });
      expect(screen.getByLabelText("كلمة المرور")).toHaveValue("");
      expect(client.getMutationCache().getAll()).toEqual([]);
    },
  );
  it("uses checked ADMIN identity rather than an employee return target", async () => {
    loginRequest.mockImplementation(() => {
      setAccessToken("test-only-token");
      return Promise.resolve({
        success: true,
        statusCode: 200,
        data: { user: { ...account.user, role: "ADMIN" as const } },
      });
    });
    lookup.mockResolvedValue({ user: { ...account.user, role: "ADMIN" } });
    submit();
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/admin");
    });
  });
  it("blocks double submission and waits for current identity before navigation", async () => {
    let finish!: (value: typeof account) => void;
    lookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    submit();
    submit();
    await waitFor(() => {
      expect(lookup).toHaveBeenCalled();
    });
    expect(loginRequest).toHaveBeenCalledOnce();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /تسجيل الدخول/ })).toBeDisabled();
    await act(async () => {
      finish(account);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith("/employee/account");
    });
  });
  it.each([
    safeApiError("denied", "UNAUTHORIZED", 401),
    safeApiError("request", "RATE_LIMIT_EXCEEDED", 429),
    safeApiError("contract", "CONTRACT_ERROR"),
  ])(
    "shows safe denial and allows correction without navigation (%#)",
    async (failure) => {
      loginRequest.mockRejectedValueOnce(failure);
      submit();
      await screen.findByRole("alert");
      expect(navigation.replace).not.toHaveBeenCalled();
      if (failure.statusCode === 401)
        expect(screen.getByRole("alert")).toHaveTextContent(
          "راجع البريد وكلمة المرور",
        );
      expect(
        screen.getByRole("button", { name: "تسجيل الدخول" }),
      ).toBeEnabled();
      expect(screen.getByLabelText("كلمة المرور")).toHaveValue(" short ");
      submit("corrected");
      await waitFor(() => {
        expect(navigation.replace).toHaveBeenCalledWith("/employee/account");
      });
    },
  );
});
