import { randomUUID } from "node:crypto";
import { createDatabaseClient, type DatabaseClient } from "@template/database";

// PostgreSQL template snapshots exercise actual isolated restored rows, without claiming WAL/PITR deployment.
export async function withWithdrawalSnapshot<T>(input: {
  databaseUrl: string;
  clients: readonly DatabaseClient[];
  work: (database: DatabaseClient, databaseUrl: string) => Promise<T>;
}): Promise<T> {
  const source = new URL(input.databaseUrl);
  const sourceName = source.pathname.slice(1);
  const adminUrl = process.env["DATABASE_URL"];
  if (
    adminUrl === undefined ||
    !/^p02_identity_[0-9a-f]{32}$/u.test(sourceName) ||
    new URL(adminUrl).pathname !== "/template_api_integration"
  )
    throw new Error("Snapshot requires isolated integration databases.");
  const name = `p08_snapshot_${randomUUID().replaceAll("-", "")}`;
  const admin = createDatabaseClient(adminUrl);
  let created = false;
  const target = new URL(input.databaseUrl);
  target.pathname = `/${name}`;
  const restored = createDatabaseClient(target.toString());
  try {
    for (const client of input.clients) await client.$disconnect();
    await admin.$executeRawUnsafe(
      `CREATE DATABASE "${name}" TEMPLATE "${sourceName}"`,
    );
    created = true;
    return await input.work(restored, target.toString());
  } finally {
    await restored.$disconnect();
    if (created)
      await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.$disconnect();
  }
}
