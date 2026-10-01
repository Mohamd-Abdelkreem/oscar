"use client";

import { AlertCircle, Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/features/employee/components/common/button";

export default function EmployeeLoginPage() {
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
    setTimeout(() => {
      setIsLoading(false);
      // Simulate local login and route to employee home
      router.push("/employee");
    }, 400);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 shadow-sm">
      <div className="text-center space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          تسجيل الدخول للموظفين
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          أدخل بيانات حسابك المعتمد للدخول إلى منصة المهام
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700">
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
            className="w-full min-h-[48px] px-3.5 py-2.5 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            required
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
              كلمة المرور
            </label>
            <Link
              href="/employee/auth/forgot-password"
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
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
          icon={LogIn}
        >
          تسجيل الدخول
        </Button>
      </form>

      <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
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
