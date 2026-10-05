"use client";

import { emailRequestBodySchema } from "@template/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "../api/auth.api";
import { useResendVerification, useVerifyEmail } from "./auth.hooks";
import { useLinkCredential } from "./credential-commands.hooks";
import { getApiError } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";

type VerificationStage =
  | "checking"
  | "inbox"
  | "ready"
  | "invalid"
  | "unavailable"
  | "uncertain"
  | "success";
const invalidLink =
  "رابط التفعيل غير صالح أو منتهي الصلاحية أو تم استبداله أو استخدامه. اطلب رابطاً جديداً.";

export const useEmailVerification = () => {
  const link = useLinkCredential();
  const readLink = link.read;
  const dismissLink = link.dismiss;
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [stage, setStage] = useState<VerificationStage>("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const previewRequest = useRef<AbortController | null>(null);

  const preview = useCallback(async () => {
    const token = readLink();
    if (previewRequest.current !== null) return;
    if (token === null) {
      setStage("inbox");
      return;
    }
    setError(null);
    setStage("checking");
    const controller = new AbortController();
    previewRequest.current = controller;
    const runtime = getSessionRuntime();
    const scope = runtime.scope();
    try {
      await authApi.validateVerificationToken(token, controller.signal);
      if (!controller.signal.aborted && runtime.isCurrent(scope))
        setStage("ready");
    } catch (failure: unknown) {
      if (controller.signal.aborted || !runtime.isCurrent(scope)) return;
      const safe = getApiError(failure);
      if (safe.category === "obsolete") {
        setStage("inbox");
        return;
      }
      const unavailable =
        safe.statusCode === 429 ||
        ["transient", "uncertain", "contract"].includes(safe.category);
      setStage(unavailable ? "unavailable" : "invalid");
      setError(unavailable ? safe.message : invalidLink);
      if (!unavailable) dismissLink();
    } finally {
      if (previewRequest.current === controller) previewRequest.current = null;
    }
  }, [readLink, dismissLink]);
  useEffect(() => {
    let active = true;
    // Defer until after Strict Mode's effect replay; neither preview consumes the link.
    queueMicrotask(() => {
      if (active) void preview();
    });
    return () => {
      active = false;
      previewRequest.current?.abort();
    };
  }, [preview]);

  const confirm = async () => {
    const token = readLink();
    if (
      stage !== "ready" ||
      token === null ||
      verify.isPending ||
      verify.uncertain
    )
      return;
    setError(null);
    try {
      const activated = await verify.mutateAsync(token);
      if (
        activated.data.user.status !== "ACTIVE" ||
        activated.data.user.emailVerifiedAt === null
      )
        throw safeApiError("contract", "CONTRACT_ERROR");
      if (verify.isCurrentFlow()) setStage("success");
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category === "obsolete") {
        setStage("inbox");
        return;
      }
      const uncertain = ["transient", "uncertain", "contract"].includes(
        safe.category,
      );
      setStage(uncertain ? "uncertain" : "invalid");
      setError(
        uncertain
          ? "تعذر تأكيد نتيجة التفعيل. لا تكرر التأكيد؛ تحقق بتسجيل الدخول أو اطلب رابطاً جديداً."
          : safe.statusCode === 429
            ? "محاولات كثيرة. انتظر قليلاً ثم اطلب رابطاً جديداً."
            : invalidLink,
      );
    } finally {
      dismissLink();
    }
  };
  const resendLink = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (resend.isPending || resend.uncertain) return;
    const parsed = emailRequestBodySchema.safeParse({ email });
    if (!parsed.success) {
      setError("أدخل بريداً إلكترونياً صالحاً.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await resend.mutateAsync(parsed.data);
      if (resend.isCurrentFlow())
        setNotice(
          "إذا كان الحساب مؤهلاً، ستصلك رسالة بالخطوات المطلوبة. قبول الطلب لا يؤكد وصولها.",
        );
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category !== "obsolete")
        setError(
          safe.statusCode === 429
            ? "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً."
            : safe.message,
        );
    }
  };
  return {
    stage,
    email,
    setEmail,
    error,
    notice,
    preview,
    confirm,
    resendLink,
    verifying: verify.isPending,
    resending: resend.isPending,
    resendUncertain: resend.uncertain,
    previewBlocked: stage === "checking",
  };
};
