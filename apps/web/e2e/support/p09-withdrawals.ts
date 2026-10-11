import type { z } from "zod";
import { financialInstantSchema, usdtAmountSchema } from "@template/contracts";
import {
  p09FixturesSchema,
  p09StateSchema,
  p09EmailSchema,
} from "../../../api/tests/e2e/control.js";
import type { Scenario } from "./fixtures";

export async function p09Fixtures(
  scenario: Scenario,
  amounts: { referral?: string; nonReferral?: string } = {},
) {
  return p09FixturesSchema.parse(
    await scenario.command({
      command: "p09-fixtures",
      ...(amounts.referral === undefined
        ? {}
        : { referral: usdtAmountSchema.parse(amounts.referral) }),
      ...(amounts.nonReferral === undefined
        ? {}
        : { nonReferral: usdtAmountSchema.parse(amounts.nonReferral) }),
    }),
  );
}
export async function p09State(
  scenario: Scenario,
  email: z.infer<typeof p09EmailSchema> = "employee@p09.test",
) {
  return p09StateSchema.parse(
    await scenario.command({
      command: "p09-state",
      email: p09EmailSchema.parse(email),
    }),
  );
}
export async function p09Clock(scenario: Scenario, instant: string) {
  await scenario.command({
    command: "p09-clock",
    instant: financialInstantSchema.parse(instant),
  });
}
