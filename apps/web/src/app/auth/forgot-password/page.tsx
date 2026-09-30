import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset, without revealing."
      summary="Recovery responses stay intentionally neutral so account membership is never disclosed."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
