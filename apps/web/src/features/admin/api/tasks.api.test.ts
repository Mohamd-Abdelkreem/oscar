import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { task } from "@/test/p05-network";
import { adminTasksApi } from "./tasks.api";

cleanupNetwork();
describe("confirmed task editing", () => {
  it("requires distinct confirmation and rejects wrong-resource or private successful details", async () => {
    networkSession("ADMIN");
    let sends = 0;
    apiClient.defaults.adapter = (config) => {
      sends++;
      return Promise.resolve(reply(config, task));
    };
    await expect(
      adminTasksApi.edit(actorId, {
        commandId: otherId,
        expectedTaskRevision: 1,
        title: "Changed",
      }),
    ).rejects.toMatchObject({ category: "request" });
    await expect(adminTasksApi.detail(otherId)).rejects.toMatchObject({
      category: "contract",
    });
    expect(sends).toBe(1);
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, { ...task, storagePath: "PRIVATE" }));
    await expect(adminTasksApi.detail(actorId)).rejects.toMatchObject({
      category: "contract",
    });
  });
});
