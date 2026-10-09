import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  access,
  chmod,
  chown,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { TronWeb } from "tronweb";

const input = JSON.parse(await readFile("/input.json", "utf8"));
if (input.environment.TRON_NETWORK !== "TRON_NILE")
  throw new Error("Local setup requires Nile.");
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function directory(path, owner) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
  await chown(path, owner, owner);
}
async function privateFile(path, contents, owner) {
  await writeFile(path, contents, { mode: 0o600 });
  await chmod(path, 0o600);
  await chown(path, owner, owner);
}
async function sshIdentity(path, owner) {
  if (!(await exists(path)))
    execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", path]);
  await chmod(path, 0o600);
  await chown(path, owner, owner);
}
for (const [service, owner] of [
  ["api", 1003],
  ["worker", 1002],
  ["signer", 1000],
  ["operator", 1004],
])
  await directory(`/private/${service}`, owner);
await directory("/private/api/proofs", 1003);
await directory("/private/signer/keys", 1000);
await directory("/private/operator/keys", 1004);
await mkdir("/archive", { recursive: true });
await chmod("/archive", 0o755);
await directory("/archive/data", 1001);
await directory("/archive/ssh", 0);

if (!(await exists("/private/signer/encryption.key"))) {
  const key = randomBytes(32);
  await privateFile("/private/signer/encryption.key", key, 1000);
  await privateFile("/private/operator/encryption.key", key, 1004);
  const account = await TronWeb.createAccount();
  await privateFile("/private/operator/treasury.key", account.privateKey, 1004);
  await privateFile(
    "/private/operator/public.json",
    JSON.stringify({ treasury: account.address.base58, keyId: randomUUID() }),
    1004,
  );
}
const identity = JSON.parse(
  await readFile("/private/operator/public.json", "utf8"),
);
await sshIdentity("/private/signer/identity", 1000);
await sshIdentity("/private/operator/identity", 1004);
await sshIdentity("/archive/ssh/host", 0);
const hostKey = (await readFile("/archive/ssh/host.pub", "utf8"))
  .trim()
  .split(" ")
  .slice(0, 2)
  .join(" ");
const forced =
  'restrict,command="/usr/bin/env CUSTODY_RECOVERY_STORAGE_ROOT=/archive/data /usr/local/bin/node /opt/oscar/apps/api/dist/infrastructure/custody/recovery-store.cli.js"';
const publicKeys = await Promise.all(
  ["signer", "operator"].map(
    async (service) =>
      `${forced} ${(await readFile(`/private/${service}/identity.pub`, "utf8")).trim()}`,
  ),
);
await privateFile(
  "/archive/authorized_keys",
  publicKeys.join("\n") + "\n",
  1001,
);
await privateFile(
  "/archive/sshd_config",
  "Port 22\nHostKey /archive/ssh/host\nAuthorizedKeysFile /archive/authorized_keys\nPasswordAuthentication no\nPermitRootLogin no\nUsePAM no\nAllowUsers escrow\n",
  0,
);
for (const [service, owner] of [
  ["signer", 1000],
  ["operator", 1004],
]) {
  await privateFile(
    `/private/${service}/known_hosts`,
    `recovery ${hostKey}\n`,
    owner,
  );
  await privateFile(
    `/private/${service}/ssh_config`,
    `Host recovery\n HostName recovery\n User escrow\n IdentityFile /private/${service}/identity\n`,
    owner,
  );
}

const publicRuntime = Object.fromEntries(
  Object.entries(input.environment).filter(([key]) =>
    /^(TRON_|P06_|P08_|WITHDRAWAL_|LOG_|OSCAR_TESTNET_PROFILE$)/.test(key),
  ),
);
const chain = {
  ...publicRuntime,
  NODE_ENV: "development",
  WITHDRAWAL_REDIS_URL: "redis://redis:6379/0",
  TRON_TREASURY_ADDRESS: identity.treasury,
  TRON_PAYOUT_KEY_ID: identity.keyId,
};
const api = {
  ...Object.fromEntries(
    Object.entries(input.environment).filter(
      ([key]) => !/^(SEED_|POSTGRES_|CUSTODY_)/.test(key),
    ),
  ),
  ...chain,
};
const custody = (service) => ({
  CUSTODY_KEY_FILE: `/private/${service}/encryption.key`,
  CUSTODY_KEY_ID: "local-nile-v1",
  CUSTODY_STORAGE_ROOT: `/private/${service}/keys`,
  CUSTODY_SSH_CONFIG_FILE: `/private/${service}/ssh_config`,
  CUSTODY_SSH_KNOWN_HOSTS_FILE: `/private/${service}/known_hosts`,
  CUSTODY_RECOVERY_HOST: "recovery",
  CUSTODY_OPERATOR_IDENTITY: "local-nile-operator",
});
const connection = (user) =>
  `postgresql://${user}:${input.passwords[user]}@postgres:5432/oscar_dev?schema=public`;
await privateFile(
  "/private/api/config.json",
  JSON.stringify({
    ...api,
    DATABASE_URL: connection("oscar_api"),
    PROOF_STORAGE_ROOT: "/private/api/proofs",
    API_HOST: "0.0.0.0",
  }),
  1003,
);
await privateFile(
  "/private/signer/config.json",
  JSON.stringify({
    ...chain,
    ...custody("signer"),
    DATABASE_URL: connection("oscar_signer"),
  }),
  1000,
);
await privateFile(
  "/private/operator/config.json",
  JSON.stringify({
    ...chain,
    ...custody("operator"),
    DATABASE_URL: connection("oscar_operator"),
    CUSTODY_RECOVERY_KEY_FILE: "/private/operator/encryption.key",
    CUSTODY_FINANCIAL_HISTORY_FILE: "/private/operator/history.json",
  }),
  1004,
);
await privateFile(
  "/private/worker/config.json",
  JSON.stringify({ ...chain, DATABASE_URL: connection("oscar_worker") }),
  1002,
);
console.log(
  JSON.stringify({ state: "LOCAL_PRIVATE_FILES_READY", ...identity }),
);
