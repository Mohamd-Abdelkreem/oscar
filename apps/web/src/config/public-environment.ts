import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

const result = publicEnvironmentSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!result.success) {
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new Error(`Invalid public environment: ${JSON.stringify(issues)}`);
}

export const publicEnvironment = Object.freeze(result.data);
