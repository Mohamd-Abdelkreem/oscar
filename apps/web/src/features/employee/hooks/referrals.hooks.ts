"use client";
import type {
  commissionFilterSchema,
  employeeMemberFilterSchema,
} from "@template/contracts";
import type { z } from "zod";
import { safeApiError } from "@/services/api/safe-error";
import {
  useFinancialRead,
  useFinancialList,
} from "@/shared/query/financial-query";
import { referralsApi } from "../api/referrals.api";

const accountId = (scope: { accountId: string | null }) => {
  if (scope.accountId === null) throw safeApiError("denied", "FORBIDDEN", 403);
  return scope.accountId;
};
export const useTeamSummary = () =>
  useFinancialRead({
    domain: "team",
    role: "USER",
    selection: [],
    read: (scope, signal) => referralsApi.summary(accountId(scope), signal),
  });
export const useTeamMembers = (
  filters: Omit<
    z.output<typeof employeeMemberFilterSchema>,
    "page" | "limit"
  > = {},
) =>
  useFinancialList({
    domain: "team-members",
    role: "USER",
    filters,
    read: (scope, query, signal) =>
      referralsApi.members(accountId(scope), query, signal),
  });
export const useTeamCommissions = (
  filters: Omit<z.output<typeof commissionFilterSchema>, "page" | "limit"> = {},
) =>
  useFinancialList({
    domain: "team-commissions",
    role: "USER",
    filters,
    read: (scope, query, signal) =>
      referralsApi.commissions(accountId(scope), query, signal),
  });
