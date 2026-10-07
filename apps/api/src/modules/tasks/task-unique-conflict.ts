import { Prisma } from "@template/database";
import { z } from "zod";

const adapterUniqueSchema = z.object({
  driverAdapterError: z.object({
    cause: z.object({
      originalCode: z.literal("23505"),
      kind: z.literal("UniqueConstraintViolation"),
      constraint: z.object({ fields: z.array(z.string()) }),
    }),
  }),
});

const constraints = {
  publicationDate: {
    name: "tasks_publication_date_key",
    field: "publication_date",
  },
  normalizedText: {
    name: "task_codes_normalized_text_key",
    field: "normalized_text",
  },
} as const;

export function isTaskUniqueConflict(
  error: unknown,
  key: keyof typeof constraints,
): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  )
    return false;
  const constraint = constraints[key];
  const target = error.meta?.["target"];
  const adapter = adapterUniqueSchema.safeParse(error.meta);
  const matches = (fields: unknown) =>
    Array.isArray(fields) &&
    fields.length === 1 &&
    fields[0] === constraint.field;
  return (
    target === constraint.name ||
    matches(target) ||
    (adapter.success &&
      matches(adapter.data.driverAdapterError.cause.constraint.fields))
  );
}
