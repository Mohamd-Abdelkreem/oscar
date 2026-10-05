import {
  adminTeamSummarySchema,
  adminMemberFilterSchema,
  adminMemberPageSchema,
  adminCommissionFilterSchema,
  adminCommissionPageSchema,
  rootSearchFilterSchema,
  rootIdentityPageSchema,
} from "@template/contracts";
import { z } from "zod";
import { apiClient } from "@/services/api/api-client";
import {
  financialInput,
  financialRead,
  financialPage,
} from "@/services/api/financial-response";

const path = (rootId: string) =>
  `/admin/referrals/${financialInput(z.uuid(), rootId)}`;
export const adminReferralsApi = {
  roots: async (
    query: z.input<typeof rootSearchFilterSchema>,
    signal?: AbortSignal,
  ) => {
    const params = financialInput(rootSearchFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>("/admin/referrals/roots", {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      rootIdentityPageSchema,
      params,
    );
  },
  summary: (rootId: string, signal?: AbortSignal) =>
    financialRead(
      () =>
        apiClient.get<unknown>(path(rootId), {
          ...(signal === undefined ? {} : { signal }),
        }),
      adminTeamSummarySchema.refine((summary) => summary.root.id === rootId),
    ),
  members: async (
    rootId: string,
    query: z.input<typeof adminMemberFilterSchema>,
    signal?: AbortSignal,
  ) => {
    const params = financialInput(adminMemberFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>(`${path(rootId)}/members`, {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      adminMemberPageSchema.refine((page) => page.rootId === rootId),
      params,
    );
  },
  commissions: async (
    rootId: string,
    query: z.input<typeof adminCommissionFilterSchema>,
    signal?: AbortSignal,
  ) => {
    const params = financialInput(adminCommissionFilterSchema, query);
    return financialPage(
      () =>
        apiClient.get<unknown>(`${path(rootId)}/commissions`, {
          params,
          ...(signal === undefined ? {} : { signal }),
        }),
      adminCommissionPageSchema.refine((page) => page.beneficiaryId === rootId),
      params,
    );
  },
};
