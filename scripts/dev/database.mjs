import { readFile } from "node:fs/promises";
import pg from "pg";
import { createDatabaseClient } from "@template/database";
import {
  buildSeedUpsert,
  parseSeedGroup,
} from "../node_modules/@template/database/seed-config.js";

const input = JSON.parse(await readFile("/input.json", "utf8"));
const ownerUrl = `postgresql://oscar_migrator:${input.passwords.oscar_migrator}@postgres:5432/oscar_dev`;
const client = new pg.Client({ connectionString: ownerUrl });
await client.connect();
try {
  for (const [name, group] of [
    ["oscar_api", "p06_api"],
    ["oscar_worker", "p06_deposit_worker"],
    ["oscar_signer", "p06_signer"],
    ["oscar_operator", "p06_recovery_operator"],
  ]) {
    const password = input.passwords[name];
    if (!/^[a-f0-9]{64}$/.test(password))
      throw new Error("Invalid generated database credential.");
    await client.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${name}') THEN CREATE ROLE ${name} LOGIN; END IF; END $$`,
    );
    await client.query(
      `ALTER ROLE ${name} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password}'`,
    );
    await client.query(`GRANT ${group} TO ${name}`);
  }
  await client.query(await readFile("/opt/oscar/dev/grants.sql", "utf8"));
} finally {
  await client.end();
}
const database = createDatabaseClient(ownerUrl);
try {
  for (const group of ["ADMIN", "USER"]) {
    const decision = await parseSeedGroup(
      group,
      input.environment,
      "development",
    );
    if (
      decision.kind === "enabled" &&
      !(await database.user.findUnique({ where: { email: decision.email } }))
    )
      await database.user.upsert(buildSeedUpsert(decision, new Date()));
  }
} finally {
  await database.$disconnect();
}
console.log("Local database roles and accounts are ready.");
