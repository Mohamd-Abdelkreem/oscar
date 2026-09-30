"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileBodySchema,
  type UpdateProfileBody,
} from "@template/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useSession } from "@/features/auth/hooks/auth.hooks";
import { useUpdateProfile } from "@/features/users/hooks/users.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type ProfileInput = z.input<typeof updateProfileBodySchema>;

export function ProfileForm() {
  const user = useSession().data?.user ?? null;
  const updateProfile = useUpdateProfile();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<ProfileInput, unknown, UpdateProfileBody>({
    resolver: zodResolver(updateProfileBodySchema),
    values: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? null,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await updateProfile.mutateAsync(values);
      setMessage("Profile details saved.");
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
          <p className="eyebrow">Profile</p>
          <h2>Personal details</h2>
        </div>
        <p>Only explicitly safe account fields reach the browser.</p>
      </div>
      <div className="settings-form__fields">
        <FormField
          id="fullName"
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register("fullName")}
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
          id="profileEmail"
          label="Email"
          type="email"
          value={user?.email ?? ""}
          disabled
          readOnly
        />
      </div>
      {message === null ? null : (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
