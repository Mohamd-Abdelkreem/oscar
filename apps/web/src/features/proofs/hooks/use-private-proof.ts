"use client";

import { useEffect, useState } from "react";
import type { ProofAsset, IllustrationAsset } from "@template/contracts";
import { proofsApi } from "../api/proofs.api";
import { taskIllustrationsApi } from "../api/task-illustrations.api";
import { useTaskRead } from "@/shared/query/financial-query";
import { getSessionRuntime } from "@/services/api/session-runtime";
import {
  getApiError,
  safeApiError,
  type ApiError,
} from "@/services/api/safe-error";

export function usePrivateProof(options: {
  purpose: "PROOF" | "TASK_ILLUSTRATION";
  assetId: string | null;
  evidenceIdentity: string;
  role: "USER" | "ADMIN";
  open: boolean;
}) {
  const api = options.purpose === "PROOF" ? proofsApi : taskIllustrationsApi;
  const metadata = useTaskRead<ProofAsset | IllustrationAsset>({
    domain: "private-image",
    role: options.role,
    selection: [options.purpose, options.assetId, options.evidenceIdentity],
    enabled: options.open && options.assetId !== null,
    read: (_scope, signal) => {
      if (options.assetId === null)
        throw safeApiError("request", "NOT_FOUND", 404);
      return api.metadata(options.assetId, signal);
    },
  });
  const scope = metadata.scope;
  const reportDenial = metadata.reportDenial;
  const identity = JSON.stringify([
    scope,
    options.purpose,
    options.assetId,
    options.evidenceIdentity,
    options.open,
  ]);
  const [preview, setPreview] = useState<{
    identity: string;
    url: string | null;
    error: ApiError | null;
  } | null>(null);
  const asset = metadata.data;
  useEffect(() => {
    if (!metadata.allowed || !options.open || asset?.availability !== "PRESENT")
      return;
    const controller = new AbortController();
    const runtime = getSessionRuntime();
    let url: string | undefined;
    const revoke = () => {
      controller.abort();
      if (url !== undefined) {
        URL.revokeObjectURL(url);
        url = undefined;
      }
    };
    const retirement = runtime.onRetire(revoke);
    void api
      .content(asset.id, controller.signal)
      .then((bytes) => {
        if (controller.signal.aborted || !runtime.isCurrentCheck(scope)) return;
        if (bytes.size !== asset.byteCount)
          throw safeApiError("contract", "CONTRACT_ERROR");
        url = URL.createObjectURL(bytes);
        setPreview({ identity, url, error: null });
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted || !runtime.isCurrentCheck(scope)) return;
        const error = getApiError(failure);
        setPreview({ identity, url: null, error });
        reportDenial(error);
      });
    return () => {
      retirement();
      revoke();
    };
  }, [
    api,
    asset,
    identity,
    metadata.allowed,
    options.open,
    reportDenial,
    scope,
  ]);
  const current =
    preview?.identity === identity &&
    metadata.allowed &&
    options.open &&
    asset?.availability === "PRESENT"
      ? preview
      : null;
  return {
    url: current?.url ?? null,
    availability: asset?.availability ?? null,
    error: metadata.error ?? current?.error ?? null,
    isPending:
      options.open &&
      options.assetId !== null &&
      !metadata.isError &&
      (metadata.isPending ||
        (asset?.availability === "PRESENT" && current === null)),
    refetch: metadata.refetch,
  };
}
