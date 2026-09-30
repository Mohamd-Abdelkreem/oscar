"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  PASSWORD_MIN_LENGTH,
  registerBodySchema,
  type RegisterBody,
} from "@template/contracts";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useRegister } from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type RegisterInput = z.input<typeof registerBodySchema>;

export function RegisterForm() {
  const registerAccount = useRegister();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<RegisterInput, unknown, RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { fullName: "", email: "", phone: null, password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await registerAccount.mutateAsync(values);
      setSubmittedEmail(result.data.user.email);
    } catch (error) {
      setFormError(applyApiFormError(error, { getValues, setError }));
    }
  });

  if (submittedEmail !== null) {
    return (
      <div className="success-panel" aria-live="polite">
        <span className="success-panel__mark" aria-hidden="true">
          ✓
        </span>
        <h2>Check your inbox.</h2>
        <p>
          We sent a verification link to <strong>{submittedEmail}</strong>.
          Verify your address before signing in.
        </p>
        <Link className="button button--full" href="/auth/login">
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormField
        id="fullName"
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="phone"
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint={`Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`}
        error={errors.password?.message}
        {...register("password")}
      />
      {formError === null ? null : (
        <p className="form-notice form-notice--error" role="alert">
          {formError}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
      <p className="auth-form__footer">
        Already registered? <Link href="/auth/login">Sign in</Link>
      </p>
    </form>
  );
}
