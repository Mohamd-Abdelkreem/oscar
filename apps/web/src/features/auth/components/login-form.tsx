"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginBodySchema, type LoginBody } from "@template/contracts";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useLogin } from "@/features/auth/hooks/auth.hooks";
import { resolvePostLoginPath } from "@/features/auth/utils/safe-return-path";
import { applyApiFormError } from "@/shared/forms/form";

type LoginInput = z.input<typeof loginBodySchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<LoginInput, unknown, LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      router.replace(
        resolvePostLoginPath(searchParams.get("returnTo")) as Route,
      );
    } catch (error) {
      setFormError(applyApiFormError(error, { getValues, setError }));
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
        label="Work email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="form-row">
        <label className="check-field">
          <input type="checkbox" {...register("rememberMe")} />
          <span>Keep me signed in</span>
        </label>
        <Link href="/auth/forgot-password">Forgot password?</Link>
      </div>
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
        {isSubmitting ? "Establishing session…" : "Sign in securely"}
      </button>
      <p className="auth-form__footer">
        New to Relay? <Link href="/auth/register">Create an account</Link>
      </p>
    </form>
  );
}
