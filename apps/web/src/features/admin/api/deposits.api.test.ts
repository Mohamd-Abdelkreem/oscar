import { describe, expect, it } from "vitest";
import { apiClient } from "@/services/api/api-client";
import { cleanupNetwork, networkSession, reply } from "@/test/p04-network";
import {
  emptyAdminDepositHistory,
  recordedAdminDepositHistory,
} from "@/test/p07-deposits";
import { depositsApi } from "./deposits.api";
import {
  manualCreditBody,
  manualCreditOutcome,
  manualCreditTargets,
} from "@/test/p07-deposits";

describe("manual grant validated transport", () => {
  it("reads bounded live minimal targets and rejects private output", async () => {
    networkSession("ADMIN");
    apiClient.defaults.adapter = (config) => {
      expect(config.url).toBe("/admin/employees/manual-credit-targets");
      expect(config.params).toEqual({ page: 1, limit: 25 });
      return Promise.resolve(reply(config, manualCreditTargets));
    };
    expect(await depositsApi.targets({ page: 1, limit: 25 })).toEqual(
      manualCreditTargets,
    );
    await expect(
      depositsApi.targets({ page: 0, limit: 25 }),
    ).rejects.toMatchObject({ category: "request" });
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(
        reply(config, {
          ...manualCreditTargets,
          items: manualCreditTargets.items.map((row) => ({
            ...row,
            wallet: "SENTINEL",
          })),
        }),
      );
    await expect(
      depositsApi.targets({ page: 1, limit: 25 }),
    ).rejects.toMatchObject({ category: "contract" });
  });
  it.each([201, 200])(
    "matches %s grant intent and original identity without label equality",
    async (status) => {
      networkSession("ADMIN");
      apiClient.defaults.adapter = (config) => {
        expect(config.method).toBe("post");
        expect(JSON.parse(String(config.data))).toEqual(manualCreditBody);
        expect(config.headers.get("Idempotency-Key")).toBe(
          manualCreditBody.actionId,
        );
        const response = reply(config, {
          ...manualCreditOutcome,
          replayed: status === 200,
        });
        response.status = status;
        response.data.statusCode = status;
        return Promise.resolve(response);
      };
      expect((await depositsApi.grant(manualCreditBody)).amount).toBe(
        "1.000001",
      );
    },
  );
  it.each([
    "amount",
    "reason",
    "reference",
    "employee",
    "actor",
    "action",
    "replay",
    "secret",
  ])("fails closed on %s reply mismatch", async (fault) => {
    networkSession("ADMIN");
    const validOutcome = { ...manualCreditOutcome, replayed: true };
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, validOutcome));
    await expect(depositsApi.grant(manualCreditBody)).resolves.toEqual(
      validOutcome,
    );
    const result = {
      ...validOutcome,
      ...(fault === "amount"
        ? { amount: "2" }
        : fault === "reason"
          ? { reason: "Another reason" }
          : fault === "reference"
            ? { reference: { kind: "EXTERNAL", value: "another" } }
            : fault === "employee"
              ? { employeeId: manualCreditBody.actionId }
              : fault === "actor"
                ? {
                    actor: {
                      ...manualCreditOutcome.actor,
                      id: manualCreditBody.employeeId,
                    },
                  }
                : fault === "action"
                  ? { actionId: manualCreditBody.employeeId }
                  : fault === "replay"
                    ? { replayed: false }
                    : { secret: "SENTINEL" }),
    };
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(reply(config, result));
    await expect(depositsApi.grant(manualCreditBody)).rejects.toMatchObject({
      category: fault === "secret" ? "contract" : "uncertain",
      code: "CONTRACT_ERROR",
    });
  });
  it("rejects invalid precision and forged request authority before dispatch", async () => {
    networkSession("ADMIN");
    let writes = 0;
    apiClient.defaults.adapter = (config) => {
      writes++;
      return Promise.resolve(reply(config, manualCreditOutcome));
    };
    await expect(
      depositsApi.grant({ ...manualCreditBody, amount: "1.0000001" }),
    ).rejects.toMatchObject({ category: "request" });
    const forged = { ...manualCreditBody, actor: manualCreditOutcome.actor };
    await expect(depositsApi.grant(forged)).rejects.toMatchObject({
      category: "request",
    });
    expect(writes).toBe(0);
  });
  it("observes only the original action with stable actor identity and never replays a failed POST", async () => {
    networkSession("ADMIN");
    let writes = 0;
    apiClient.defaults.adapter = (config) => {
      if (config.method === "post") {
        writes++;
        return Promise.reject(new Error("SENTINEL"));
      }
      expect(config.url).toBe(
        `/admin/deposits/manual-credits/${manualCreditBody.actionId}`,
      );
      return Promise.resolve(reply(config, manualCreditOutcome));
    };
    await expect(depositsApi.grant(manualCreditBody)).rejects.toBeDefined();
    expect(await depositsApi.outcome(manualCreditBody.actionId)).toEqual(
      manualCreditOutcome,
    );
    expect(writes).toBe(1);
  });
});

cleanupNetwork();
describe("admin deposit history boundary", () => {
  it("sends bounded normalized search/kind and preserves genuine exact private facts", async () => {
    networkSession("ADMIN");
    const signal = new AbortController().signal;
    apiClient.defaults.adapter = (config) =>
      Promise.resolve().then(() => {
        expect(config.url).toBe("/admin/deposits");
        expect(config.params).toEqual({ page: 1, limit: 10, q: "employee" });
        expect(config.signal).toBe(signal);
        return reply(config, recordedAdminDepositHistory);
      });
    expect(
      await depositsApi.history(
        { page: 1, limit: 10, q: " employee " },
        signal,
      ),
    ).toEqual(recordedAdminDepositHistory);
  });
  it.each(["page", "kind", "employee", "private", "amount"])(
    "rejects mismatched or malformed %s output",
    async (fault) => {
      networkSession("ADMIN");
      const query = { page: 1, limit: 10, kind: "CHAIN_DEPOSIT" as const };
      const validPage = {
        ...recordedAdminDepositHistory,
        pagination: { ...recordedAdminDepositHistory.pagination, total: 1 },
        items: recordedAdminDepositHistory.items.filter(
          (row) => row.kind === "CHAIN_DEPOSIT",
        ),
      };
      apiClient.defaults.adapter = (config) =>
        Promise.resolve(reply(config, validPage));
      await expect(depositsApi.history(query)).resolves.toEqual(validPage);
      const page =
        fault === "page"
          ? {
              ...validPage,
              pagination: { ...validPage.pagination, limit: 25 },
            }
          : fault === "kind"
            ? recordedAdminDepositHistory
            : {
                ...validPage,
                items: validPage.items.map((row) =>
                  fault === "private"
                    ? { ...row, secret: "SENTINEL" }
                    : fault === "amount"
                      ? { ...row, amount: "1.0000001" }
                      : fault === "employee"
                        ? { ...row, employee: null }
                        : row,
                ),
              };
      apiClient.defaults.adapter = (config) =>
        Promise.resolve(reply(config, page));
      await expect(depositsApi.history(query)).rejects.toMatchObject({
        category: "contract",
      });
    },
  );
  it("rejects unsupported filters and unsafe offsets before sending", async () => {
    networkSession("ADMIN");
    let reads = 0;
    apiClient.defaults.adapter = (config) => {
      reads++;
      return Promise.resolve(reply(config, emptyAdminDepositHistory));
    };
    await expect(
      depositsApi.history({ page: Number.MAX_SAFE_INTEGER, limit: 100 }),
    ).rejects.toMatchObject({ category: "request" });
    expect(reads).toBe(0);
  });
});
