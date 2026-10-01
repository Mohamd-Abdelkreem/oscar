"use client";

import { useManagedTimeout } from "@/features/employee/hooks/use-managed-timeout";

import { AlertCircle, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import { Button } from "@/features/employee/components/common/button";

export function EmployeeLoginScreen() {
  const scheduleTimeout = useManagedTimeout();
  const router = useRouter();
  const [email, setEmail] = useState("ahmed.marwan@example.com");
  const [password, setPassword] = useState("Password12345678");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    // Repository standard password validation (15 - 128 characters)
    if (password.length < 15) {
      setError("كلمة المرور يجب أن تتكون من 15 حرفاً على الأقل.");
      return;
    }
    if (password.length > 128) {
      setError("كلمة المرور يجب ألا تتجاوز 128 حرفاً.");
      return;
    }

    setIsLoading(true);
    scheduleTimeout(() => {
      setIsLoading(false);
      // Simulate local login and route to employee home
      router.push("/employee");
    }, 400);
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          تسجيل الدخول للموظفين
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          أدخل بيانات حسابك المعتمد للدخول إلى منصة المهام
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-slate-700"
          >
            البريد الإلكتروني للعمل
          </label>
          <input
            id="login-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            placeholder="name@example.com"
            className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-700"
            >
              كلمة المرور
            </label>
            <Link
              href="/employee/auth/forgot-password"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
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

        <Button
          type="submit"
          variant="primary"
          size="default"
          fullWidth
          loading={isLoading}
          icon={LogIn}
        >
          تسجيل الدخول
        </Button>
      </form>

      <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
        ليس لديك حساب موظف بعد؟{" "}
        <Link
          href="/employee/auth/register"
          className="font-bold text-emerald-700 hover:text-emerald-800"
        >
          إنشاء حساب جديد
        </Link>
      </div>
    </div>
  );
}
