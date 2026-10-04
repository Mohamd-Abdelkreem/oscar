"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminInvitationAcceptBodySchema,
  type AdminInvitationAcceptBody,
} from "@template/contracts";
import { authApi } from "@/features/auth/api/auth.api";
import {
  useCredentialCommand,
  useCredentialFieldCleanup,
  useLinkCredential,
} from "@/features/auth/hooks/credential-commands.hooks";
import { getApiError } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

type Stage =
  "checking" | "ready" | "invalid" | "unavailable" | "uncertain" | "success";
export const useInvitationAcceptance = () => {
  const { read, dismiss } = useLinkCredential();
  const accept = useCredentialCommand(
    "accept-invitation",
    ({ token, body }: { token: string; body: AdminInvitationAcceptBody }) =>
      authApi.acceptAdminInvitation(token, body),
  );
  const isCurrentFlow = accept.isCurrentFlow;
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useCredentialFieldCleanup(() => {
    setPassword("");
    setConfirmation("");
  }, accept.isCurrentFlow);
  const preview = useCallback(async () => {
    const token = read();
    if (request.current !== null) return;
    if (token === null) {
      setStage("invalid");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const runtime = getSessionRuntime();
    const scope = runtime.scope();
    setStage("checking");
    setError(null);
    try {
      await authApi.validateAdminInvitation(token, controller.signal);
      if (!controller.signal.aborted && runtime.isCurrent(scope))
        setStage("ready");
    } catch (failure: unknown) {
      if (controller.signal.aborted || !runtime.isCurrent(scope)) return;
      const safe = getApiError(failure);
      const unavailable =
        safe.statusCode === 429 ||
        ["transient", "contract", "uncertain"].includes(safe.category);
      setStage(unavailable ? "unavailable" : "invalid");
      setError(safe.message);
      if (!unavailable) dismiss();
    } finally {
      if (request.current === controller) request.current = null;
    }
  }, [read, dismiss]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void preview();
    });
    const release = getSessionRuntime().onRetire(() => {
      if (!isCurrentFlow()) {
        setStage("invalid");
        dismiss();
      }
    });
    return () => {
      active = false;
      request.current?.abort();
      release();
    };
  }, [preview, dismiss, isCurrentFlow]);
  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const token = read();
    if (
      stage !== "ready" ||
      token === null ||
      accept.isPending ||
      accept.uncertain
    )
      return;
    const parsed = adminInvitationAcceptBodySchema.safeParse({
      newPassword: password,
      passwordConfirmation: confirmation,
    });
    if (!parsed.success) {
      setError("أدخل كلمة مرور من 15 إلى 128 حرفاً وتأكيداً مطابقاً.");
      return;
    }
    setError(null);
    try {
      await accept.mutateAsync({ token, body: parsed.data });
      if (accept.isCurrentFlow()) setStage("success");
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category === "obsolete") return;
      const uncertain = ["transient", "uncertain", "contract"].includes(
        safe.category,
      );
      setStage(uncertain ? "uncertain" : "invalid");
      setError(
        uncertain
          ? "تعذر تأكيد قبول الدعوة. لا تكرر الطلب ولا تستنتج النجاح من صلاحية الرابط. تحقق مع المسؤول ثم سجل الدخول بصورة مستقلة."
          : safe.message,
      );
    } finally {
      setPassword("");
      setConfirmation("");
      dismiss();
    }
  };
  return {
    stage,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    error,
    preview,
    submit,
    pending: accept.isPending,
  };
};
