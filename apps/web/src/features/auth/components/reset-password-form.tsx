"use client";
import Link from "next/link";
import { FormField } from "@/components/forms/form-field";
import { usePasswordReset } from "../hooks/password-recovery.hooks";

export function ResetPasswordForm() {
  const flow = usePasswordReset();
  if (flow.stage === "invalid")
    return (
      <div className="success-panel">
        <h2>رابط إعادة التعيين غير صالح أو منتهي</h2>
        <p>الرابط مفقود أو انتهت صلاحيته أو تم استبداله أو استخدامه.</p>
        <Link className="button button--full" href="/auth/forgot-password">
          طلب رابط استعادة جديد
        </Link>
      </div>
    );
  if (flow.stage === "success")
    return (
      <div className="success-panel" role="status">
        <h2>تم تعيين كلمة المرور الجديدة بنجاح</h2>
        <p>سجل الدخول من جديد بكلمة المرور الجديدة.</p>
        <Link className="button button--full" href="/employee/auth/login">
          تسجيل دخول الموظف
        </Link>
        <Link className="button button--full" href="/admin/auth/login">
          تسجيل دخول المسؤول
        </Link>
      </div>
    );
  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={(event) => {
        void flow.submit(event);
      }}
    >
      {flow.stage === "checking" && (
        <p className="form-notice" role="status">
          جارٍ التحقق من الرابط...
        </p>
      )}
      <FormField
        id="reset-new-password"
        label="كلمة المرور الجديدة"
        type="password"
        autoComplete="new-password"
        hint="من 15 إلى 128 حرفاً"
        value={flow.newPassword}
        onChange={(event) => {
          flow.setNewPassword(event.target.value);
        }}
      />
      <FormField
        id="reset-confirmation"
        label="تأكيد كلمة المرور"
        type="password"
        autoComplete="new-password"
        value={flow.confirmation}
        onChange={(event) => {
          flow.setConfirmation(event.target.value);
        }}
      />
      {flow.error && (
        <p className="form-notice form-notice--error" role="alert">
          {flow.error}
        </p>
      )}
      {flow.stage === "unavailable" && (
        <button
          className="button button--full"
          type="button"
          onClick={() => {
            void flow.preview();
          }}
        >
          إعادة التحقق من الرابط
        </button>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={flow.pending || flow.stage !== "ready"}
      >
        حفظ كلمة المرور الجديدة
      </button>
    </form>
  );
}
