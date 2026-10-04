"use client";

import { usePasswordReset } from "@/features/auth/hooks/password-recovery.hooks";

import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import {
  Button,
  ButtonLink,
} from "@/features/employee/components/common/button";

export function EmployeeResetPasswordScreen() {
  const flow = usePasswordReset();
  const {
    newPassword,
    setNewPassword,
    confirmation: confirmPassword,
    setConfirmation: setConfirmPassword,
    error,
  } = flow;
  const [showPassword, setShowPassword] = useState(false);

  if (flow.stage === "invalid") {
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
            الرابط مفقود أو غير صالح أو انتهت صلاحيته أو تم استخدامه. يرجى تقديم
            طلب استعادة جديد.
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

  if (flow.stage === "success") {
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
            سجل الدخول من جديد بكلمة المرور الجديدة إلى حسابك.
          </p>
        </div>

        <div className="pt-2">
          <ButtonLink
            href="/employee/auth/login"
            variant="primary"
            size="default"
            fullWidth
          >
            تسجيل دخول الموظف
          </ButtonLink>
          <ButtonLink href="/admin/auth/login" variant="outline" fullWidth>
            تسجيل دخول المسؤول
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

      {flow.stage === "checking" && (
        <p role="status">جارٍ التحقق من الرابط...</p>
      )}
      {flow.stage === "unavailable" && (
        <Button
          variant="outline"
          onClick={() => {
            void flow.preview();
          }}
        >
          إعادة التحقق من الرابط
        </Button>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          void flow.submit(event);
        }}
        className="space-y-4"
      >
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
              autoComplete="new-password"
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
            autoComplete="new-password"
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
          loading={flow.pending}
          disabled={flow.stage !== "ready"}
          icon={KeyRound}
        >
          حفظ كلمة المرور الجديدة
        </Button>
      </form>
    </div>
  );
}
