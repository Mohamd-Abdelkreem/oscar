"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MailCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/features/employee/components/common/button";

type VerificationState = "inbox" | "checking" | "success" | "expired";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const stateParam = searchParams.get("state") as VerificationState | null;

  const [userOverriddenState, setUserOverriddenState] = useState<VerificationState | null>(null);
  const state: VerificationState = userOverriddenState ?? stateParam ?? "inbox";
  const [cooldown, setCooldown] = useState(0);

  // Handle local resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [cooldown]);

  const handleResendLink = () => {
    if (cooldown > 0) return;
    setCooldown(60);
  };

  const handleSimulateClickLink = () => {
    setUserOverriddenState("checking");
    setTimeout(() => {
      setUserOverriddenState("success");
    }, 1200);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6 text-center shadow-sm">
      {/* 1. Inbox Instructions State */}
      {state === "inbox" && (
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200">
            <MailCheck size={28} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              تحقق من صندوق بريدك الإلكتروني
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              أرسلنا رابط تفعيل مشفراً إلى بريدك المسجل. يرجى فتح الرسالة والنقر على الرابط لتأكيد الحساب.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 text-right space-y-2 leading-relaxed">
            <p className="font-semibold text-slate-800">إرشادات هامة:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>التحقق يتم حصرياً عبر الروابط المباشرة (لا نطلب أي رموز OTP).</li>
              <li>صلاحية الرابط تمتد لـ 24 ساعة من تاريخ الإرسال.</li>
              <li>يرجى التحقق من مجلد الرسائل الترويجية أو غير المرغوب فيها (Spam).</li>
            </ul>
          </div>

          {/* Interactive Simulation Action */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-md text-xs space-y-2">
            <span className="font-semibold text-emerald-900 block">
              محاكاة تجريبية للرابط (Demo Action):
            </span>
            <Button
              variant="primary"
              size="default"
              fullWidth
              icon={ExternalLink}
              onClick={handleSimulateClickLink}
            >
              محاكاة الضغط على رابط التفعيل الوارد
            </Button>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="outline"
              size="default"
              fullWidth
              disabled={cooldown > 0}
              icon={RefreshCw}
              onClick={handleResendLink}
            >
              {cooldown > 0
                ? `إعادة إرسال الرابط متاحة بعد (${cooldown.toString()} ثانية)`
                : "إعادة إرسال رابط التفعيل"}
            </Button>

            <Link
              href="/employee/auth/login"
              className="text-xs text-slate-500 hover:text-slate-800 py-1"
            >
              الرجوع لصفحة تسجيل الدخول
            </Link>
          </div>
        </div>
      )}

      {/* 2. Checking State */}
      {state === "checking" && (
        <div className="space-y-4 py-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-emerald-700 flex items-center justify-center mx-auto">
            <RefreshCw size={28} className="animate-spin" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">جارٍ التحقق من صلاحية الرابط...</h1>
            <p className="text-xs text-slate-500 mt-1">يرجى الانتظار لحظات لتأكيد تفعيل الحساب</p>
          </div>
        </div>
      )}

      {/* 3. Success State */}
      {state === "success" && (
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              تم تفعيل بريدك الإلكتروني بنجاح!
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              أصبح حسابك نشطاً الآن ومؤهلاً للبدء في تنفيذ مهام الموظفين وإدارة المحفظة المالية.
            </p>
          </div>

          <div className="pt-2">
            <ButtonLink
              href="/employee/auth/login"
              variant="primary"
              size="default"
              fullWidth
            >
              تسجيل الدخول إلى حسابك
            </ButtonLink>
          </div>
        </div>
      )}

      {/* 4. Expired State */}
      {state === "expired" && (
        <div className="space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle size={32} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              رابط التفعيل غير صالح أو منتهي الصلاحية
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              يبدو أن الرابط المستخدم قد انتهت صلاحيته أو تم استهلاكه مسبقاً. يمكنك طلب رابط تفعيل جديد إلى بريدك.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button
              variant="primary"
              size="default"
              fullWidth
              icon={Send}
              onClick={handleResendLink}
            >
              طلب رابط تفعيل جديد
            </Button>

            <Link
              href="/employee/auth/login"
              className="text-xs text-slate-500 hover:text-slate-800 py-1"
            >
              الرجوع لصفحة تسجيل الدخول
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeVerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">جارٍ التحميل...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
