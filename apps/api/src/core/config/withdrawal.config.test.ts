import { describe, expect, it } from "vitest";
import {
  parseWithdrawalEnvironment,
  parseWithdrawalQueueEnvironment,
  parseWithdrawalSignerEnvironment,
} from "./withdrawal.config.js";

describe("withdrawal proof and quote configuration", () => {
  it("uses the initial policy and accepts bounded nondefault durations", () => {
    expect(parseWithdrawalEnvironment({})).toEqual({
      addressTokenTtlSeconds: 1800,
      addressResendCooldownSeconds: 60,
      quoteTtlSeconds: 600,
    });
    expect(
      parseWithdrawalEnvironment({
        WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS: "60",
        WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS: "3600",
        WITHDRAWAL_QUOTE_TTL_SECONDS: "3600",
      }),
    ).toEqual({
      addressTokenTtlSeconds: 60,
      addressResendCooldownSeconds: 3600,
      quoteTtlSeconds: 3600,
    });
  });
  it.each([
    ["WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS", "59"],
    ["WITHDRAWAL_QUOTE_TTL_SECONDS", "3601"],
    ["WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS", "0"],
    ["WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS", "1e3"],
    ["WITHDRAWAL_QUOTE_TTL_SECONDS", "600.5"],
    ["WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS", " 60"],
    ["WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS", ""],
  ])("rejects invalid %s without echoing configuration", (key, setting) => {
    expect(() => parseWithdrawalEnvironment({ [key]: setting })).toThrow(key);
  });
});

describe("private payout scan configuration", () => {
  it("admits bounded independent payout scans without Redis configuration", () => {
    expect(parseWithdrawalSignerEnvironment({})).toEqual({
      scanIntervalMs: 1000,
      repairIntervalMs: 30000,
      batchSize: 20,
      pendingAlertAfterMs: 300000,
    });
    expect(
      parseWithdrawalSignerEnvironment({
        WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS: "100",
        WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS: "1000",
        WITHDRAWAL_PAYOUT_SCAN_BATCH_SIZE: "100",
        WITHDRAWAL_PENDING_ALERT_AFTER_MS: "1000",
      }),
    ).toEqual({
      scanIntervalMs: 100,
      repairIntervalMs: 1000,
      batchSize: 100,
      pendingAlertAfterMs: 1000,
    });
    expect(
      parseWithdrawalSignerEnvironment({
        WITHDRAWAL_PENDING_ALERT_AFTER_MS: "86400000",
      }).pendingAlertAfterMs,
    ).toBe(86400000);
  });
  it.each([
    ["WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS", "99"],
    ["WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS", "60001"],
    ["WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS", "999"],
    ["WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS", "300001"],
    ["WITHDRAWAL_PAYOUT_SCAN_BATCH_SIZE", "101"],
    ["WITHDRAWAL_PAYOUT_SCAN_BATCH_SIZE", "1e2"],
    ["WITHDRAWAL_PENDING_ALERT_AFTER_MS", "999"],
    ["WITHDRAWAL_PENDING_ALERT_AFTER_MS", "86400001"],
    ["WITHDRAWAL_PENDING_ALERT_AFTER_MS", "1000.5"],
    ["WITHDRAWAL_PENDING_ALERT_AFTER_MS", "1e3"],
    ["WITHDRAWAL_PENDING_ALERT_AFTER_MS", " 1000"],
    ["WITHDRAWAL_PENDING_ALERT_AFTER_MS", ""],
  ])("rejects unbounded private scan %s", (key, setting) => {
    expect(() => parseWithdrawalSignerEnvironment({ [key]: setting })).toThrow(
      key,
    );
  });
  it("rejects authoritative repair faster than the configured hinted scan", () => {
    expect(() =>
      parseWithdrawalSignerEnvironment({
        WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS: "60000",
      }),
    ).toThrow("WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS");
  });
});

describe("withdrawal queue configuration", () => {
  it("requires an explicit supported Redis connection and bounded queue settings", () => {
    const config = parseWithdrawalQueueEnvironment({
      WITHDRAWAL_REDIS_URL: "rediss://queue.example.com:6380/1",
      WITHDRAWAL_SCAN_BATCH_SIZE: "200",
      WITHDRAWAL_QUEUE_PREFIX: "tenant-queue",
    });
    expect(config).toMatchObject({
      redisUrl: "rediss://queue.example.com:6380/1",
      batchSize: 200,
      prefix: "tenant-queue",
      scanIntervalMs: 1000,
    });
    expect(() => parseWithdrawalQueueEnvironment({})).toThrow(
      "WITHDRAWAL_REDIS_URL",
    );
  });
  it.each([
    ["WITHDRAWAL_REDIS_URL", "http://queue.example.com"],
    ["WITHDRAWAL_REDIS_URL", "redis://queue.example.com/0?secret=1"],
    ["WITHDRAWAL_QUEUE_PREFIX", "bad:prefix"],
    ["WITHDRAWAL_SCAN_BATCH_SIZE", "201"],
    ["WITHDRAWAL_SCAN_INTERVAL_MS", "0"],
    ["WITHDRAWAL_SCAN_INTERVAL_MS", "99"],
    ["WITHDRAWAL_SCAN_INTERVAL_MS", "60001"],
    ["WITHDRAWAL_PRODUCER_TIMEOUT_MS", "10001"],
    ["WITHDRAWAL_JOB_ATTEMPTS", "11"],
    ["WITHDRAWAL_JOB_RETRY_DELAY_MS", "1e3"],
    ["WITHDRAWAL_RETAINED_JOBS", "10001"],
  ])("rejects malformed %s without retaining its contents", (key, setting) => {
    expect(() =>
      parseWithdrawalQueueEnvironment({
        WITHDRAWAL_REDIS_URL: "redis://localhost:6379/0",
        [key]: setting,
      }),
    ).toThrow(key);
  });
});
