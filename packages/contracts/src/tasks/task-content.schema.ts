import { z } from "zod";
import {
  businessDateSchema,
  financialInstantSchema,
  positiveUsdtAmountSchema,
} from "../financial/financial.schema.ts";
import { nonEmptyBoundedString } from "../http/http.schema.ts";
import {
  configurationVersionSchema,
  packageCodeSchema,
} from "../packages/package.schema.ts";

export const taskRevisionSchema = configurationVersionSchema;
export const taskExpectedRevisionSchema = taskRevisionSchema.max(2_147_483_646);
export const taskPublicationStateSchema = z.enum([
  "PUBLISHED",
  "PAUSED",
  "CLOSED",
]);
export const taskDisplayStatusSchema = z.enum([
  "ACTIVE",
  "SCHEDULED",
  "PAUSED",
  "CLOSED",
]);
export const taskPublicationDateSchema = businessDateSchema.refine((date) => {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}, "Publication requires a weekday.");
function allowedTaskUrl(raw: string): boolean {
  if (/[\p{Cc}\s]/u.test(raw)) return false;
  try {
    const url = new URL(raw);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false;
    const host = url.hostname.toLowerCase().replace(/\.$/u, "");
    if (!host || host === "localhost" || host.endsWith(".localhost"))
      return false;
    if (host.startsWith("[")) {
      const address = host.slice(1, -1);
      return !(
        /^(?:::|::1|f[cd]|fe[89ab]|ff)/u.test(address) ||
        address.startsWith("::ffff:")
      );
    }
    if (/^[0-9.]+$/u.test(host)) {
      const octets = host.split(".").map(Number);
      const first = octets[0];
      const second = octets[1];
      return (
        first !== undefined &&
        second !== undefined &&
        first !== 0 &&
        first !== 10 &&
        first !== 127 &&
        first < 224 &&
        !(first === 169 && second === 254) &&
        !(first === 172 && second >= 16 && second <= 31) &&
        !(first === 192 && second === 168) &&
        !(first === 100 && second >= 64 && second <= 127)
      );
    }
    return true;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}
export const taskTargetUrlSchema = z
  .string()
  .min(1)
  .max(2_000)
  .refine(allowedTaskUrl, "Public HTTP(S) link required.");
export const taskContentShape = {
  title: nonEmptyBoundedString(150),
  description: nonEmptyBoundedString(10_000),
  targetUrl: taskTargetUrlSchema,
  platform: nonEmptyBoundedString(80),
};
export const taskContentSnapshotSchema = z.strictObject(taskContentShape);
export const taskWindowSchema = z
  .strictObject({
    opensAt: financialInstantSchema,
    closesAt: financialInstantSchema,
    nextOpeningAt: financialInstantSchema,
  })
  .refine(
    (window) => new Date(window.opensAt) < new Date(window.closesAt),
    "Invalid window.",
  );
export const currentTaskEntitlementSchema = z.discriminatedUnion("effective", [
  z.strictObject({
    effective: z.literal(true),
    packageCode: packageCodeSchema,
    packageLabel: nonEmptyBoundedString(80),
    dailyReward: positiveUsdtAmountSchema,
  }),
  z.strictObject({
    effective: z.literal(false),
    packageCode: z.null(),
    packageLabel: z.null(),
    dailyReward: z.null(),
  }),
]);
