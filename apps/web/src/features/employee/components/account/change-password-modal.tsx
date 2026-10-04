"use client";

import { changePasswordBodySchema } from "@template/contracts";
import { useChangePassword } from "@/features/auth/hooks/auth.hooks";
import { useCredentialFieldCleanup } from "@/features/auth/hooks/credential-commands.hooks";
import { getApiError } from "@/services/api/api-client";
import Link from "next/link";

import { CheckCircle2, KeyRound } from "lucide-react";
import { useState, useEffect } from "react";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import { Button } from "../common/button";
import { ConfirmationSheet } from "../common/confirmation-sheet";

interface ChangePasswordModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
}: ChangePasswordModalProps) {
  const command = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };
  useCredentialFieldCleanup(clear, command.isCurrentFlow);
  useEffect(
    () => () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    [isOpen],
  );
  const close = () => {
    clear();
    setError(null);
    command.reset();
    onClose();
  };
  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!isOpen || command.isPending || command.uncertain) return;
    const parsed = changePasswordBodySchema.safeParse({
      currentPassword,
      newPassword,
      passwordConfirmation: confirmPassword,
    });
    if (!parsed.success) {
      setError(
        "راجع كلمة المرور الحالية واختر كلمة جديدة مختلفة من 15 إلى 128 حرفاً مع تأكيد مطابق.",
      );
      return;
    }
    setError(null);
    try {
      await command.mutateAsync(parsed.data);
      clear();
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category === "obsolete") return;
      if (
        ["transient", "uncertain", "contract", "coordination"].includes(
          safe.category,
        )
      )
        clear();
      setError(safe.message);
    }
  };

  return (
    <ConfirmationSheet
      isOpen={isOpen}
      onClose={close}
      title="تغيير كلمة المرور"
      description="تحديث كلمة المرور لحساب الموظف (المعيار: 15 - 128 حرفاً)"
    >
      {command.isSuccess ? (
        <div className="space-y-2 py-6 text-center">
          <CheckCircle2
            size={40}
            className="mx-auto text-emerald-600"
            aria-hidden="true"
          />
          <h3 className="text-base font-bold text-slate-900">
            تم تحديث كلمة المرور بنجاح
          </h3>
          <p className="text-xs text-slate-500">
            سجل الدخول من جديد بكلمة المرور الجديدة.
          </p>
          <Link href="/employee/auth/login">تسجيل الدخول من جديد</Link>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label
              className="block text-xs font-semibold text-slate-700"
              htmlFor="current-pass"
            >
              كلمة المرور الحالية
            </label>
            <div className="relative">
              <input
                id="current-pass"
                maxLength={128}
                autoComplete="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                }}
                className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2 pl-12 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                required
              />
              <PasswordVisibilityToggle
                visible={showCurrentPassword}
                onToggle={() => {
                  setShowCurrentPassword(!showCurrentPassword);
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="block text-xs font-semibold text-slate-700"
              htmlFor="new-pass"
            >
              كلمة المرور الجديدة (15 - 128 حرفاً)
            </label>
            <div className="relative">
              <input
                id="new-pass"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                }}
                autoComplete="new-password"
                minLength={15}
                maxLength={128}
                className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2 pl-12 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                required
              />
              <PasswordVisibilityToggle
                visible={showNewPassword}
                onToggle={() => {
                  setShowNewPassword(!showNewPassword);
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              الحد الأدنى 15 حرفاً وفق المعيار المعتمد للمنصة.
            </p>
          </div>

          <div className="space-y-1">
            <label
              className="block text-xs font-semibold text-slate-700"
              htmlFor="conf-pass"
            >
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              id="conf-pass"
              type={showNewPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
              }}
              autoComplete="new-password"
              minLength={15}
              maxLength={128}
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          {(error ?? command.error?.message) && (
            <p className="text-xs font-medium text-rose-600" role="alert">
              {error ?? command.error?.message}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="default"
              fullWidth
              loading={command.isPending}
              disabled={command.uncertain}
              icon={KeyRound}
            >
              حفظ كلمة المرور الجديدة
            </Button>
            <Button variant="outline" size="default" fullWidth onClick={close}>
              إلغاء
            </Button>
          </div>
        </form>
      )}
    </ConfirmationSheet>
  );
}
