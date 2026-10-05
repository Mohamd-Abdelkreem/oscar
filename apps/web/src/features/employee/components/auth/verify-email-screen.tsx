"use client";

import { useEmailVerification } from "@/features/auth/hooks/email-verification.hooks";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MailCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  ButtonLink,
} from "@/features/employee/components/common/button";

export function EmployeeVerifyEmailScreen() {
  const flow = useEmailVerification();
  const state = flow.stage;

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      {["inbox", "ready", "unavailable", "uncertain"].includes(state) && (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-800">
            <MailCheck size={28} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              تحقق من صندوق بريدك الإلكتروني
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500 sm:text-sm">
              افتح رابط التفعيل الوارد إلى بريد الحساب، ثم أكد التفعيل. فتح
              الرابط وحده لا يفعّل الحساب.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-right text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">إرشادات هامة:</p>
            <ul className="list-inside list-disc space-y-1 text-slate-600">
              <li>
                التحقق يتم حصرياً عبر الروابط المباشرة (لا نطلب أي رموز OTP).
              </li>
              <li>
                صلاحية الرابط يحددها الخادم؛ قد يُستبدل أو تنتهي صلاحيته قبل
                التأكيد.
              </li>
              <li>
                يرجى التحقق من مجلد الرسائل الترويجية أو غير المرغوب فيها
                (Spam).
              </li>
            </ul>
          </div>

          <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs">
            <span className="block font-semibold text-emerald-900">
              تأكيد تفعيل البريد الإلكتروني:
            </span>
            <Button
              variant="primary"
              size="default"
              fullWidth
              icon={ExternalLink}
              aria-label="تأكيد تفعيل البريد الإلكتروني"
              disabled={state !== "ready" || flow.verifying}
              loading={flow.verifying}
              onClick={() => {
                void flow.confirm();
              }}
            >
              تأكيد التفعيل
            </Button>
          </div>

          <VerificationRecovery flow={flow} />
        </div>
      )}

      {state === "invalid" && (
        <div className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
            <AlertCircle size={32} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              رابط التفعيل غير صالح أو منتهي الصلاحية
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              قد يكون الرابط منتهي الصلاحية أو مستبدلاً أو مستخدماً مسبقاً.
              يمكنك طلب رابط تفعيل جديد إلى بريدك.
            </p>
          </div>
          <VerificationRecovery flow={flow} />
        </div>
      )}
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
              التحقق من الرابط لا يفعّل الحساب؛ يتطلب التفعيل تأكيدك.
            </p>
          </div>
        </div>
      )}

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
              تم تأكيد البريد الإلكتروني. سجل الدخول لعرض صلاحيات حسابك؛ التفعيل
              لا يمنح اشتراكاً مدفوعاً.
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
    </div>
  );
}

function VerificationRecovery({
  flow,
}: {
  readonly flow: ReturnType<typeof useEmailVerification>;
}) {
  return (
    <>
      {flow.error && (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {flow.error}
        </p>
      )}
      {flow.notice && (
        <p className="text-xs text-slate-600" role="status">
          {flow.notice}
        </p>
      )}
      {flow.stage === "unavailable" && (
        <Button
          variant="outline"
          fullWidth
          disabled={flow.previewBlocked}
          onClick={() => {
            void flow.preview();
          }}
        >
          إعادة المحاولة
        </Button>
      )}
      <form
        className="flex flex-col gap-2 pt-2"
        onSubmit={(event) => {
          void flow.resendLink(event);
        }}
      >
        <label
          htmlFor="verification-email"
          className="text-right text-xs font-semibold text-slate-700"
        >
          البريد الإلكتروني للحساب
        </label>
        <input
          id="verification-email"
          type="email"
          autoComplete="email"
          dir="ltr"
          value={flow.email}
          onChange={(event) => {
            flow.setEmail(event.target.value);
          }}
          required
          className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        <Button
          type="submit"
          variant={flow.stage === "invalid" ? "primary" : "outline"}
          size="default"
          fullWidth
          disabled={flow.resending || flow.resendUncertain}
          loading={flow.resending}
          icon={flow.stage === "invalid" ? Send : RefreshCw}
        >
          إعادة إرسال رابط التفعيل
        </Button>
        <Link
          href="/employee/auth/login"
          className="py-1 text-xs text-slate-500 hover:text-slate-800"
        >
          الرجوع لصفحة تسجيل الدخول
        </Link>
      </form>
    </>
  );
}
