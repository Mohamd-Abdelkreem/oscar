import { z } from "zod";
import {
  PROOF_OUTPUT_MAX_BYTES,
  uploadIdentitySchema,
  uploadCancellationSchema,
  uploadObservationSchema,
  uploadCancellationOutcomeSchema,
  type UploadObservation,
} from "@template/contracts";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
} from "@/services/api/financial-response";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";

export function createPrivateImageApi<T extends { id: string }>(options: {
  purpose: "PROOF" | "TASK_ILLUSTRATION";
  uploadPath: string;
  readPath: string;
  schema: z.ZodType<T>;
}) {
  const observation = (commandId: string) =>
    uploadObservationSchema.refine(
      (reply) =>
        reply.commandId === commandId && reply.purpose === options.purpose,
    );
  return {
    upload: async (commandId: string, file: File) => {
      const identity = financialInput(uploadIdentitySchema, { commandId });
      const form = new FormData();
      form.append("commandId", identity.commandId);
      form.append("file", file);
      const runtime = getSessionRuntime();
      const scope = runtime.scope();
      const response = await apiClient.post<unknown>(options.uploadPath, form);
      if (!runtime.isCurrentCheck(scope))
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      return parseApiResponse(response, options.schema, 201).data;
    },
    observe: (
      commandId: string,
      signal?: AbortSignal,
    ): Promise<UploadObservation> => {
      const id = financialInput(z.uuid(), commandId);
      return financialRead(
        () =>
          apiClient.get<unknown>(`${options.uploadPath}/uploads/${id}`, {
            ...(signal === undefined ? {} : { signal }),
          }),
        observation(id),
      );
    },
    cancel: (
      commandId: string,
      intent: unknown,
    ): Promise<UploadObservation> => {
      const id = financialInput(z.uuid(), commandId);
      const body = financialInput(uploadCancellationSchema, intent);
      return financialRead(
        () =>
          apiClient.post<unknown>(
            `${options.uploadPath}/uploads/${id}/cancel`,
            body,
          ),
        uploadCancellationOutcomeSchema.and(observation(id)),
      );
    },
    metadata: (assetId: string, signal?: AbortSignal) => {
      const id = financialInput(z.uuid(), assetId);
      return financialRead(
        () =>
          apiClient.get<unknown>(`${options.readPath}/${id}`, {
            ...(signal === undefined ? {} : { signal }),
          }),
        options.schema.refine((asset) => asset.id === id),
      );
    },
    content: async (assetId: string, signal: AbortSignal): Promise<Blob> => {
      const id = financialInput(z.uuid(), assetId);
      const runtime = getSessionRuntime();
      const scope = runtime.scope();
      const response = await apiClient.get<unknown>(
        `${options.readPath}/${id}/content`,
        { responseType: "blob", signal },
      );
      if (!runtime.isCurrentCheck(scope))
        throw safeApiError("obsolete", "OBSOLETE_SCOPE");
      if (signal.aborted) throw safeApiError("cancelled", "CANCELLED");
      const bytes = response.data;
      const length = response.headers["content-length"];
      if (
        response.status !== 200 ||
        response.headers["content-type"] !== "image/png" ||
        response.headers["cache-control"] !== "private, no-store" ||
        response.headers["x-content-type-options"] !== "nosniff" ||
        response.headers["content-disposition"] !==
          'inline; filename="image.png"' ||
        !(bytes instanceof Blob) ||
        bytes.type !== "image/png" ||
        bytes.size < 1 ||
        bytes.size > PROOF_OUTPUT_MAX_BYTES ||
        typeof length !== "string" ||
        length !== String(bytes.size)
      ) {
        throw safeApiError("contract", "CONTRACT_ERROR");
      }
      return bytes;
    },
  };
}
