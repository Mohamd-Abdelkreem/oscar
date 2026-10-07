import type { APIRequestContext } from "@playwright/test";
import {
  identitySessionDataSchema,
  successEnvelopeSchema,
  proofAssetSchema,
  adminTaskDetailSchema,
} from "@template/contracts";
import { expect } from "./fixtures";
import { managementApiUrl, managementPassword } from "./admin-management";

export const syntheticProof = {
  name: "synthetic-proof.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWMw7kgz7khjgFAAHt4EhYP6a4AAAAAASUVORK5CYII=",
    "base64",
  ),
};
export async function taskActor(request: APIRequestContext, email: string) {
  const response = await request.post(managementApiUrl + "/auth/login", {
    data: { email, password: managementPassword, rememberMe: false },
  });
  expect(response.status()).toBe(200);
  const actor = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(await response.json()).data,
  );
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "csrfToken",
  );
  if (!csrf) throw new Error("P05_CSRF_MISSING");
  return {
    id: actor.user.id,
    headers: {
      Authorization: "Bearer " + actor.tokens.accessToken,
      "x-csrf-token": csrf.value,
    },
  };
}
export async function acceptedProof(
  request: APIRequestContext,
  headers: Record<string, string>,
  commandId = crypto.randomUUID(),
) {
  const response = await request.post(managementApiUrl + "/proofs", {
    headers,
    multipart: { commandId, file: syntheticProof },
  });
  expect(response.status()).toBe(201);
  return proofAssetSchema.parse(
    successEnvelopeSchema.parse(await response.json()).data,
  );
}
export async function publishedTask(
  request: APIRequestContext,
  headers: Record<string, string>,
  title: string,
  isCodeRequired = false,
) {
  const response = await request.post(managementApiUrl + "/admin/tasks", {
    headers,
    data: {
      commandId: crypto.randomUUID(),
      confirmed: true,
      title,
      description: "تعليمات محفوظة\nإقرار وإثبات فعلي",
      platform: "منصة",
      targetUrl: "https://example.com/task",
      publicationDate: "2026-10-05",
      publicationState: "PUBLISHED",
      isCodeRequired,
      illustrationAssetId: null,
    },
  });
  expect(response.status()).toBe(201);
  return adminTaskDetailSchema.parse(
    successEnvelopeSchema.parse(await response.json()).data,
  );
}
