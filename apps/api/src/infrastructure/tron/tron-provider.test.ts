import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TronWeb } from "tronweb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  parseTronWorkerEnvironment,
  type TronWorkerConfig,
} from "../../core/config/tron.config.js";
import { TronProvider } from "./tron-provider.js";
import { TRANSFER_TOPIC } from "./tron-receipt.js";

const token = TronWeb.address.fromHex(`41${"11".repeat(20)}`);
const block = {
  blockID: "ab".repeat(32),
  block_header: { raw_data: { number: 0, timestamp: 1000 } },
};
let root: string;
let config: TronWorkerConfig;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "p06-provider-"));
  const credential = join(root, "provider.key");
  await writeFile(credential, "test-only-provider-sentinel", { mode: 0o600 });
  config = parseTronWorkerEnvironment(
    {
      TRON_NETWORK: "TRON_NILE",
      TRON_TOKEN_CONTRACT: token,
      TRON_EXPECTED_GENESIS_BLOCK_ID: block.blockID,
      TRON_PROVIDER_URL: "https://nile.trongrid.io",
      TRON_PROVIDER_API_KEY_FILE: credential,
    },
    process.cwd(),
  );
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});
const response = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body)));

describe("protected provider boundary", () => {
  it("builds and simulates the supplied original source/recipient/net and sends the retained object once", async () => {
    const source = TronWeb.address.fromHex(`41${"22".repeat(20)}`);
    const recipient = TronWeb.address.fromHex(`41${"33".repeat(20)}`);
    const transaction = { txID: "a".repeat(64), raw_data_hex: "abcd" };
    const calls: { path: string; body: unknown }[] = [];
    const provider = new TronProvider(config, (url, init) => {
      const path = new URL(url instanceof Request ? url.url : url).pathname;
      if (typeof init?.body !== "string")
        throw new Error("Expected JSON request body");
      const body: unknown = JSON.parse(init.body);
      calls.push({ path, body });
      if (path === "/wallet/triggersmartcontract")
        return response({ result: { result: true }, transaction });
      if (path === "/wallet/triggerconstantcontract")
        return response({
          result: { result: true },
          energy_used: 1000,
          transaction: { ret: [{ contractRet: "SUCCESS" }] },
          logs: [
            {
              address: TronWeb.address.toHex(token).slice(2).toLowerCase(),
              topics: [
                TRANSFER_TOPIC,
                TronWeb.address.toHex(source).slice(2).padStart(64, "0"),
                TronWeb.address.toHex(recipient).slice(2).padStart(64, "0"),
              ],
              data: 79000000n.toString(16).padStart(64, "0"),
            },
          ],
        });
      return response({ result: true, txid: transaction.txID });
    });
    expect(
      await provider.buildTransfer(source, recipient, 79000000n, 1000000n),
    ).toEqual(transaction);
    expect(await provider.estimateTransfer(source, recipient, 79000000n)).toBe(
      1000,
    );
    expect(await provider.broadcastTransfer(transaction)).toBe(true);
    expect(calls).toHaveLength(3);
    expect(calls[0]?.body).toMatchObject({
      owner_address: TronWeb.address.toHex(source),
      contract_address: TronWeb.address.toHex(token),
      function_selector: "transfer(address,uint256)",
      parameter:
        TronWeb.address.toHex(recipient).slice(2).padStart(64, "0") +
        79000000n.toString(16).padStart(64, "0"),
      call_value: 0,
      fee_limit: 1000000,
    });
    expect(calls[2]?.body).toEqual(transaction);
    await expect(
      provider.estimateTransfer(source, recipient, 0n),
    ).rejects.toThrow("TRON_INPUT_INVALID");
    expect(calls).toHaveLength(3);
  });
  it.each([
    "zero-return-transfer",
    "failed-vm",
    "missing-log",
    "different-token",
    "different-recipient",
    "different-amount",
  ])("validates simulated transfer evidence for %s", async (scenario) => {
    const source = TronWeb.address.fromHex(`41${"22".repeat(20)}`);
    const treasury = TronWeb.address.fromHex(`41${"33".repeat(20)}`);
    const payload = {
      result: { result: true },
      energy_used: 29650,
      constant_result: ["0".repeat(64)],
      transaction: {
        ret: scenario === "failed-vm" ? [{ ret: "FAILED" }] : [{}],
      },
      logs:
        scenario === "missing-log"
          ? []
          : [
              {
                address: TronWeb.address
                  .toHex(scenario === "different-token" ? source : token)
                  .slice(2)
                  .toLowerCase(),
                topics: [
                  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                  TronWeb.address.toHex(source).slice(2).padStart(64, "0"),
                  TronWeb.address
                    .toHex(
                      scenario === "different-recipient" ? source : treasury,
                    )
                    .slice(2)
                    .padStart(64, "0"),
                ],
                data: (scenario === "different-amount" ? 1000000n : 1000001n)
                  .toString(16)
                  .padStart(64, "0"),
              },
            ],
    };
    const provider = new TronProvider(config, () => response(payload));
    const estimate = provider.estimateSweep(source, treasury, 1000001n);
    if (scenario === "zero-return-transfer")
      await expect(estimate).resolves.toBe(29650);
    else await expect(estimate).rejects.toThrow("TRON_MALFORMED");
  });
  it("accepts omitted protobuf zero fields only for the requested genesis", async () => {
    const omitted = { blockID: block.blockID, block_header: { raw_data: {} } };
    const provider = new TronProvider(config, () => response(omitted));
    expect(await provider.block(0)).toEqual({
      number: 0,
      timestamp: 0,
      id: block.blockID,
    });
    await expect(provider.block(1)).rejects.toThrow("TRON_MALFORMED");
    await expect(provider.transactionBlock(1)).rejects.toThrow(
      "TRON_MALFORMED",
    );
    await expect(provider.verifyIdentity()).rejects.toThrow("TRON_MALFORMED");
    const conflicting = new TronProvider(config, () =>
      response({ ...omitted, blockID: "cc".repeat(32) }),
    );
    await expect(conflicting.verifyIdentity()).rejects.toThrow(
      "TRON_IDENTITY_CONFLICT",
    );
  });
  it("omits the authentication header in public testnet mode and rejects anonymous mainnet", async () => {
    const provider = new TronProvider(
      { ...config, providerApiKeyFile: null },
      (_url, options) => {
        expect(new Headers(options?.headers).has("TRON-PRO-API-KEY")).toBe(
          false,
        );
        return response(block);
      },
    );
    expect((await provider.block(0)).id).toBe(block.blockID);
    expect(
      () =>
        new TronProvider({
          ...config,
          network: "TRON_MAINNET",
          providerApiKeyFile: null,
        }),
    ).toThrow("TRON_INPUT_INVALID");
  });
  it("aborts a stalled response body within the configured request timeout", async () => {
    const provider = new TronProvider(
      { ...config, providerTimeoutMs: 20, maximumAttempts: 1 },
      (_url, options) =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                options?.signal?.addEventListener(
                  "abort",
                  () => {
                    controller.error(
                      new DOMException("test-only timeout", "AbortError"),
                    );
                  },
                  { once: true },
                );
              },
            }),
          ),
        ),
    );
    await expect(provider.solidifiedFloor()).rejects.toThrow(
      "TRON_UNAVAILABLE",
    );
  });
  it("preserves solidified transaction/receipt identities and exact token units", async () => {
    const id = "de".repeat(32);
    const provider = new TronProvider(config, (url) => {
      const endpoint = new URL(url instanceof Request ? url.url : url).pathname;
      if (endpoint.endsWith("gettransactionbyid"))
        return response({ txID: id, raw_data: { contract: [] } });
      if (endpoint.endsWith("gettransactioninfobyid"))
        return response({
          id,
          log: [{ address: "raw", topics: [], data: "unfiltered" }],
          receipt: { result: "SUCCESS" },
        });
      return response({
        result: { result: true },
        constant_result: ["f".repeat(64)],
      });
    });
    expect(await provider.transaction(id)).toMatchObject({ txID: id });
    expect(await provider.transactionInfo(id)).toMatchObject({
      id,
      log: [{ data: "unfiltered" }],
    });
    expect(await provider.tokenBalance(token)).toBe((1n << 256n) - 1n);
  });
  it("pins genesis and decimals before returning a solidified floor with exact fixed URLs", async () => {
    const requests: URL[] = [];
    const provider = new TronProvider(config, async (url, options) => {
      const endpoint = new URL(url instanceof Request ? url.url : url);
      requests.push(endpoint);
      expect(options?.redirect).toBe("error");
      expect(options?.headers).toMatchObject({
        "TRON-PRO-API-KEY": "test-only-provider-sentinel",
      });
      return response(
        endpoint.pathname.endsWith("triggerconstantcontract")
          ? {
              result: { result: true },
              constant_result: ["0".repeat(63) + "6"],
            }
          : block,
      );
    });
    expect(await provider.solidifiedFloor()).toEqual({
      number: 0,
      id: block.blockID,
      timestamp: 1000,
    });
    expect(requests.map((url) => url.pathname)).toEqual([
      "/walletsolidity/getblockbynum",
      "/walletsolidity/triggerconstantcontract",
      "/walletsolidity/getnowblock",
    ]);
    expect(requests.every((url) => url.origin === config.providerUrl)).toBe(
      true,
    );
  });
  it.each(["genesis", "decimals", "malformed", "provider-error"])(
    "fails closed on %s without leaking provider content",
    async (scenario) => {
      const provider = new TronProvider(config, async (url) => {
        if (scenario === "malformed")
          return Promise.resolve(new Response("private-sentinel"));
        if (scenario === "provider-error")
          return response({ Error: "private-sentinel" });
        if (
          (url instanceof Request ? url.url : url.toString()).endsWith(
            "triggerconstantcontract",
          )
        )
          return response({
            result: { result: true },
            constant_result: [
              "0".repeat(63) + (scenario === "decimals" ? "8" : "6"),
            ],
          });
        return response({
          ...block,
          blockID: scenario === "genesis" ? "cc".repeat(32) : block.blockID,
        });
      });
      await expect(provider.solidifiedFloor()).rejects.toThrow(
        /^TRON_(IDENTITY_CONFLICT|MALFORMED)$/u,
      );
    },
  );
  it("bounds throttling retries and never converts unavailable responses to empty success", async () => {
    let calls = 0;
    const provider = new TronProvider(config, async () => {
      calls++;
      return Promise.resolve(
        new Response("secret", {
          status: 429,
          headers: { "Retry-After": "0" },
        }),
      );
    });
    await expect(provider.solidifiedFloor()).rejects.toThrow("TRON_THROTTLED");
    expect(calls).toBe(config.maximumAttempts);
  });
  it.each(["oversized", "redirect", "transport"])(
    "bounds %s and sanitizes failures",
    async (scenario) => {
      const provider = new TronProvider(
        { ...config, maximumResponseBytes: 1024, maximumAttempts: 1 },
        async () => {
          if (scenario === "transport")
            throw new TypeError("private-provider-sentinel");
          if (scenario === "redirect")
            return Promise.resolve(new Response("private", { status: 302 }));
          return Promise.resolve(new Response("x".repeat(1025)));
        },
      );
      await expect(provider.solidifiedFloor()).rejects.toThrow(
        /^TRON_(RESPONSE_LIMIT|UNAVAILABLE)$/u,
      );
    },
  );
  it("keeps discovery bounds and opaque fingerprints fixed, ignores provider next URLs", async () => {
    const provider = new TronProvider(config, async (url) => {
      const requested = new URL(url instanceof Request ? url.url : url);
      expect(requested.searchParams.get("only_confirmed")).toBe("true");
      expect(requested.searchParams.get("contract_address")).toBe(token);
      expect(requested.searchParams.get("min_timestamp")).toBe("1000");
      expect(requested.searchParams.get("max_timestamp")).toBe("2000");
      expect(requested.searchParams.get("fingerprint")).toBe("opaque/+?=");
      return response({
        success: true,
        data: [{ transaction_id: "de".repeat(32), block_timestamp: 1500 }],
        meta: {
          fingerprint: "next",
          links: { next: "http://private.invalid" },
        },
      });
    });
    expect(
      await provider.discover({
        address: token,
        from: 1000,
        to: 2000,
        fingerprint: "opaque/+?=",
      }),
    ).toEqual({
      transactions: [{ transactionId: "de".repeat(32), timestamp: 1500 }],
      fingerprint: "next",
    });
    await expect(
      provider.discover({ address: token, from: 2000, to: 1000 }),
    ).rejects.toThrow("TRON_INPUT_INVALID");
  });
  it("preserves missing solidified transaction evidence as unavailable", async () => {
    const provider = new TronProvider(config, async () => response({}));
    await expect(provider.transaction("de".repeat(32))).rejects.toThrow(
      "TRON_UNFINALIZED",
    );
    await expect(provider.transaction("../secret")).rejects.toThrow(
      "TRON_INPUT_INVALID",
    );
  });
});
