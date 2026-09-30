import { ProfileForm } from "@/features/users/components/profile-form";

import { PasswordForm } from "./password-form";
import { SessionControls } from "./session-controls";

export function AccountSettings() {
  return (
    <main className="workspace-main">
      <header className="workspace-title">
        <div>
          <p className="eyebrow">Account controls</p>
          <h1>Identity, kept explicit.</h1>
        </div>
        <p className="workspace-title__summary">
          Update safe profile fields or rotate your credential. Sensitive
          mutations require both authentication and CSRF proof.
        </p>
      </header>
      <div className="settings-stack">
        <ProfileForm />
        <PasswordForm />
        <SessionControls />
      </div>
    </main>
  );
}
