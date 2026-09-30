import { changePasswordBodySchema } from "@template/contracts";
import type { z } from "zod";

export const changePasswordBodyDtoSchema = changePasswordBodySchema;
export type ChangePasswordBodyDto = z.infer<typeof changePasswordBodyDtoSchema>;
