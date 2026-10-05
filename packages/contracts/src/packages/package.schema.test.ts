import { describe, expect, it } from "vitest";
import {
  adminCatalogItemSchema,
  catalogSchema,
  configurationErrorCodeSchema,
  configurationOutcomeSchema,
  configurationResultSchema,
  packageEditSchema,
  packageTermsSchema,
  referralEditSchema,
} from "./package.schema.ts";
import { p04Id, p04Now, p04Terms } from "../testing/p04-fixtures.ts";

const command = {
  commandId: p04Id,
  expectedVersion: 1,
  reason: "future terms",
  confirmed: true,
};
describe("package configuration and immutable terms", () => {
  it("validates all five ordered approved terms and separates live counts", () => {
    const items = [
      ["S1", "60", "2", "730"],
      ["S2", "120", "4", "1460"],
      ["O1", "600", "16", "5840"],
      ["O2", "1200", "38", "13870"],
      ["A1", "2600", "67", "24455"],
    ].map(([code, price, dailyReward, conditionalGross], index) => ({
      ...p04Terms,
      code,
      price,
      dailyReward,
      conditionalGross,
      tierOrder: index + 1,
    }));
    expect(
      catalogSchema.parse({ items, serverNow: p04Now }).items,
    ).toHaveLength(5);
    expect(
      catalogSchema.safeParse({
        items: [...items].reverse(),
        serverNow: p04Now,
      }).success,
    ).toBe(false);
    expect(
      adminCatalogItemSchema.parse({
        terms: p04Terms,
        activeSubscriptionsCount: 0,
      }).terms,
    ).toEqual(p04Terms);
    for (const count of [
      undefined,
      null,
      -1,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
      "0",
    ])
      expect(
        adminCatalogItemSchema.safeParse({
          terms: p04Terms,
          activeSubscriptionsCount: count,
        }).success,
      ).toBe(false);
    expect(
      packageTermsSchema.safeParse({ ...p04Terms, activeSubscriptionsCount: 0 })
        .success,
    ).toBe(false);
  });
  it.each([
    { tierOrder: 2 },
    { price: "0" },
    { price: "60.0" },
    { dailyReward: "bad" },
    { conditionalGross: "729.999999" },
    {
      dailyReward: "9223372036854.775807",
      conditionalGross: "9223372036854.775807",
    },
    { countedWorkDates: 2147483648 },
    { countedWorkDates: 0 },
    { version: 0 },
    { withdrawalFeeBps: 10001 },
    { calendar: { ...p04Terms.calendar, workdays: [1, 2, 3, 4, 5, 6] } },
  ])("rejects unrepresentable or inconsistent terms %j", (patch) => {
    expect(
      packageTermsSchema.safeParse({ ...p04Terms, ...patch }).success,
    ).toBe(false);
  });
  it("distinguishes omitted edits from null and forbids client authority", () => {
    expect(
      packageEditSchema.parse({ ...command, price: "61" }),
    ).not.toHaveProperty("dailyReward");
    expect(
      packageEditSchema.parse({
        ...command,
        expectedVersion: 2147483646,
        withdrawalFeeBps: 0,
      }).expectedVersion,
    ).toBe(2147483646);
    for (const patch of [
      {},
      { price: null },
      { price: "" },
      { price: "1", expectedVersion: 2147483647 },
      { price: "1", confirmed: false },
      { price: "1", reason: "  " },
      { price: "1", commandId: "bad" },
      ...["actorUserId", "tierOrder", "code", "calendar", "ownerId"].map(
        (field) => ({ price: "1", [field]: "forged" }),
      ),
    ])
      expect(
        packageEditSchema.safeParse({ ...command, ...patch }).success,
      ).toBe(false);
    expect(
      referralEditSchema.parse({
        ...command,
        ratesBps: [1200, 600, 400, 200, 200],
      }).ratesBps,
    ).toHaveLength(5);
    for (const ratesBps of [
      [1200],
      [0, 0, 0, 0, 0, 0],
      [0, 0, -1, 0, 0],
      [0, 0, 10001, 0, 0],
    ])
      expect(
        referralEditSchema.safeParse({ ...command, ratesBps }).success,
      ).toBe(false);
  });
  it("requires matching saved target/counters and explicit recovery status", () => {
    const change = {
      changeId: p04Id,
      commandId: p04Id,
      target: { kind: "PACKAGE", packageCode: "S1" },
      occurredAt: p04Now,
      expectedVersion: 1,
      committedVersion: 2,
      reason: "future terms",
      before: p04Terms,
      after: { ...p04Terms, version: 2, price: "61" },
      replayed: true,
    };
    expect(configurationResultSchema.parse(change).replayed).toBe(true);
    expect(
      configurationResultSchema.safeParse({ ...change, committedVersion: 3 })
        .success,
    ).toBe(false);
    expect(
      configurationOutcomeSchema.parse({
        status: "COMMITTED",
        commandId: p04Id,
        change,
        serverNow: p04Now,
      }).status,
    ).toBe("COMMITTED");
    expect(
      configurationOutcomeSchema.parse({
        status: "NOT_OBSERVED",
        commandId: p04Id,
        serverNow: p04Now,
      }).status,
    ).toBe("NOT_OBSERVED");
    expect(configurationErrorCodeSchema.parse("CONFIGURATION_SUPERSEDED")).toBe(
      "CONFIGURATION_SUPERSEDED",
    );
  });
});
