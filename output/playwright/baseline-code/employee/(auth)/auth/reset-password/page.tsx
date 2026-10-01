"use client";

import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, ButtonLink } from "@/features/employee/components/common/button";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const _tokenParam = searchParams.get("token");

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
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 400);
  };

  if (isExpired) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle size={32} aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            رابط إعادة التعيين غير صالح أو منتهي
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            الرابط الذي تحاول استخدامه قد انتهت صلاحيته (المدة القصوى ساعتان). يرجى تقديم طلب استعادة جديد.
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
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 size={32} aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            تم تعيين كلمة المرور الجديدة بنجاح
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            يمكنك الآن استخدام كلمة المرور الجديدة لتسجيل الدخول إلى حساب الموظف الخاص بك.
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
    <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="text-center space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          تعيين كلمة مرور جديدة
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          أدخل كلمة مرور قوية جديدة لحسابك (15 - 128 حرفاً)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="new-pass" className="block text-xs font-semibold text-slate-700">
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
              className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pl-12"
              required
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword(!showPassword);
              }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="conf-pass" className="block text-xs font-semibold text-slate-700">
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
            className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium" role="alert">
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

export default function EmployeeResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">جارٍ التحميل...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
