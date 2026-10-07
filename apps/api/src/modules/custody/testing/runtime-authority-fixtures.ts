import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@template/database";

type RuntimeRole = "p06_deposit_worker" | "p06_signer";

export async function runtimeAuthorityRejections(
  database: DatabaseClient,
  databaseUrl: string,
  runtimeRole: RuntimeRole,
) {
  const suffix = randomUUID().replaceAll("-", "");
  const password = randomUUID();
  const cases: { scenario: string; databaseUrl: string }[] = [
    { scenario: "migrator", databaseUrl },
  ];
  for (const group of [
    "p06_api",
    "p06_deposit_worker",
    "p06_signer",
    "p06_recovery_operator",
  ])
    await database.$executeRawUnsafe(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${group}') THEN CREATE ROLE ${group} NOLOGIN; END IF; END $$`,
    );

  const otherRuntime =
    runtimeRole === "p06_signer" ? "p06_deposit_worker" : "p06_signer";
  const scenarios = [
    { name: "wrong_process", grants: ["p06_api"] },
    { name: "mixed_public", grants: [runtimeRole, "p06_api"] },
    { name: "mixed_runtime", grants: [runtimeRole, otherRuntime] },
    { name: "mixed_recovery", grants: [runtimeRole, "p06_recovery_operator"] },
    { name: "relation_owner", grants: [runtimeRole] },
    { name: "inherited_owner", grants: [runtimeRole] },
    { name: "schema_owner", grants: [runtimeRole] },
    { name: "superuser", grants: [runtimeRole] },
    { name: "createrole", grants: [runtimeRole] },
    { name: "bypassrls", grants: [runtimeRole] },
    { name: "inherited_createrole", grants: [runtimeRole] },
  ];
  const roles = new Map<string, string>();
  for (const scenario of scenarios) {
    const role = `p06_${scenario.name}_${suffix}`;
    roles.set(scenario.name, role);
    await database.$executeRawUnsafe(
      `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`,
    );
    for (const grant of scenario.grants)
      await database.$executeRawUnsafe(`GRANT ${grant} TO "${role}"`);
    await database.$executeRawUnsafe(
      `GRANT USAGE ON SCHEMA public TO "${role}"`,
    );
    await database.$executeRawUnsafe(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
    );
    const url = new URL(databaseUrl);
    url.username = role;
    url.password = password;
    cases.push({ scenario: scenario.name, databaseUrl: url.toString() });
  }
  const relationOwner = roles.get("relation_owner");
  const inheritedOwner = roles.get("inherited_owner");
  const schemaOwner = roles.get("schema_owner");
  const elevatedOwner = roles.get("createrole");
  const inheritedElevated = roles.get("inherited_createrole");
  if (
    relationOwner === undefined ||
    inheritedOwner === undefined ||
    schemaOwner === undefined ||
    elevatedOwner === undefined ||
    inheritedElevated === undefined
  )
    throw new Error("Missing isolated authority fixture");
  await database.$executeRawUnsafe(
    `ALTER TABLE deposit_candidates OWNER TO "${relationOwner}"`,
  );
  await database.$executeRawUnsafe(
    `GRANT "${relationOwner}" TO "${inheritedOwner}"`,
  );
  await database.$executeRawUnsafe(
    `ALTER SCHEMA public OWNER TO "${schemaOwner}"`,
  );
  for (const attribute of ["superuser", "createrole", "bypassrls"]) {
    const role = roles.get(attribute);
    if (role === undefined) throw new Error("Missing elevated role fixture");
    await database.$executeRawUnsafe(
      `ALTER ROLE "${role}" ${attribute.toUpperCase()}`,
    );
  }
  await database.$executeRawUnsafe(
    `GRANT "${elevatedOwner}" TO "${inheritedElevated}"`,
  );
  return cases;
}
