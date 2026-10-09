import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Prisma, type DatabaseClient } from "@template/database";
import { z } from "zod";
import { privateCredentialFile } from "../../core/config/custody.config.js";
import { CustodyStorageError } from "../../infrastructure/custody/protected-files.js";

const historySchema = z
  .object({
    reference: z.string().regex(/^[A-Za-z0-9._:-]{1,256}$/u),
    recoveredThrough: z.iso.datetime(),
    digest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
// Account lifecycle and session revocation are authority for restored financial commands.
// Hash protected rows without exposing their contents; exclude worker leases and chain balances.
const historyTables = [
  "users",
  "auth_sessions",
  "identity_audit_records",
  "wallets",
  "financial_operations",
  "financial_request_identities",
  "ledger_postings",
  "reservation_allocations",
  "financial_audit_records",
  "purchases",
  "subscriptions",
  "referral_decisions",
  "task_submissions",
  "final_reviews",
  "manual_credits",
  "withdrawal_destinations",
  "withdrawal_destination_audits",
  "withdrawal_quotes",
  "withdrawal_requests",
  "withdrawal_actions",
  "treasury_payout_keys",
  "withdrawal_attempts",
] as const;
export async function financialHistoryDigest(
  database: DatabaseClient,
): Promise<string> {
  return database.$transaction(
    async (transaction) => {
      const digest = createHash("sha256");
      for (const table of historyTables) {
        digest.update(`${table}\n`);
        let after: string | null = null;
        for (;;) {
          const rows: { id: string; contents: string }[] =
            await transaction.$queryRaw(
              Prisma.sql`SELECT id::text, (to_jsonb(record) - ${table === "withdrawal_attempts" ? ["next_check_at", "blocker", "version"] : table === "withdrawal_requests" ? ["next_check_at", "blocker"] : []}::text[])::text AS contents FROM ${Prisma.raw(table)} record WHERE (${after}::uuid IS NULL OR id > ${after}::uuid) ORDER BY id LIMIT 100`,
            );
          for (const row of rows) digest.update(`${row.contents}\n`);
          if (rows.length < 100) break;
          after = rows.at(-1)?.id ?? null;
        }
      }
      digest.update("withdrawal_policy\n");
      const policies = await transaction.$queryRaw<
        { contents: string }[]
      >`SELECT to_jsonb(record)::text AS contents FROM withdrawal_policy record ORDER BY id`;
      for (const policy of policies) digest.update(`${policy.contents}\n`);
      return digest.digest("hex");
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function verifyRecoveredFinancialHistory(
  database: DatabaseClient,
  request: {
    environment: Readonly<Record<string, string | undefined>>;
    projectRoot: string;
    reference: string;
    recoveredThrough: Date;
    cutoff: Date;
  },
) {
  const file = privateCredentialFile(
    request.environment,
    "CUSTODY_FINANCIAL_HISTORY_FILE",
    request.projectRoot,
    4096,
  );
  const parsed = historySchema.safeParse(
    JSON.parse(readFileSync(file, "utf8")),
  );
  if (
    !parsed.success ||
    parsed.data.reference !== request.reference ||
    new Date(parsed.data.recoveredThrough).getTime() !==
      request.recoveredThrough.getTime() ||
    request.recoveredThrough < request.cutoff ||
    parsed.data.digest !== (await financialHistoryDigest(database))
  )
    throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
}
