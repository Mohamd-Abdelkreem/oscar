import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { day, submission } from "@/test/p05-network";
import { employeeTasksApi } from "./tasks.api";

cleanupNetwork();
describe("employee task wire authority", () => {
  it("validates current day and preserves pending captured reward without money requests", async () => {
    networkSession();
    const requests: string[] = [];
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        requests.push(config.url ?? "");
        if (config.method === "post")
          expect(JSON.parse(String(config.data))).toEqual({
            commandId: otherId,
            taskId: actorId,
            expectedTaskRevision: 1,
            proofAssetId: otherId,
            declaredExecuted: true,
          });
        return reply(config, config.url === "/tasks/today" ? day : submission);
      });
    expect(await employeeTasksApi.today()).toEqual(day);
    expect(
      (
        await employeeTasksApi.submit({
          commandId: otherId,
          taskId: actorId,
          expectedTaskRevision: 1,
          proofAssetId: otherId,
          declaredExecuted: true,
        })
      ).status,
    ).toBe("PENDING");
    expect(requests).toEqual(["/tasks/today", "/task-submissions"]);
  });
  it.each([
    { ...day, token: "PRIVATE" },
    { ...day, canSubmit: true },
  ])("rejects malformed day without fixture success", async (raw) => {
    networkSession();
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, raw));
    await expect(employeeTasksApi.today()).rejects.toMatchObject({
      category: "contract",
    });
  });
  it("rejects foreign details and malformed declaration before dispatch", async () => {
    networkSession();
    let requests = 0;
    apiClient.defaults.adapter = (config) => {
      requests++;
      return Promise.resolve(reply(config, submission));
    };
    await expect(employeeTasksApi.detail(otherId)).rejects.toMatchObject({
      category: "contract",
    });
    await expect(
      employeeTasksApi.submit({
        commandId: otherId,
        taskId: actorId,
        expectedTaskRevision: 1,
        proofAssetId: otherId,
        declaredExecuted: false,
      }),
    ).rejects.toMatchObject({ category: "request" });
    expect(requests).toBe(1);
  });
});
