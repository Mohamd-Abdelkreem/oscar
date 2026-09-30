import { loginBodySchema } from "@template/contracts";
import type { z } from "zod";

export const loginBodyDtoSchema = loginBodySchema;
export type LoginBodyDto = z.infer<typeof loginBodyDtoSchema>;
