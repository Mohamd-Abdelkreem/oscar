import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  parseSignerCustodyEnvironment,
  parseRecoveryHelperEnvironment,
  parseRecoveryOperatorEnvironment,
} from "./custody.config.js";

const root = mkdtempSync(join(tmpdir(), "p06-private-config-"));
const key = join(root, "key");
const ssh = join(root, "ssh.config");
const hosts = join(root, "known_hosts");
writeFileSync(key, Buffer.from(Array.from({ length: 32 }, (_, i) => i)), {
  mode: 0o600,
});
writeFileSync(ssh, "Host recovery\n HostName recovery.example.test\n", {
  mode: 0o600,
});
writeFileSync(hosts, "test-only-pinned-host-sentinel", { mode: 0o600 });
const environment = {
  NODE_ENV: "test",
  CUSTODY_KEY_FILE: key,
  CUSTODY_KEY_ID: "test-v1",
  CUSTODY_STORAGE_ROOT: root,
  CUSTODY_SSH_CONFIG_FILE: ssh,
  CUSTODY_SSH_KNOWN_HOSTS_FILE: hosts,
  CUSTODY_RECOVERY_HOST: "recovery",
  CUSTODY_OPERATOR_IDENTITY: "disposable-test-operator",
  CUSTODY_RECOVERY_STORAGE_ROOT: root,
  CUSTODY_RECOVERY_KEY_FILE: key,
};
afterAll(() => {
  if (
    !relative(resolve(tmpdir()), resolve(root)).startsWith(
      "p06-private-config-",
    )
  )
    throw new Error("Unsafe temporary cleanup target.");
  rmSync(root, { recursive: true, force: true });
});
describe("process-specific protected custody configuration", () => {
  it("retains protected historical keys and rejects current-key replacement or malformed manifests", () => {
    const manifest = join(root, "retained-keys.json");
    const historical = join(root, "historical.key");
    writeFileSync(
      historical,
      Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index)),
      { mode: 0o600 },
    );
    writeFileSync(manifest, JSON.stringify({ "test-v0": historical }), {
      mode: 0o600,
    });
    const configured = { ...environment, CUSTODY_RETAINED_KEYS_FILE: manifest };
    expect(
      parseSignerCustodyEnvironment(configured, process.cwd()).keyFiles,
    ).toEqual({ "test-v1": key, "test-v0": historical });
    writeFileSync(manifest, JSON.stringify({ "test-v1": historical }));
    expect(() =>
      parseSignerCustodyEnvironment(configured, process.cwd()),
    ).toThrow("cannot replace");
    writeFileSync(manifest, "invalid-test-manifest");
    expect(() =>
      parseSignerCustodyEnvironment(configured, process.cwd()),
    ).toThrow("retained-key manifest");
  });
  it("keeps decryption and SSH settings out of helper configuration", () => {
    expect(
      Object.keys(
        parseRecoveryHelperEnvironment(environment, process.cwd()),
      ).sort(),
    ).toEqual(["maximumListPage", "maximumMessageBytes", "storageRoot"]);
    expect(
      Object.keys(
        parseRecoveryOperatorEnvironment(environment, process.cwd()),
      ).sort(),
    ).toEqual(["escrowKeyFile", "operatorIdentity"]);
    expect(
      parseSignerCustodyEnvironment(environment, process.cwd()).maximumAttempts,
    ).toBe(3);
  });
  it.each([
    "CUSTODY_KEY_FILE",
    "CUSTODY_KEY_ID",
    "CUSTODY_STORAGE_ROOT",
    "CUSTODY_SSH_CONFIG_FILE",
    "CUSTODY_SSH_KNOWN_HOSTS_FILE",
    "CUSTODY_RECOVERY_HOST",
    "CUSTODY_OPERATOR_IDENTITY",
  ])("rejects missing or placeholder %s", (setting) => {
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, [setting]: undefined },
        process.cwd(),
      ),
    ).toThrow(setting);
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, [setting]: "placeholder" },
        process.cwd(),
      ),
    ).toThrow();
  });
  it("rejects project/proof storage, relative paths and production test identifiers", () => {
    for (const path of [process.cwd(), "relative-key"])
      expect(() =>
        parseSignerCustodyEnvironment(
          { ...environment, CUSTODY_KEY_FILE: path },
          process.cwd(),
        ),
      ).toThrow();
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, PROOF_STORAGE_ROOT: root },
        process.cwd(),
      ),
    ).toThrow();
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, NODE_ENV: "production" },
        process.cwd(),
      ),
    ).toThrow("test key");
  });
  it("rejects repeated default key bytes without leaking their path", () => {
    const defaults = join(root, "default-key");
    writeFileSync(defaults, Buffer.alloc(32), { mode: 0o600 });
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, CUSTODY_KEY_FILE: defaults },
        process.cwd(),
      ),
    ).toThrow("32-byte key");
    try {
      parseRecoveryOperatorEnvironment(
        { ...environment, CUSTODY_RECOVERY_KEY_FILE: defaults },
        process.cwd(),
      );
    } catch (error) {
      expect(String(error)).not.toContain(defaults);
    }
  });
  it("rejects SSH execution directives and a mismatched fixed alias", () => {
    const unsafe = join(root, "unsafe.config");
    writeFileSync(unsafe, "Host recovery\n ProxyCommand arbitrary-command\n", {
      mode: 0o600,
    });
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, CUSTODY_SSH_CONFIG_FILE: unsafe },
        process.cwd(),
      ),
    ).toThrow("unsupported");
    expect(() =>
      parseSignerCustodyEnvironment(
        { ...environment, CUSTODY_RECOVERY_HOST: "other" },
        process.cwd(),
      ),
    ).toThrow("fixed recovery");
  });
});
