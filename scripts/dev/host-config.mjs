import { randomBytes } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { command } from "./host-process.mjs";

export const devHome = join(
  process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"),
  "OSCAR",
  "oscar-dev",
);
export async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
export const readEnvironment = async (path) =>
  parseEnv(await readFile(path, "utf8"));
export const writeEnvironment = (path, environment) =>
  writeFile(
    path,
    Object.entries(environment)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
export async function prepareConfiguration(root) {
  await mkdir(devHome, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    const owner = (await command("whoami", [], { capture: true }))
      .toString()
      .trim();
    await command(
      "icacls",
      [devHome, "/inheritance:r", "/grant:r", `${owner}:(OI)(CI)F`],
      { capture: true },
    );
  }
  const path = join(devHome, "input.json");
  if (await exists(path)) {
    const saved = JSON.parse(await readFile(path, "utf8"));
    if (saved.configured && (await exists(join(root, ".env")))) {
      saved.environment = await readEnvironment(join(root, ".env"));
      if (saved.environment.TRON_NETWORK !== "TRON_NILE")
        throw new Error("The local Docker setup only supports Nile.");
    }
    for (const [key, value] of Object.entries({
      MAIL_FROM_NAME: "OSCAR Local",
      MAIL_FROM_ADDRESS: "no-reply@oscar.test",
      MAIL_REPLY_TO: "support@oscar.test",
    }))
      if (!saved.environment[key]) saved.environment[key] = value;
    await writeFile(path, JSON.stringify(saved, null, 2), { mode: 0o600 });
    return saved;
  }
  const environment = {
    ...(await readEnvironment(join(root, ".env.example"))),
    ...((await exists(join(root, ".env")))
      ? await readEnvironment(join(root, ".env"))
      : {}),
  };
  if (await exists(join(root, ".env")))
    await copyFile(join(root, ".env"), join(devHome, "previous.env"));
  if (await exists(join(root, "apps/web/.env.local")))
    await copyFile(
      join(root, "apps/web/.env.local"),
      join(devHome, "previous-web.env"),
    );
  for (const key of [
    "AUTH_JWT_SECRET",
    "AUTH_REFRESH_JWT_SECRET",
    "AUTH_VERIFICATION_JWT_SECRET",
    "AUTH_RESET_JWT_SECRET",
  ])
    if (!environment[key]) environment[key] = randomBytes(48).toString("hex");
  Object.assign(environment, {
    NODE_ENV: "development",
    APP_NAME: "OSCAR Local API",
    MAIL_FROM_NAME: "OSCAR Local",
    MAIL_FROM_ADDRESS: "no-reply@oscar.test",
    MAIL_REPLY_TO: "support@oscar.test",
    EMAIL_PROVIDER: "console",
    WEB_APP_URL: "http://localhost:3000",
    CORS_ORIGINS: "http://localhost:3000",
    ADMIN_INVITATION_ACCEPT_URL:
      "http://localhost:3000/admin/auth/accept-invitation",
    WITHDRAWAL_ADDRESS_CONFIRM_URL: "http://localhost:3000/employee/account",
    WITHDRAWAL_REDIS_URL: "redis://127.0.0.1:6381/0",
    TRON_NETWORK: "TRON_NILE",
    TRON_TOKEN_CONTRACT: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
    TRON_EXPECTED_GENESIS_BLOCK_ID:
      "0000000000000000d698d4192c56cb6be724a558448e2684802de4d6cd8690dc",
    TRON_PROVIDER_URL: "https://nile.trongrid.io",
    TRON_PROVIDER_AUTH: "PUBLIC_TESTNET",
    P06_TESTNET_OPT_IN: "YES",
    OSCAR_TESTNET_PROFILE: "P06",
    P08_TESTNET_OPT_IN: "NO",
    TRON_MAX_SWEEP_UNITS: "500000000",
    TRON_ENERGY_FEE_LIMIT_SUN: "100000000",
    TRON_MAX_COMPANY_COST_SUN: "110000000",
    TRON_MAX_MANUAL_FUNDING_SUN: "200000000",
    TRON_MAX_PAYOUT_UNITS: "500000000",
    TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN: "100000000",
    TRON_PAYOUT_MAX_COMPANY_COST_SUN: "110000000",
    SEED_ADMIN_EMAIL: "admin@oscar.test",
    SEED_ADMIN_NAME: "Local OSCAR Admin",
    SEED_ADMIN_PASSWORD: randomBytes(24).toString("base64url"),
    SEED_USER_EMAIL: "employee@oscar.test",
    SEED_USER_NAME: "Local OSCAR Employee",
    SEED_USER_PASSWORD: randomBytes(24).toString("base64url"),
  });
  const passwords = Object.fromEntries(
    [
      "oscar_migrator",
      "oscar_api",
      "oscar_worker",
      "oscar_signer",
      "oscar_operator",
    ].map((user) => [user, randomBytes(32).toString("hex")]),
  );
  const input = { environment, passwords };
  await writeFile(path, JSON.stringify(input, null, 2), { mode: 0o600 });
  await writeFile(
    join(devHome, "credentials.json"),
    JSON.stringify(
      {
        admin: {
          email: environment.SEED_ADMIN_EMAIL,
          password: environment.SEED_ADMIN_PASSWORD,
        },
        employee: {
          email: environment.SEED_USER_EMAIL,
          password: environment.SEED_USER_PASSWORD,
        },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  return input;
}
