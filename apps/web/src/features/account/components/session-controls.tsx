"use client";

import { useState } from "react";

import { useLogoutAll } from "@/features/auth/hooks/auth.hooks";
import { replaceWithLogin } from "@/features/auth/utils/session-navigation";
import { getApiError } from "@/services/api/api-client";

export function SessionControls() {
  const logoutAll = useLogoutAll();
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null);

  const endEverySession = (): void => {
    setLogoutAllError(null);

    logoutAll.mutate(undefined, {
      onSuccess: () => {
        replaceWithLogin();
      },
      onError: (error: unknown) => {
        const apiError = getApiError(error);

        setLogoutAllError(
          `${apiError.message} Revocation of sessions on your other devices could not be confirmed.`,
        );
      },
    });
  };

  return (
    <section className="danger-panel">
      <div>
        <p className="eyebrow">Session control</p>
        <h2>Sign out every device</h2>
        <p>Revoke the entire refresh-token family for this account.</p>
      </div>
      <button
        className="button button--danger"
        type="button"
        onClick={endEverySession}
        disabled={logoutAll.isPending}
      >
        {logoutAll.isPending ? "Revoking…" : "Sign out all devices"}
      </button>
      {logoutAllError === null ? null : (
        <p role="alert" className="form-error">
          {logoutAllError}
        </p>
      )}
    </section>
  );
}
