import { emailRequestBodySchema } from "@template/contracts";
import type { z } from "zod";

export const emailRequestBodyDtoSchema = emailRequestBodySchema;
export type EmailRequestBodyDto = z.infer<typeof emailRequestBodyDtoSchema>;
