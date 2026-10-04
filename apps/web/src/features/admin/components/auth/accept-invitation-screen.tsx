"use client";

import Link from "next/link";
import { FormField } from "@/components/forms/form-field";
import { useInvitationAcceptance } from "../../hooks/invitation-acceptance.hooks";

export function AcceptInvitationScreen() {
  const flow = useInvitationAcceptance();
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-lg font-bold text-neutral-900">
        قبول دعوة مسؤول النظام
      </h1>
      {flow.stage === "success" ? (
        <div role="status" className="space-y-4 text-sm">
          <h2>تم قبول الدعوة</h2>
          <p>سجل الدخول بصورة مستقلة. قبول الدعوة لا ينشئ جلسة دخول.</p>
          <Link className="button button--full" href="/admin/auth/login">
            تسجيل دخول المسؤول
          </Link>
        </div>
      ) : flow.stage === "invalid" ? (
        <div className="space-y-4 text-sm">
          <h2>رابط الدعوة غير صالح أو منتهي</h2>
          <p>
            قد يكون الرابط مفقوداً أو مستخدماً أو مستبدلاً أو ملغى. تواصل مع
            المسؤول لقراءة حالة الدعوة.
          </p>
          <Link className="button button--full" href="/admin/auth/login">
            تسجيل دخول المسؤول
          </Link>
        </div>
      ) : (
        <form
          className="auth-form"
          noValidate
          onSubmit={(event) => {
            void flow.submit(event);
          }}
        >
          {flow.stage === "checking" && (
            <p role="status" className="form-notice">
              جارٍ التحقق من الرابط...
            </p>
          )}
          <FormField
            id="invitation-password"
            label="كلمة المرور الجديدة"
            type="password"
            autoComplete="new-password"
            hint="من 15 إلى 128 حرفاً"
            value={flow.password}
            onChange={(event) => {
              flow.setPassword(event.target.value);
            }}
          />
          <FormField
            id="invitation-confirmation"
            label="تأكيد كلمة المرور"
            type="password"
            autoComplete="new-password"
            value={flow.confirmation}
            onChange={(event) => {
              flow.setConfirmation(event.target.value);
            }}
          />
          {flow.error && (
            <p role="alert" className="form-notice form-notice--error">
              {flow.error}
            </p>
          )}
          {flow.stage === "unavailable" && (
            <button
              type="button"
              className="button button--full"
              onClick={() => {
                void flow.preview();
              }}
            >
              إعادة التحقق من الرابط
            </button>
          )}
          <button
            type="submit"
            className="button button--full"
            disabled={flow.stage !== "ready" || flow.pending}
          >
            قبول الدعوة
          </button>
        </form>
      )}
    </section>
  );
}
