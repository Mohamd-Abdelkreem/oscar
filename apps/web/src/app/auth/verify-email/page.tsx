import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SessionLoader } from "@/components/auth/session-loader";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      title="Confirm the first link."
      summary="Verification tokens are short-lived, purpose-bound, and accepted only once."
    >
      <Suspense fallback={<SessionLoader />}>
        <VerifyEmailPanel />
      </Suspense>
    </AuthShell>
  );
}
