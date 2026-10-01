"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    // Validation (15-128 chars as per repository standard)
    if (newPassword.length < 15) {
      setError("يجب أن تتكون كلمة المرور الجديدة من 15 حرفاً على الأقل.");
      return;
    }
    if (newPassword.length > 128) {
      setError("يجب ألا تتجاوز كلمة المرور 128 حرفاً.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onClose();
      }, 1500);
    }, 500);
  };

  return (
    <ConfirmationSheet
      isOpen={isOpen}
      onClose={onClose}
      title="تغيير كلمة المرور"
      description="تحديث كلمة المرور لحساب الموظف (المعيار: 15 - 128 حرفاً)"
    >
      {success ? (
        <div className="py-6 text-center space-y-2">
          <CheckCircle2 size={40} className="mx-auto text-emerald-600" aria-hidden="true" />
          <h3 className="text-base font-bold text-slate-900">
            تم تحديث كلمة المرور بنجاح
          </h3>
          <p className="text-xs text-slate-500">
            تم حفظ كلمة المرور الجديدة في بيئة المعاينة المحلية.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="current-pass">
              كلمة المرور الحالية
            </label>
            <div className="relative">
              <input
                id="current-pass"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                }}
                className="w-full min-h-[48px] px-3.5 py-2 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pl-12"
                required
              />
              <button
                type="button"
                onClick={() => {
                  setShowCurrentPassword(!showCurrentPassword);
                }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label={showCurrentPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="new-pass">
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
                minLength={15}
                maxLength={128}
                className="w-full min-h-[48px] px-3.5 py-2 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pl-12"
                required
              />
              <button
                type="button"
                onClick={() => {
                  setShowNewPassword(!showNewPassword);
                }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                aria-label={showNewPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              الحد الأدنى 15 حرفاً وفق المعيار المعتمد للمنصة.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="conf-pass">
              تأكيد كلمة المرور الجديدة
            </label>
            <input
              id="conf-pass"
              type={showNewPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
              }}
              minLength={15}
              maxLength={128}
              className="w-full min-h-[48px] px-3.5 py-2 text-base rounded-md border border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-medium" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="default"
              fullWidth
              loading={isSubmitting}
              icon={KeyRound}
            >
              حفظ كلمة المرور الجديدة
            </Button>
            <Button
              variant="outline"
              size="default"
              fullWidth
              onClick={onClose}
            >
              إلغاء
            </Button>
          </div>
        </form>
      )}
    </ConfirmationSheet>
  );
}
