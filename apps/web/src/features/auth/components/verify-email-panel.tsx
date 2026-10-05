"use client";

import Link from "next/link";
import { FormField } from "@/components/forms/form-field";
import { useEmailVerification } from "@/features/auth/hooks/email-verification.hooks";

export function VerifyEmailPanel() {
  const flow = useEmailVerification();
  if (flow.stage === "checking")
    return (
      <p className="form-notice" aria-live="polite">
        جارٍ التحقق من صلاحية الرابط؛ لن يتم التفعيل دون تأكيدك.
      </p>
    );
  if (flow.stage === "success")
    return (
      <div className="success-panel">
        <span className="success-panel__mark" aria-hidden="true">
          ✓
        </span>
        <h2>تم تفعيل بريدك الإلكتروني بنجاح!</h2>
        <p>
          تم تأكيد البريد الإلكتروني. سجل الدخول لعرض صلاحيات حسابك؛ التفعيل لا
          يمنح اشتراكاً مدفوعاً.
        </p>
        <Link className="button button--full" href="/employee/auth/login">
          تسجيل الدخول للموظفين
        </Link>
        <Link className="button button--full" href="/auth/login">
          تسجيل الدخول
        </Link>
      </div>
    );
  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void flow.resendLink(event);
      }}
      noValidate
    >
      <p className="form-notice">
        {flow.stage === "ready"
          ? "الرابط صالح الآن. أكد تفعيل البريد الإلكتروني؛ فتح الرابط لا يفعّل الحساب."
          : "افتح رابط التفعيل الوارد أو اطلب رابطاً جديداً لبريد الحساب."}
      </p>
      {flow.stage === "ready" && (
        <button
          className="button button--full"
          type="button"
          disabled={flow.verifying}
          onClick={() => {
            void flow.confirm();
          }}
        >
          {flow.verifying ? "جارٍ التأكيد…" : "تأكيد تفعيل البريد الإلكتروني"}
        </button>
      )}
      {flow.stage === "unavailable" && (
        <button
          className="button button--full"
          type="button"
          disabled={flow.previewBlocked}
          onClick={() => {
            void flow.preview();
          }}
        >
          إعادة المحاولة
        </button>
      )}
      <FormField
        id="email"
        label="البريد الإلكتروني للحساب"
        type="email"
        autoComplete="email"
        dir="ltr"
        value={flow.email}
        onChange={(event) => {
          flow.setEmail(event.target.value);
        }}
      />
      {flow.error && (
        <p className="form-notice form-notice--error" role="alert">
          {flow.error}
        </p>
      )}
      {flow.notice && (
        <p className="form-notice" role="status">
          {flow.notice}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={flow.resending || flow.resendUncertain}
      >
        {flow.resending ? "جارٍ الإرسال…" : "إعادة إرسال رابط التفعيل"}
      </button>
    </form>
  );
}
