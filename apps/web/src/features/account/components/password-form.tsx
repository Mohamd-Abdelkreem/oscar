"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePasswordBodySchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordBody,
} from "@template/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useChangePassword } from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type PasswordInput = z.input<typeof changePasswordBodySchema>;

export function PasswordForm() {
  const changePassword = useChangePassword();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<PasswordInput, unknown, ChangePasswordBody>({
    resolver: zodResolver(changePasswordBodySchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      passwordConfirmation: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await changePassword.mutateAsync(values);
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <div className="settings-form__heading">
        <div>
          <p className="eyebrow">Credential</p>
          <h2>Change password</h2>
        </div>
        <p>A successful change signs out every active device.</p>
      </div>
      <div className="settings-form__fields">
        <FormField
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
        <FormField
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${String(PASSWORD_MIN_LENGTH)} characters.`}
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <FormField
          id="passwordConfirmation"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.passwordConfirmation?.message}
          {...register("passwordConfirmation")}
        />
      </div>
      {message === null ? null : (
        <p className="form-notice form-notice--error" role="alert">
          {message}
        </p>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
