import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import {
  actorId,
  otherId,
  networkSession,
  reply,
  cleanupNetwork,
} from "@/test/p04-network";
import { adminSubmission } from "@/test/p05-network";
import { adminTaskSubmissionsApi } from "./task-submissions.api";

cleanupNetwork();
describe("reasoned final review boundary", () => {
  it.each([
    { confirmed: false, reason: "reason", expectedEvidenceVersion: 1 },
    { confirmed: true, reason: "", expectedEvidenceVersion: 1 },
    { confirmed: true, reason: "reason" },
  ])(
    "rejects incomplete reviewed intent before any dispatch",
    async (fields) => {
      networkSession("ADMIN");
      let sends = 0;
      apiClient.defaults.adapter = (config) => {
        sends++;
        return Promise.resolve(reply(config, adminSubmission));
      };
      await expect(
        adminTaskSubmissionsApi.review(actorId, {
          commandId: otherId,
          expectedSubmissionVersion: 1,
          decision: "APPROVE",
          ...fields,
        }),
      ).rejects.toMatchObject({ category: "request" });
      expect(sends).toBe(0);
    },
  );
  it("rejects pending success for a final approval without inventing finality", async () => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, adminSubmission));
    await expect(
      adminTaskSubmissionsApi.review(actorId, {
        commandId: otherId,
        confirmed: true,
        expectedSubmissionVersion: 1,
        expectedEvidenceVersion: 1,
        decision: "APPROVE",
        reason: "checked",
      }),
    ).rejects.toMatchObject({ category: "contract" });
  });
});
