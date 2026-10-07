import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { code, emptyPage } from "@/test/p05-network";
import { adminTaskCodesApi } from "./task-codes.api";

cleanupNetwork();
describe("code consumer contract", () => {
  it("normalizes code creation and uses the actual audit route", async () => {
    networkSession("ADMIN");
    const requests: string[] = [];
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        requests.push(config.url ?? "");
        if (config.method === "post")
          expect(JSON.parse(String(config.data))).toMatchObject({
            code: "CODE",
            confirmed: true,
            taskId: actorId,
          });
        return reply(config, config.method === "post" ? code : emptyPage());
      });
    expect(
      await adminTaskCodesApi.create({
        commandId: otherId,
        confirmed: true,
        taskId: actorId,
        code: " code ",
        state: "ENABLED",
      }),
    ).toEqual(code);
    expect(
      await adminTaskCodesApi.audit(actorId, { page: 1, limit: 25 }),
    ).toEqual(emptyPage());
    expect(requests).toEqual([
      "/admin/task-codes",
      `/admin/task-codes/${actorId}/changes`,
    ]);
  });
});
