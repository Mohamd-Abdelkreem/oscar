import { registerBodySchema } from "@template/contracts";
import type { z } from "zod";

export const registerBodyDtoSchema = registerBodySchema;
export type RegisterBodyDto = z.infer<typeof registerBodyDtoSchema>;
