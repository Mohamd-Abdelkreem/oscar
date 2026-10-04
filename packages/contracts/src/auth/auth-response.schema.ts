import { z } from "zod";

import { nonEmptyBoundedString } from "../http/http.schema.ts";

export const credentialValidityDataSchema = z
  .object({ valid: z.literal(true) })
  .strict();
export const neutralEmailDataSchema = z
  .object({ message: nonEmptyBoundedString(500) })
  .strict();
export const emptyActionDataSchema = z.object({}).strict();
