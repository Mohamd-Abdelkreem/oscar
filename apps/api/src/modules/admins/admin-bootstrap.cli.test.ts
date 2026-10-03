import { describe, expect, it } from "vitest";

import { runBootstrapCli } from "./admin-bootstrap.cli.js";

const identity = {
  platform: "linux",
  realUid: 1000,
  effectiveUid: 1000,
  osUid: 1000,
  username: "protected-operator",
};
const command = {
  fullName: "First Administrator",
  email: "bootstrap@example.com",
  password: "test-only-bootstrap-password",
  reason: "Authorized initial setup",
};

describe("protected bootstrap CLI", () => {
  it.each([
    [undefined, identity],
    ["0", identity],
    [" 1000", identity],
    ["4294967295", identity],
    ["1000", { ...identity, platform: "win32" }],
    ["1000", { ...identity, realUid: undefined }],
    ["1000", { ...identity, effectiveUid: 0 }],
    ["1000", { ...identity, osUid: 1001 }],
    ["1000", { ...identity, username: "" }],
    ["1000", { ...identity, username: "x".repeat(129) }],
  ])(
    "denies unavailable/mismatched operator before input or provisioning (%s)",
    async (configuredUid, observed) => {
      let inputRead = false;
      let provisioned = false;
      const output: string[] = [];
      const status = await runBootstrapCli({
        configuredUid,
        argv: [],
        identity: () => observed,
        input: {
          async *[Symbol.asyncIterator]() {
            inputRead = true;
            yield await Promise.resolve(JSON.stringify(command));
          },
        },
        provision: () => {
          provisioned = true;
          throw new Error("unexpected provisioning");
        },
        output: (message) => output.push(message),
      });
      expect(status).toBe(1);
      expect(inputRead).toBe(false);
      expect(provisioned).toBe(false);
      expect(output.join("")).not.toContain(command.password);
    },
  );
  it.each([
    JSON.stringify(command),
    "{",
    "x".repeat(8193),
    JSON.stringify({ ...command, actor: "forged" }),
  ])(
    "uses bounded strict stdin and safe completion/failure output",
    async (body) => {
      const output: string[] = [];
      const status = await runBootstrapCli({
        configuredUid: "1000",
        argv: [],
        identity: () => identity,
        input: {
          async *[Symbol.asyncIterator]() {
            yield await Promise.resolve(body);
          },
        },
        provision: (input, operator) => {
          expect(input).toEqual(command);
          expect(operator).toEqual({
            uid: 1000,
            username: "protected-operator",
          });
          return Promise.resolve({
            userId: "7ac773b4-e4a6-4fd2-af7e-30a26d2c570e",
          });
        },
        output: (message) => output.push(message),
      });
      expect(status).toBe(body === JSON.stringify(command) ? 0 : 1);
      expect(output.join("")).not.toContain(command.password);
    },
  );
  it("refuses argv credentials, unavailable OS observations and provider diagnostics", async () => {
    for (const argv of [[command.password], []]) {
      const output: string[] = [];
      const status = await runBootstrapCli({
        configuredUid: "1000",
        argv,
        identity: () => identity,
        input: {
          async *[Symbol.asyncIterator]() {
            yield await Promise.resolve(JSON.stringify(command));
          },
        },
        provision: () => Promise.reject(new Error(command.password)),
        output: (message) => output.push(message),
      });
      expect(status).toBe(1);
      expect(output.join("")).not.toContain(command.password);
    }
  });
});
