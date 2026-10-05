import { Prisma } from "@template/database";
import type { adminMemberFilterSchema } from "@template/contracts";
import type { z } from "zod";

type AdminMemberFilter = z.infer<typeof adminMemberFilterSchema>;

// Sponsors are immutable and acyclic under the P02 database guards. Member reads stop at L5;
// the full recursion is used only for the administrator's aggregate deeper count.
export function relativeTree(
  rootId: string,
  options: { maximumDepth?: number | null; details?: boolean } = {},
) {
  const maximumDepth =
    options.maximumDepth === undefined ? 5 : options.maximumDepth;
  const details = options.details === true;
  return Prisma.sql`WITH RECURSIVE tree AS (
    SELECT u.id,u.full_name,u.created_at,1 level ${details ? Prisma.sql`,u.email,jsonb_build_array(jsonb_build_object('id',u.id,'fullName',u.full_name)) path` : Prisma.empty}
    FROM users u WHERE u.sponsor_user_id=${rootId}::uuid AND u.role::text='USER'
    UNION ALL
    SELECT u.id,u.full_name,u.created_at,t.level+1 ${details ? Prisma.sql`,u.email,t.path||jsonb_build_array(jsonb_build_object('id',u.id,'fullName',u.full_name))` : Prisma.empty}
    FROM users u JOIN tree t ON u.sponsor_user_id=t.id WHERE u.role::text='USER' ${maximumDepth === null ? Prisma.empty : Prisma.sql`AND t.level<${maximumDepth}`}
  )`;
}
export function memberPredicate(query: AdminMemberFilter) {
  const predicates = [Prisma.sql`TRUE`];
  if (query.level !== undefined)
    predicates.push(Prisma.sql`t.level=${query.level}`);
  if (query.q !== undefined && query.q.length > 0) {
    const pattern = `%${query.q.replace(/[\\%_]/gu, "\\$&")}%`;
    predicates.push(
      Prisma.sql`(t.full_name ILIKE ${pattern} OR t.email ILIKE ${pattern} OR t.id::text ILIKE ${pattern})`,
    );
  }
  return Prisma.sql`${Prisma.join(predicates, " AND ")}`;
}
