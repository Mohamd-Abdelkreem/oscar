import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { test as base, expect } from "@playwright/test";
import {
  controlReplySchema,
  type ControlReply,
  type ControlRequest,
} from "../../../api/tests/e2e/control.js";

import {
  prepareWeb,
  startWeb,
  stopOwnedProcess,
  requireFreePort,
} from "./start-web.mjs";

type ControlInput = ControlRequest extends infer Request
  ? Request extends ControlRequest
    ? Omit<Request, "id">
    : never
  : never;
export type Scenario = {
  command: (input: ControlInput) => Promise<ControlReply["data"]>;
};
const apiDirectory = fileURLToPath(new URL("../../../api/", import.meta.url));

const startApi = async (): Promise<{
  child: ChildProcess;
  scenario: Scenario;
}> => {
  await requireFreePort(4103);
  const child = spawn(
    process.execPath,
    ["--conditions=development", "--import", "tsx", "tests/e2e/server.ts"],
    {
      cwd: apiDirectory,
      env: { ...process.env },
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    },
  );
  let sequence = 0;
  const observers = new Map<number, (reply: ControlReply) => void>();
  child.on("message", (input: unknown) => {
    const reply = controlReplySchema.safeParse(input);
    if (reply.success) observers.get(reply.data.id)?.(reply.data);
  });
  const waitFor = (id: number, timeout: number): Promise<ControlReply> =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        clear();
        reject(new Error("P03_IPC_TIMEOUT"));
      }, timeout);
      const exited = () => {
        clear();
        reject(new Error("P03_API_EXITED"));
      };
      const clear = () => {
        clearTimeout(deadline);
        observers.delete(id);
        child.off("exit", exited);
        child.off("error", exited);
      };
      observers.set(id, (reply) => {
        clear();
        if (reply.status === "failed") reject(new Error("P03_API_FAILED"));
        else resolve(reply);
      });
      child.once("exit", exited);
      child.once("error", exited);
    });
  try {
    await waitFor(0, 240_000);
  } catch {
    if (child.connected) child.disconnect();
    await stopOwnedProcess(child);
    throw new Error("P03_API_START_FAILED");
  }
  return {
    child,
    scenario: {
      command: async (input) => {
        sequence++;
        const pending = waitFor(sequence, 30_000);
        child.send({ ...input, id: sequence });
        return (await pending).data;
      },
    },
  };
};

export const test = base.extend<
  { scenario: Scenario; privateDiagnostics: undefined },
  { builtWeb: undefined }
>({
  privateDiagnostics: [
    async ({ page }, runFixture, testInfo) => {
      await runFixture(undefined);
      if (testInfo.errors.length === 0) return;
      // Playwright 1.63 copies private DOM/source into error-context.md even with tracing off.
      for (const error of testInfo.errors) {
        const infrastructureCode = error.message?.match(
          /\bP03_(?:BUILD_FAILED|WEB_START_FAILED|API_START_FAILED|API_FAILED|IPC_TIMEOUT|API_EXITED)\b/u,
        )?.[0];
        const location = error.stack?.match(
          /(?:identity-and-admin-access|auth-account|ui-preservation|packages-and-subscriptions|wallet-and-ledger|referrals)\.spec\.ts:(\d+):(\d+)/u,
        );
        error.message =
          infrastructureCode ??
          (location === undefined || location === null
            ? "P03_CHECK_FAILED"
            : `P03_CHECK_FAILED_AT_${location[1] ?? "0"}_${location[2] ?? "0"}`);
        delete error.stack;
        delete error.value;
        delete error.errorContext;
      }
      await page.close();
    },
    { auto: true },
  ],
  builtWeb: [
    async ({ playwright: _playwright }, runFixture) => {
      await prepareWeb();
      await runFixture(undefined);
    },
    { scope: "worker" },
  ],
  scenario: [
    async ({ builtWeb: _builtWeb, context }, runFixture) => {
      const { child, scenario } = await startApi();
      let web: ChildProcess | undefined;
      try {
        web = await startWeb();
        await runFixture(scenario);
      } finally {
        // Stop browser prefetch and in-flight reads before their owned services.
        await context.close();
        if (web !== undefined) await stopOwnedProcess(web);
        try {
          await scenario.command({ command: "stop" });
        } catch {
          if (child.connected) child.disconnect();
        }
        await stopOwnedProcess(child);
      }
    },
    { auto: true },
  ],
});
export { expect };
