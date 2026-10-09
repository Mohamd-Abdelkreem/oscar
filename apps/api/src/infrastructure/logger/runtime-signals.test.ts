import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";
import { RuntimeSignals } from "./runtime-signals.js";
import { z } from "zod";

describe("protected operator signals", () => {
  it("bounds distinct attempt alerts during a large outage and aggregates overflow reminders", () => {
    const output: string[] = [];
    let now = new Date("2026-10-08T09:00:00Z");
    const signals = new RuntimeSignals(
      createLogger({
        level: "info",
        pretty: false,
        destination: {
          write: (chunk) => {
            output.push(chunk);
          },
        },
      }),
      () => now,
    );
    for (let index = 0; index < 1100; index++) {
      signals.observe("UNRESOLVED_ATTEMPT", true, {
        attemptId: `11111111-1111-4111-8111-${index.toString(16).padStart(12, "0")}`,
      });
    }
    expect(output).toHaveLength(1025);
    now = new Date(now.getTime() + 300000);
    signals.observe("UNRESOLVED_ATTEMPT", true, {
      attemptId: "11111111-1111-4111-8111-ffffffffffff",
    });
    expect(output).toHaveLength(1026);
    expect(
      z
        .object({ state: z.string(), count: z.number() })
        .parse(JSON.parse(output.at(-1) ?? "{}")),
    ).toMatchObject({ state: "REMINDER", count: 1025 });
  });
  it("delivers active, bounded reminder and cleared transitions through the actual JSON sink", () => {
    const output: string[] = [];
    let now = new Date("2026-10-08T09:00:00Z");
    const signals = new RuntimeSignals(
      createLogger({
        level: "info",
        pretty: false,
        destination: {
          write: (chunk) => {
            output.push(chunk);
          },
        },
      }),
      () => now,
    );
    const metadata = {
      processKind: "SIGNER" as const,
      withdrawalId: "11111111-1111-4111-8111-111111111111",
      code: "LIQUIDITY_SHORTFALL",
    };
    signals.observe("LIQUIDITY_SHORTFALL", true, metadata);
    signals.observe("LIQUIDITY_SHORTFALL", true, metadata);
    now = new Date(now.getTime() + 300000);
    signals.observe("LIQUIDITY_SHORTFALL", true, metadata);
    signals.observe("LIQUIDITY_SHORTFALL", false, metadata);
    signals.observe("LIQUIDITY_SHORTFALL", false, metadata);
    expect(
      output.map(
        (line) => z.object({ state: z.string() }).parse(JSON.parse(line)).state,
      ),
    ).toEqual(["ACTIVE", "REMINDER", "CLEARED"]);
  });
  it("strips hostile metadata and rejects credentials in retained safe fields", () => {
    const output: string[] = [];
    const signals = new RuntimeSignals(
      createLogger({
        level: "info",
        pretty: false,
        destination: {
          write: (chunk) => {
            output.push(chunk);
          },
        },
      }),
      () => new Date(),
    );
    const hostile = {
      processKind: "SIGNER" as const,
      code: "RECOVERY_UNAVAILABLE",
      privateKey: "sentinel-private-key",
      payload: { signature: "sentinel-signed-bytes" },
      url: "https://private.test/#credential",
    };
    signals.observe("RECOVERY_UNAVAILABLE", true, hostile);
    expect(output.join("")).not.toMatch(/sentinel|credential|private\.test/u);
    expect(() => {
      signals.observe("RECOVERY_UNAVAILABLE", true, {
        code: "secret-token-value",
      });
    }).toThrow();
    expect(output).toHaveLength(1);
  });
});
