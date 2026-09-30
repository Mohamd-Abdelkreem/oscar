import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SessionLoader } from "@/components/auth/session-loader";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password reset"
      title="Replace the credential."
      summary="A successful reset consumes the link and revokes every existing refresh session."
    >
      <Suspense fallback={<SessionLoader />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
