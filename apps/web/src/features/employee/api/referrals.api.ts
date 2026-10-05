import {
  employeeTeamSummarySchema,
  employeeMemberFilterSchema,
  employeeMemberPageSchema,
  commissionFilterSchema,
  employeeCommissionPageSchema,
} from "@template/contracts";
import type { z } from "zod";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";

export const referralsApi = {
  summary: (employeeId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>("/referrals/me", {
          ...(signal === undefined ? {} : { signal }),
        }),
      employeeTeamSummarySchema.refine(
        (summary) => summary.root.id === employeeId,
      ),
    ),
  members: async (
    employeeId: string,
    query: z.input<typeof employeeMemberFilterSchema>,
    signal?: AbortSignal,
  ) => {
    const params = financialInput(employeeMemberFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/referrals/me/members", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      employeeMemberPageSchema.refine((page) => page.rootId === employeeId),
      params,
    );
  },
  commissions: async (
    employeeId: string,
    query: z.input<typeof commissionFilterSchema>,
    signal?: AbortSignal,
  ) => {
    const params = financialInput(commissionFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/referrals/me/commissions", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      employeeCommissionPageSchema.refine(
        (page) => page.beneficiaryId === employeeId,
      ),
      params,
    );
  },
};
