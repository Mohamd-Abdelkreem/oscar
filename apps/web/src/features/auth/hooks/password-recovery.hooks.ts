"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resetPasswordBodySchema } from "@template/contracts";
import { authApi } from "../api/auth.api";
import { useResetPassword } from "./auth.hooks";
import {
  useCredentialFieldCleanup,
  useLinkCredential,
} from "./credential-commands.hooks";
import { getApiError } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

type Stage =
  "checking" | "ready" | "invalid" | "unavailable" | "uncertain" | "success";

export const usePasswordReset = () => {
  const { read, dismiss } = useLinkCredential();
  const reset = useResetPassword();
  const [stage, setStage] = useState<Stage>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const clear = () => {
    setNewPassword("");
    setConfirmation("");
  };
  useCredentialFieldCleanup(clear, reset.isCurrentFlow);

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
      await authApi.validateResetToken(token, controller.signal);
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
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [preview]);

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const token = read();
    if (
      stage !== "ready" ||
      token === null ||
      reset.isPending ||
      reset.uncertain
    )
      return;
    const parsed = resetPasswordBodySchema.safeParse({
      newPassword,
      passwordConfirmation: confirmation,
    });
    if (!parsed.success) {
      setError("أدخل كلمة مرور من 15 إلى 128 حرفاً وتأكيداً مطابقاً.");
      return;
    }
    setError(null);
    try {
      await reset.mutateAsync({ token, body: parsed.data });
      if (reset.isCurrentFlow()) setStage("success");
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category === "obsolete") return;
      const uncertain = [
        "transient",
        "uncertain",
        "contract",
        "coordination",
      ].includes(safe.category);
      setStage(uncertain ? "uncertain" : "invalid");
      setError(
        uncertain
          ? "تعذر تأكيد تغيير كلمة المرور. لا تكرر الطلب. استخدم ملف متصفح منفصلاً أو جلسة خاصة مستقلة لتسجيل الدخول أو الاستعادة؛ علامة تبويب جديدة لا تكفي."
          : safe.message,
      );
    } finally {
      clear();
      dismiss();
    }
  };
  return {
    stage,
    newPassword,
    setNewPassword,
    confirmation,
    setConfirmation,
    error,
    preview,
    submit,
    pending: reset.isPending,
  };
};
