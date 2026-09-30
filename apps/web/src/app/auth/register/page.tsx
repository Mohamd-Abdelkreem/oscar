import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="New account"
      title="Create your identity."
      summary="Start with a verified email and a strong password. Product-specific onboarding comes next."
    >
      <RegisterForm />
    </AuthShell>
  );
}
