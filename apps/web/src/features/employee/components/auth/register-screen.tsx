"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { AlertCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import { Button } from "@/features/employee/components/common/button";

export function EmployeeRegisterScreen() {
  const scheduleTimeout = useManagedTimeout();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
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
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setIsLoading(true);
    scheduleTimeout(() => {
      setIsLoading(false);
      // Route to verify-email inbox state
      router.push("/employee/auth/verify-email?state=inbox");
    }, 400);
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          إنشاء حساب موظف جديد
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          انضم لمنصة أوسكار للبدء في تنفيذ المهام اليومية
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="reg-name"
            className="block text-xs font-semibold text-slate-700"
          >
            الاسم الكامل
          </label>
          <input
            id="reg-name"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
            }}
            placeholder="أحمد مروان"
            className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="reg-email"
            className="block text-xs font-semibold text-slate-700"
          >
            البريد الإلكتروني للعمل
          </label>
          <input
            id="reg-email"
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
          <label
            htmlFor="reg-password"
            className="block text-xs font-semibold text-slate-700"
          >
            كلمة المرور (15 - 128 حرفاً)
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
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
          <p className="text-[11px] text-slate-400">
            الحد الأدنى 15 حرفاً طبقاً للسياسة الأمنية للمنصة.
          </p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="reg-confirm"
            className="block text-xs font-semibold text-slate-700"
          >
            تأكيد كلمة المرور
          </label>
          <input
            id="reg-confirm"
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

        <div className="space-y-1">
          <label
            htmlFor="reg-invite"
            className="block text-xs font-semibold text-slate-700"
          >
            كود الدعوة (اختياري)
          </label>
          <input
            id="reg-invite"
            type="text"
            dir="ltr"
            value={invitationCode}
            onChange={(e) => {
              setInvitationCode(e.target.value.toUpperCase());
            }}
            placeholder="OSCAR-XXXXX"
            className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 font-mono text-base uppercase focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
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
          icon={UserPlus}
        >
          إنشاء الحساب ومتابعة التفعيل
        </Button>
      </form>

      <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
        لديك حساب بالفعل؟{" "}
        <Link
          href="/employee/auth/login"
          className="font-bold text-emerald-700 hover:text-emerald-800"
        >
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
