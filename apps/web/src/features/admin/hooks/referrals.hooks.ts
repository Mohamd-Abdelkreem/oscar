"use client";
import type {
  adminMemberFilterSchema,
  adminCommissionFilterSchema,
} from "@template/contracts";
import type { z } from "zod";
import { safeApiError } from "@/services/api/safe-error";
import {
  useFinancialRead,
  useFinancialList,
} from "@/shared/query/financial-query";
import { adminReferralsApi } from "../api/referrals.api";

export const useReferralRoots = (q: string) =>
  useFinancialList({
    domain: "referral-roots",
    role: "ADMIN",
    filters: { q },
    read: (_scope, query, signal) => adminReferralsApi.roots(query, signal),
  });
export const useReferralSummary = (rootId: string | null) =>
  useFinancialRead({
    domain: "referral-summary",
    role: "ADMIN",
    selection: [rootId],
    enabled: rootId !== null,
    read: (_scope, signal) => {
      if (rootId === null) throw safeApiError("request", "NOT_FOUND", 404);
      return adminReferralsApi.summary(rootId, signal);
    },
  });
export const useReferralMembers = (
  rootId: string | null,
  filters: Omit<
    z.output<typeof adminMemberFilterSchema>,
    "page" | "limit"
  > = {},
) =>
  useFinancialList({
    domain: "referral-members",
    role: "ADMIN",
    resource: rootId,
    filters,
    read: (_scope, query, signal) => {
      if (rootId === null) throw safeApiError("request", "NOT_FOUND", 404);
      return adminReferralsApi.members(rootId, query, signal);
    },
  });
export const useReferralCommissions = (
  rootId: string | null,
  filters: Omit<
    z.output<typeof adminCommissionFilterSchema>,
    "page" | "limit"
  > = {},
) =>
  useFinancialList({
    domain: "referral-commissions",
    role: "ADMIN",
    resource: rootId,
    filters,
    read: (_scope, query, signal) => {
      if (rootId === null) throw safeApiError("request", "NOT_FOUND", 404);
      return adminReferralsApi.commissions(rootId, query, signal);
    },
  });
