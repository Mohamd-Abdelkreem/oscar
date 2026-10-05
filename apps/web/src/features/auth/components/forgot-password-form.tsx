"use client";
import { useState } from "react";
import Link from "next/link";
import { emailRequestBodySchema } from "@template/contracts";
import { FormField } from "@/components/forms/form-field";
import { useForgotPassword } from "../hooks/auth.hooks";
import { getApiError } from "@/services/api/api-client";

export function ForgotPasswordForm() {
  const command = useForgotPassword();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (command.isPending || command.uncertain) return;
    const parsed = emailRequestBodySchema.safeParse({ email });
    if (!parsed.success) {
      setError("أدخل بريداً إلكترونياً صالحاً.");
      return;
    }
    setError(null);
    try {
      await command.mutateAsync(parsed.data);
      if (command.isCurrentFlow())
        setNotice(
          "إذا كان الحساب مؤهلاً، ستصلك رسالة بالخطوات المطلوبة. قبول الطلب لا يؤكد وصولها.",
        );
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category !== "obsolete") setError(safe.message);
    }
  };
  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <FormField
        id="recovery-email"
        label="البريد الإلكتروني للحساب"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-notice form-notice--error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={command.isPending || command.uncertain}
      >
        إرسال رابط إعادة التعيين
      </button>
      <p className="auth-form__footer">
        <Link href="/employee/auth/login">تسجيل دخول الموظف</Link> ·{" "}
        <Link href="/admin/auth/login">تسجيل دخول المسؤول</Link>
      </p>
    </form>
  );
}
