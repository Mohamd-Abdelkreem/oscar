import { AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { PROOF_OUTPUT_MAX_BYTES } from "@template/contracts";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  now,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { proofsApi } from "./proofs.api";

cleanupNetwork();
const asset = {
  id: actorId,
  purpose: "PROOF",
  uploadedAt: now,
  width: 1,
  height: 1,
  contentType: "image/png",
  byteCount: 8,
  availability: "PRESENT",
};
describe("private proof transport", () => {
  it("uploads actual file bytes in exactly two multipart fields", async () => {
    networkSession();
    const file = new File(["synthetic"], "proof.png", { type: "image/png" });
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        const form: unknown = config.data;
        expect(form).toBeInstanceOf(FormData);
        if (!(form instanceof FormData)) throw new Error("Missing multipart");
        expect([...form.keys()]).toEqual(["commandId", "file"]);
        expect(form.get("commandId")).toBe(otherId);
        expect(form.get("file")).toBe(file);
        const response = reply(config, asset);
        response.status = 201;
        response.data.statusCode = 201;
        return response;
      });
    expect(await proofsApi.upload(otherId, file)).toEqual(asset);
  });
  it.each([
    { commandId: otherId, purpose: "PROOF", state: "NOT_OBSERVED" },
    { commandId: actorId, purpose: "TASK_ILLUSTRATION", state: "NOT_OBSERVED" },
    {
      commandId: actorId,
      purpose: "PROOF",
      state: "FAILED",
      failureCode: "UPLOAD_CANCELLED",
      failedAt: now,
      uploadedAt: now,
    },
  ])(
    "rejects wrong upload identities and fictional cancelled file facts",
    async (payload) => {
      networkSession();
      apiClient.defaults.adapter = (config) =>
        Promise.resolve(reply(config, payload));
      await expect(proofsApi.observe(actorId)).rejects.toMatchObject({
        category: "contract",
      });
    },
  );
  it("requires explicit terminal cancellation and rejects a mismatched metadata resource", async () => {
    networkSession();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(
        reply(
          config,
          config.method === "post"
            ? { commandId: actorId, purpose: "PROOF", state: "PENDING" }
            : asset,
        ),
      );
    await expect(
      proofsApi.cancel(actorId, { confirmed: true }),
    ).rejects.toMatchObject({ category: "contract" });
    await expect(proofsApi.metadata(otherId)).rejects.toMatchObject({
      category: "contract",
    });
  });
  it.each(["valid", "oversize", "type", "headers", "length"])(
    "validates canonical binary %s",
    async (variant) => {
      networkSession();
      const signal = new AbortController().signal;
      const bytes = new Blob(
        [
          variant === "oversize"
            ? new Uint8Array(PROOF_OUTPUT_MAX_BYTES + 1)
            : "synthetic",
        ],
        { type: variant === "type" ? "image/svg+xml" : "image/png" },
      );
      apiClient.defaults.adapter = (config) =>
        Promise.resolve().then(() => {
          expect(config.signal).toBe(signal);
          return {
            config,
            status: 200,
            statusText: "OK",
            data: bytes,
            headers: new AxiosHeaders({
              "content-type": "image/png",
              "content-length": variant === "length" ? "0" : String(bytes.size),
              "cache-control": "private, no-store",
              "x-content-type-options": variant === "headers" ? "" : "nosniff",
              "content-disposition": 'inline; filename="image.png"',
            }),
          };
        });
      if (variant === "valid")
        expect(await proofsApi.content(actorId, signal)).toBe(bytes);
      else
        await expect(proofsApi.content(actorId, signal)).rejects.toMatchObject({
          category: "contract",
        });
    },
  );
});
