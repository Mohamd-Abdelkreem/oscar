import {
  emailSchema,
  nonEmptyBoundedString,
  passwordSchema,
} from "@template/contracts";
import { z } from "zod";

export const bootstrapInputSchema = z
  .object({
    fullName: nonEmptyBoundedString(150),
    email: emailSchema,
    password: passwordSchema,
    reason: nonEmptyBoundedString(500),
  })
  .strict();
export type BootstrapInput = z.infer<typeof bootstrapInputSchema>;
export type BootstrapOperator = Readonly<{ uid: number; username: string }>;
