"use client";

import { CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "@/features/employee/components/common/button";

export default function EmployeeForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 400);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="text-center space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          استعادة كلمة المرور
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          أدخل بريدك الإلكتروني المسجل لإرسال رابط إعادة تعيين كلمة المرور
        </p>
      </div>

      {isSubmitted ? (
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              تم إرسال تعليمات الاستعادة
            </h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              إذا كان البريد <bdi dir="ltr" className="font-semibold text-slate-800">{email}</bdi> مسجلاً في منصتنا، فستتلقى رسالة تتضمن رابطاً آمناً لتعيين كلمة مرور جديدة.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 text-right space-y-1">
            <p className="font-semibold text-slate-700">تنبيه أمني:</p>
            <p>
              تنفيذاً للسياسة الأمنية للمنصة، تتم إعادة التعيين عبر الرابط المشفر فقط. صلاحية الرابط ساعتان فقط.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <ButtonLink
              href="/employee/auth/reset-password"
              variant="outline"
              size="default"
              fullWidth
            >
              محاكاة فتح الرابط الوارد (Reset Password)
            </ButtonLink>

            <ButtonLink
              href="/employee/auth/login"
              variant="primary"
              size="default"
              fullWidth
            >
              الرجوع لتسجيل الدخول
            </ButtonLink>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700">
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
              className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="default"
            fullWidth
            loading={isLoading}
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
          </div>
        </form>
      )}
    </div>
  );
}
