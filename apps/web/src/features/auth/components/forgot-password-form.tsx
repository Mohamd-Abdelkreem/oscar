"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  emailRequestBodySchema,
  type EmailRequestBody,
} from "@template/contracts";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useForgotPassword } from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type EmailInput = z.input<typeof emailRequestBodySchema>;

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<EmailInput, unknown, EmailRequestBody>({
    resolver: zodResolver(emailRequestBodySchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await forgotPassword.mutateAsync(values);
      setMessage(result.data.message);
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormField
        id="email"
        label="Account email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      {message === null ? null : (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send recovery link"}
      </button>
      <p className="auth-form__footer">
        <Link href="/auth/login">Back to sign in</Link>
      </p>
    </form>
  );
}
