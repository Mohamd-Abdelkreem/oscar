import type { DatabaseClient } from "@template/database";

export async function hasIndependentRecoveryAuthority(
  database: DatabaseClient,
): Promise<boolean> {
  const [role] = await database.$queryRaw<
    { allowed: boolean }[]
  >`SELECT p06_role_member('p06_recovery_operator') AND NOT (p06_role_member('p06_api') OR p06_role_member('p06_deposit_worker') OR p06_role_member('p06_signer') OR EXISTS(SELECT 1 FROM pg_roles WHERE (rolsuper OR rolcreaterole OR rolbypassrls) AND pg_has_role(current_user,oid,'MEMBER')) OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND pg_has_role(current_user,c.relowner,'MEMBER')) OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='public' AND pg_has_role(current_user,nspowner,'MEMBER'))) AS allowed`;
  return role?.allowed === true;
}
