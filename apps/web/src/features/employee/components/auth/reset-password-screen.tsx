"use client";

import { useManagedTimeout } from "@/features/employee/hooks/use-managed-timeout";

import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import {
  Button,
  ButtonLink,
} from "@/features/employee/components/common/button";

export function EmployeeResetPasswordScreen() {
  const scheduleTimeout = useManagedTimeout();
  const searchParams = useSearchParams();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if link is simulated as expired via query param ?state=expired
  const isExpired = searchParams.get("state") === "expired";

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    // Repository standard password validation (15 - 128 characters)
    if (newPassword.length < 15) {
      setError("كلمة المرور الجديدة يجب أن تتكون من 15 حرفاً على الأقل.");
      return;
    }
    if (newPassword.length > 128) {
      setError("كلمة المرور يجب ألا تتجاوز 128 حرفاً.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setIsLoading(true);
    scheduleTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 400);
  };

  if (isExpired) {
    return (
      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
          <AlertCircle size={32} aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            رابط إعادة التعيين غير صالح أو منتهي
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            الرابط الذي تحاول استخدامه قد انتهت صلاحيته (المدة القصوى ساعتان).
            يرجى تقديم طلب استعادة جديد.
          </p>
        </div>

        <div className="pt-2">
          <ButtonLink
            href="/employee/auth/forgot-password"
            variant="primary"
            size="default"
            fullWidth
          >
            طلب رابط استعادة جديد
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800">
          <CheckCircle2 size={32} aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            تم تعيين كلمة المرور الجديدة بنجاح
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            يمكنك الآن استخدام كلمة المرور الجديدة لتسجيل الدخول إلى حساب الموظف
            الخاص بك.
          </p>
        </div>

        <div className="pt-2">
          <ButtonLink
            href="/employee/auth/login"
            variant="primary"
            size="default"
            fullWidth
          >
            الانتقال لتسجيل الدخول
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          تعيين كلمة مرور جديدة
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          أدخل كلمة مرور قوية جديدة لحسابك (15 - 128 حرفاً)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="new-pass"
            className="block text-xs font-semibold text-slate-700"
          >
            كلمة المرور الجديدة
          </label>
          <div className="relative">
            <input
              id="new-pass"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
              }}
              minLength={15}
              maxLength={128}
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

        <div className="space-y-1">
          <label
            htmlFor="conf-pass"
            className="block text-xs font-semibold text-slate-700"
          >
            تأكيد كلمة المرور
          </label>
          <input
            id="conf-pass"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
            }}
            minLength={15}
            maxLength={128}
            className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
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
          icon={KeyRound}
        >
          حفظ كلمة المرور الجديدة
        </Button>
      </form>
    </div>
  );
}
