import {
  adminCatalogSchema,
  configurationResultSchema,
  configurationOutcomeSchema,
  packageCodeSchema,
  packageEditSchema,
  referralSettingsDataSchema,
  referralEditSchema,
  type PackageCode,
  type PackageEdit,
  type ReferralEdit,
} from "@template/contracts";
import { z } from "zod";
import { matchesEditedFields } from "../utils/configuration-intent";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import {
  financialInput,
  financialRead,
} from "@/services/api/financial-response";

async function save(
  path: string,
  body: PackageEdit | ReferralEdit,
  target: PackageCode | "REFERRAL_SETTINGS",
) {
  const response = await apiClient.patch<unknown>(path, body);
  try {
    return parseApiResponse(
      response,
      configurationResultSchema.refine(
        (change) =>
          change.commandId === body.commandId &&
          change.expectedVersion === body.expectedVersion &&
          change.reason === body.reason &&
          (target === "REFERRAL_SETTINGS"
            ? change.target.kind === "REFERRAL_SETTINGS"
            : change.target.kind === "PACKAGE" &&
              change.target.packageCode === target) &&
          matchesEditedFields(body, change),
      ),
      200,
    ).data;
  } catch {
    throw safeApiError("uncertain", "CONTRACT_ERROR");
  }
}

export const adminPackagesApi = {
  catalog: (signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/admin/packages", {
          ...(signal === undefined ? {} : { signal }),
        }),
      adminCatalogSchema,
    ),
  settings: (signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/admin/referral-settings", {
          ...(signal === undefined ? {} : { signal }),
        }),
      referralSettingsDataSchema,
    ),
  edit: (code: PackageCode, body: PackageEdit) =>
    save(
      `/admin/packages/${financialInput(packageCodeSchema, code)}`,
      financialInput(packageEditSchema, body),
      code,
    ),
  editReferrals: (body: ReferralEdit) =>
    save(
      "/admin/referral-settings",
      financialInput(referralEditSchema, body),
      "REFERRAL_SETTINGS",
    ),
  outcome: (commandId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(
          `/admin/configuration-changes/${financialInput(z.uuid(), commandId)}`,
          { ...(signal === undefined ? {} : { signal }) },
        ),
      configurationOutcomeSchema.refine(
        (outcome) => outcome.commandId === commandId,
      ),
    ),
};
