"use client";

import {
  emailRequestBodySchema,
  type EmailRequestBody,
} from "@template/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import {
  useResendVerification,
  useVerifyEmail,
} from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type VerifyState = "working" | "verified" | "invalid";
type EmailInput = z.input<typeof emailRequestBodySchema>;

export function VerifyEmailPanel() {
  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();
  const token = useSearchParams().get("token");
  const attemptedToken = useRef<string | null>(null);
  const [state, setState] = useState<VerifyState>("working");
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

  useEffect(() => {
    if (token === null || attemptedToken.current === token) return;
    attemptedToken.current = token;
    void verifyEmail
      .mutateAsync(token)
      .then(() => {
        setState("verified");
      })
      .catch(() => {
        setState("invalid");
      });
  }, [token, verifyEmail]);

  const resend = handleSubmit(async (values) => {
    try {
      const result = await resendVerification.mutateAsync(values);
      setMessage(result.data.message);
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  const visibleState = token === null ? "invalid" : state;

  if (visibleState === "working") {
    return (
      <p className="form-notice" aria-live="polite">
        Verifying your one-time link…
      </p>
    );
  }
  if (visibleState === "verified") {
    return (
      <div className="success-panel">
        <span className="success-panel__mark" aria-hidden="true">
          ✓
        </span>
        <h2>Email verified.</h2>
        <p>Your account is active and ready for a new session.</p>
        <Link className="button button--full" href="/auth/login">
          Continue to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void resend(event);
      }}
      noValidate
    >
      <p className="form-notice form-notice--error">
        This verification link is missing, invalid, or expired.
      </p>
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
        {isSubmitting ? "Sending…" : "Send a fresh link"}
      </button>
    </form>
  );
}
