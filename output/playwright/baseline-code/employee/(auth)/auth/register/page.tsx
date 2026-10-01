"use client";

import { AlertCircle, Eye, EyeOff, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/features/employee/components/common/button";

export default function EmployeeRegisterPage() {
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
    setTimeout(() => {
      setIsLoading(false);
      // Route to verify-email inbox state
      router.push("/employee/auth/verify-email?state=inbox");
    }, 400);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="text-center space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          إنشاء حساب موظف جديد
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          انضم لمنصة أوسكار للبدء في تنفيذ المهام اليومية
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700">
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
            className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700">
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
            className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700">
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
          <p className="text-[11px] text-slate-400">
            الحد الأدنى 15 حرفاً طبقاً للسياسة الأمنية للمنصة.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="reg-confirm" className="block text-xs font-semibold text-slate-700">
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
            className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="reg-invite" className="block text-xs font-semibold text-slate-700">
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
            className="w-full min-h-[48px] px-3.5 py-2.5 text-base font-mono uppercase rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
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
          icon={UserPlus}
        >
          إنشاء الحساب ومتابعة التفعيل
        </Button>
      </form>

      <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
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
