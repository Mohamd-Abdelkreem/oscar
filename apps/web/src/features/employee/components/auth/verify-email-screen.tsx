"use client";

import { useManagedTimeout } from "@/features/employee/hooks/use-managed-timeout";

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
import { useEffect, useState } from "react";
import {
  Button,
  ButtonLink,
} from "@/features/employee/components/common/button";

type VerificationState = "inbox" | "checking" | "success" | "expired";

export function EmployeeVerifyEmailScreen() {
  const scheduleTimeout = useManagedTimeout();
  const searchParams = useSearchParams();
  const stateParam = searchParams.get("state");

  const [userOverriddenState, setUserOverriddenState] =
    useState<VerificationState | null>(null);
  const state = userOverriddenState ?? stateParam ?? "inbox";
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
    scheduleTimeout(() => {
      setUserOverriddenState("success");
    }, 1200);
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      {/* 1. Inbox Instructions State */}
      {state === "inbox" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800">
            <MailCheck size={28} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              تحقق من صندوق بريدك الإلكتروني
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
              أرسلنا رابط تفعيل مشفراً إلى بريدك المسجل. يرجى فتح الرسالة والنقر
              على الرابط لتأكيد الحساب.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-right text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">إرشادات هامة:</p>
            <ul className="list-inside list-disc space-y-1 text-slate-600">
              <li>
                التحقق يتم حصرياً عبر الروابط المباشرة (لا نطلب أي رموز OTP).
              </li>
              <li>صلاحية الرابط تمتد لـ 24 ساعة من تاريخ الإرسال.</li>
              <li>
                يرجى التحقق من مجلد الرسائل الترويجية أو غير المرغوب فيها
                (Spam).
              </li>
            </ul>
          </div>

          {/* Interactive Simulation Action */}
          <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs">
            <span className="block font-semibold text-emerald-900">
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

          <div className="flex flex-col gap-2 pt-2">
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
              className="py-1 text-xs text-slate-500 hover:text-slate-800"
            >
              الرجوع لصفحة تسجيل الدخول
            </Link>
          </div>
        </div>
      )}

      {/* 2. Checking State */}
      {state === "checking" && (
        <div className="space-y-4 py-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-emerald-700">
            <RefreshCw size={28} className="animate-spin" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              جارٍ التحقق من صلاحية الرابط...
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              يرجى الانتظار لحظات لتأكيد تفعيل الحساب
            </p>
          </div>
        </div>
      )}

      {/* 3. Success State */}
      {state === "success" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={32} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              تم تفعيل بريدك الإلكتروني بنجاح!
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              أصبح حسابك نشطاً الآن ومؤهلاً للبدء في تنفيذ مهام الموظفين وإدارة
              المحفظة المالية.
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
            <AlertCircle size={32} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              رابط التفعيل غير صالح أو منتهي الصلاحية
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              يبدو أن الرابط المستخدم قد انتهت صلاحيته أو تم استهلاكه مسبقاً.
              يمكنك طلب رابط تفعيل جديد إلى بريدك.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
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
              className="py-1 text-xs text-slate-500 hover:text-slate-800"
            >
              الرجوع لصفحة تسجيل الدخول
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
