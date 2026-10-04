import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SessionLoader } from "@/components/auth/session-loader";
import { LoginForm } from "@/features/auth/components/login-form";
import { GuestOnlyRoute } from "@/components/auth/guest-only-route";

export default function LoginPage() {
  return (
    <GuestOnlyRoute>
      <AuthShell
        eyebrow="Welcome back"
        title="Resume your session."
        summary="Sign in with a verified account. The browser keeps your access token only in memory."
      >
        <Suspense fallback={<SessionLoader />}>
          <LoginForm />
        </Suspense>
      </AuthShell>
    </GuestOnlyRoute>
  );
}
