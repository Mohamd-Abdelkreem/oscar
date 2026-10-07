import type { DatabaseClient } from "@template/database";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";

export async function assertApiDatabaseAuthority(
  database: DatabaseClient,
): Promise<void> {
  await assertRuntimeDatabaseAuthority(database, "p06_api");
}

export async function assertRuntimeDatabaseAuthority(
  database: DatabaseClient,
  role: "p06_api" | "p06_deposit_worker" | "p06_signer",
): Promise<void> {
  const [authority] = await database.$queryRaw<
    { permitted: boolean; protected: boolean }[]
  >`SELECT p06_role_member(${role}) AS permitted,
    (p06_recovery_authority()
      OR EXISTS (SELECT 1 FROM (VALUES ('p06_api'),('p06_deposit_worker'),('p06_signer'))
        AS runtime_roles(name) WHERE name <> ${role} AND p06_role_member(name))
      OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND pg_has_role(current_user,c.relowner,'MEMBER'))
      OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname='public'
        AND pg_has_role(current_user,n.nspowner,'MEMBER'))
      OR EXISTS (SELECT 1 FROM pg_roles WHERE (rolsuper OR rolcreaterole OR rolbypassrls)
        AND pg_has_role(current_user,oid,'MEMBER'))) AS protected`;
  if (authority?.permitted !== true || authority.protected)
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
}
