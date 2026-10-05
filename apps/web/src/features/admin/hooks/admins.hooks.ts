"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminStatusBody,
  AdminInvitationIssueBody,
  AdminInvitationCommandBody,
} from "@template/contracts";
import { useSessionScope } from "@/features/auth/hooks/auth.hooks";
import { useCredentialCommand } from "@/features/auth/hooks/credential-commands.hooks";
import { clearAccessToken, getApiError } from "@/services/api/api-client";
import {
  getSessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";
import { safeApiError } from "@/services/api/safe-error";
import { adminsApi } from "../api/admins.api";

const managementKey = (scope: SessionScope) =>
  ["admin-management", scope.epoch, scope.accountId] as const;
const permitted = (scope: SessionScope) =>
  scope.role === "ADMIN" && scope.accountId !== null;
const reconcileAuthority = (failure: unknown) => {
  const error = getApiError(failure);
  if (error.statusCode === 401) {
    getSessionRuntime().retire();
    clearAccessToken();
  } else if (error.statusCode === 403) getSessionRuntime().beginCheck();
  return error;
};
const read = async <T>(
  scope: SessionScope,
  execute: () => Promise<T>,
): Promise<T> => {
  try {
    const reply = await execute();
    getSessionRuntime().assertCurrent(scope);
    return reply;
  } catch (failure: unknown) {
    getSessionRuntime().assertCurrent(scope);
    throw reconcileAuthority(failure);
  }
};
const useManagementScope = () => {
  const scope = useSessionScope();
  const client = useQueryClient();
  useEffect(
    () =>
      getSessionRuntime().onRetire(() => {
        void client.cancelQueries({ queryKey: ["admin-management"] });
        client.removeQueries({ queryKey: ["admin-management"] });
      }),
    [client],
  );
  return scope;
};
const useBoundedList = <T extends { pagination: { totalPages: number } }>(
  kind: string,
  execute: (
    query: { page: number; limit: number },
    signal: AbortSignal,
  ) => Promise<T>,
) => {
  const scope = useManagementScope();
  const [selection, select] = useState({ epoch: scope.epoch, page: 1 });
  const page = selection.epoch === scope.epoch ? selection.page : 1;
  const query = useQuery({
    queryKey: [...managementKey(scope), kind, "list", page, 25],
    enabled: permitted(scope),
    queryFn: ({ signal }) =>
      read(scope, () => execute({ page, limit: 25 }, signal)),
    staleTime: 0,
    gcTime: 0,
  });
  useEffect(() => {
    const pages = query.data?.pagination.totalPages;
    if (query.isSuccess && pages !== undefined && page > Math.max(1, pages)) {
      queueMicrotask(() => {
        if (getSessionRuntime().isCurrent(scope))
          select({ epoch: scope.epoch, page: Math.max(1, pages) });
      });
    }
  }, [query.data, query.isSuccess, page, scope]);
  return {
    ...query,
    page,
    setPage: (next: number) => {
      if (Number.isSafeInteger(next) && next >= 1)
        select({ epoch: scope.epoch, page: next });
    },
  };
};
export const useAdminLists = () => ({
  admins: useBoundedList("admins", adminsApi.listAdmins),
  invitations: useBoundedList("invitations", adminsApi.listInvitations),
});
export const useAdminDetail = (id: string | null) => {
  const scope = useManagementScope();
  return useQuery({
    queryKey: [...managementKey(scope), "admins", "detail", id],
    enabled: permitted(scope) && id !== null,
    queryFn: ({ signal }) => {
      if (id === null) throw safeApiError("request", "NOT_FOUND", 404);
      return read(scope, () => adminsApi.getAdmin(id, signal));
    },
    staleTime: 0,
    gcTime: 0,
  });
};
export const useInvitationDetail = (id: string | null) => {
  const scope = useManagementScope();
  return useQuery({
    queryKey: [...managementKey(scope), "invitations", "detail", id],
    enabled: permitted(scope) && id !== null,
    queryFn: ({ signal }) => {
      if (id === null) throw safeApiError("request", "NOT_FOUND", 404);
      return read(scope, () => adminsApi.getInvitation(id, signal));
    },
    staleTime: 0,
    gcTime: 0,
  });
};
const useManagementCommand = <TInput, TOutput>(
  operation: string,
  target: string,
  execute: (body: TInput) => Promise<TOutput>,
) => {
  const scope = useManagementScope();
  const client = useQueryClient();
  const kind = operation === "status" ? "admins" : "invitations";
  return useCredentialCommand(
    `admin:${String(scope.epoch)}:${scope.accountId ?? "none"}:${operation}:${target}`,
    async (body: TInput) => {
      if (!permitted(scope)) throw safeApiError("denied", "FORBIDDEN", 403);
      getSessionRuntime().assertCurrent(scope);
      try {
        const reply = await execute(body);
        getSessionRuntime().assertCurrent(scope);
        void client.invalidateQueries({
          queryKey: [...managementKey(scope), kind],
        });
        return reply;
      } catch (failure: unknown) {
        getSessionRuntime().assertCurrent(scope);
        const error = reconcileAuthority(failure);
        void client.invalidateQueries({
          queryKey: [...managementKey(scope), kind],
        });
        if (error.category === "contract")
          throw safeApiError("uncertain", "CONTRACT_ERROR");
        throw error;
      }
    },
  );
};
export const useIssueInvitation = () =>
  useManagementCommand("issue", "new", (body: AdminInvitationIssueBody) =>
    adminsApi.issueInvitation(body),
  );
export const useAdminStatus = (id: string | null) =>
  useManagementCommand("status", id ?? "none", (body: AdminStatusBody) => {
    if (id === null) throw safeApiError("request", "NOT_FOUND", 404);
    return adminsApi.changeStatus(id, body);
  });
export const useReissueInvitation = (id: string | null) =>
  useManagementCommand(
    "reissue",
    id ?? "none",
    (body: AdminInvitationCommandBody) => {
      if (id === null) throw safeApiError("request", "NOT_FOUND", 404);
      return adminsApi.reissueInvitation(id, body);
    },
  );
export const useRevokeInvitation = (id: string | null) =>
  useManagementCommand(
    "revoke",
    id ?? "none",
    (body: AdminInvitationCommandBody) => {
      if (id === null) throw safeApiError("request", "NOT_FOUND", 404);
      return adminsApi.revokeInvitation(id, body);
    },
  );
