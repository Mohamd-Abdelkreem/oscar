"use client";

import { loginBodySchema } from "@template/contracts";
import { AlertCircle, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAdminLogin } from "@/features/auth/hooks/auth.hooks";
import { useCredentialFieldCleanup } from "@/features/auth/hooks/credential-commands.hooks";
import { resolvePostLoginPath } from "@/features/auth/utils/safe-return-path";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import { getApiError } from "@/services/api/api-client";
import { AdminButton } from "../common/admin-button";

export function AdminLoginScreen() {
  const router = useRouter();
  const login = useAdminLogin();
  const submitting = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useCredentialFieldCleanup(() => {
    setPassword("");
  }, login.isCurrentFlow);

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (submitting.current || login.isPending || login.uncertain) return;
    setError(null);
    const parsed = loginBodySchema.safeParse({
      email,
      password,
      rememberMe: false,
    });
    if (!parsed.success) {
      setError("راجع البريد الإلكتروني وكلمة المرور (من 1 إلى 128 حرفاً).");
      return;
    }
    submitting.current = true;
    try {
      const account = await login.mutateAsync(parsed.data);
      setPassword("");
      if (login.isCurrentFlow()) {
        const returnTo = new URL(window.location.href).searchParams.get(
          "returnTo",
        );
        router.replace(resolvePostLoginPath(returnTo, account.user.role));
      }
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category !== "obsolete")
        setError(
          safe.statusCode === 429
            ? "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً."
            : safe.statusCode === 401
              ? "تعذر تسجيل الدخول. راجع البريد وكلمة المرور وتأكد من تفعيل حسابك."
              : safe.message,
        );
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          تسجيل الدخول للإدارة
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          أدخل بيانات حسابك الإداري المعتمد
        </p>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="space-y-4"
        aria-busy={login.isPending}
      >
        <div className="space-y-1">
          <label
            htmlFor="admin-login-email"
            className="block text-xs font-semibold text-slate-700"
          >
            البريد الإلكتروني للعمل
          </label>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="name@example.com"
            className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="admin-login-password"
              className="block text-xs font-semibold text-slate-700"
            >
              كلمة المرور
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <div className="relative">
            <input
              id="admin-login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 pl-12 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => {
                setShowPassword(!showPassword);
              }}
            />
          </div>
        </div>
        {error && (
          <p
            className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
            role="alert"
          >
            <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        <AdminButton
          type="submit"
          className="w-full"
          loading={login.isPending}
          disabled={login.isPending || login.uncertain}
          icon={LogIn}
        >
          تسجيل الدخول
        </AdminButton>
      </form>
    </div>
  );
}
