import { Prisma } from "@template/database";

import { InternalServerError } from "../../core/errors/internal-server.error.js";

export async function lockAdminAuthority(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  const guard = await transaction.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM admin_setup_state WHERE id=1 FOR UPDATE`,
  );
  if (guard.length !== 1) throw new InternalServerError();
}
