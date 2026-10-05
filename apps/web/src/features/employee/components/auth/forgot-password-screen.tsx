"use client";

import { emailRequestBodySchema } from "@template/contracts";
import { useForgotPassword } from "@/features/auth/hooks/auth.hooks";
import { getApiError } from "@/services/api/api-client";

import { CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Button,
  ButtonLink,
} from "@/features/employee/components/common/button";

export function EmployeeForgotPasswordScreen() {
  const command = useForgotPassword();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (command.isPending || command.uncertain) return;
    const parsed = emailRequestBodySchema.safeParse({ email });
    if (!parsed.success) {
      setError("أدخل بريداً إلكترونياً صالحاً.");
      return;
    }
    setError(null);
    try {
      await command.mutateAsync(parsed.data);
      if (command.isCurrentFlow()) setIsSubmitted(true);
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category !== "obsolete") setError(safe.message);
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          استعادة كلمة المرور
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور
        </p>
      </div>

      {isSubmitted ? (
        <div className="space-y-4 text-center" role="status">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              تم قبول طلب الاستعادة
            </h2>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500">
              إذا كان الحساب مؤهلاً، ستصلك رسالة بالخطوات المطلوبة. قبول الطلب
              لا يؤكد وصولها.
            </p>
          </div>

          <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-right text-xs text-slate-600">
            <p className="font-semibold text-slate-700">تنبيه أمني:</p>
            <p>
              استخدم الرابط الوارد في رسالة الاستعادة. قد ينتهي أو يُستبدل؛ اطلب
              رابطاً جديداً عند الحاجة.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
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
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label
              htmlFor="forgot-email"
              className="block text-xs font-semibold text-slate-700"
            >
              البريد الإلكتروني المسجل
            </label>
            <input
              id="forgot-email"
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

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-600">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="default"
            fullWidth
            loading={command.isPending}
            disabled={command.uncertain}
            icon={KeyRound}
          >
            إرسال رابط إعادة التعيين
          </Button>

          <div className="pt-2 text-center">
            <Link
              href="/employee/auth/login"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              تذكرت كلمة المرور؟ تسجيل الدخول
            </Link>
            <Link
              href="/admin/auth/login"
              className="block text-xs font-semibold text-slate-500"
            >
              تسجيل دخول المسؤول
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
