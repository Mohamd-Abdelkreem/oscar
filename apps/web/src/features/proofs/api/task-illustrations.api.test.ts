import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  now,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { taskIllustrationsApi } from "./task-illustrations.api";

cleanupNetwork();
describe("illustration purpose authority", () => {
  it("uses admin intake and shared authenticated read namespaces with purpose validation", async () => {
    networkSession("ADMIN");
    const requests: string[] = [];
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        requests.push(config.url ?? "");
        return reply(
          config,
          config.method === "post"
            ? {
                commandId: actorId,
                purpose: "TASK_ILLUSTRATION",
                state: "FAILED",
                failureCode: "UPLOAD_CANCELLED",
                failedAt: now,
              }
            : {
                id: actorId,
                purpose: "PROOF",
                uploadedAt: now,
                width: 1,
                height: 1,
                contentType: "image/png",
                byteCount: 8,
                availability: "PRESENT",
              },
        );
      });
    expect(
      (await taskIllustrationsApi.cancel(actorId, { confirmed: true })).state,
    ).toBe("FAILED");
    await expect(taskIllustrationsApi.metadata(actorId)).rejects.toMatchObject({
      category: "contract",
    });
    expect(requests).toEqual([
      `/admin/task-illustrations/uploads/${actorId}/cancel`,
      `/task-illustrations/${actorId}`,
    ]);
  });
});
