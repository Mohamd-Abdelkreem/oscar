import { tokenQuerySchema } from "@template/contracts";
import type { z } from "zod";

export const tokenQueryDtoSchema = tokenQuerySchema;
export type TokenQueryDto = z.infer<typeof tokenQueryDtoSchema>;
