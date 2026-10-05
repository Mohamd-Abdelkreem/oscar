import type { z } from "zod";
import {
  adminDataSchema,
  adminListDataSchema,
  adminStatusBodySchema,
  adminInvitationDataSchema,
  adminInvitationListDataSchema,
  adminInvitationIssueBodySchema,
  adminInvitationCommandBodySchema,
  identityListQuerySchema,
  identityUserParamsSchema,
  adminInvitationParamsSchema,
  successEnvelopeSchema,
  type AdminStatusBody,
  type AdminInvitationIssueBody,
  type AdminInvitationCommandBody,
} from "@template/contracts";
import { apiClient, parseApiResponse } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import type { AxiosResponse } from "axios";

export type AdminListQuery = { page: number; limit: number };
const input = <T>(schema: z.ZodType<T>, raw: unknown): T => {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw safeApiError("request", "VALIDATION_ERROR", 400);
  return parsed.data;
};
const accountPath = (userId: string) =>
  `/admin/admins/${input(identityUserParamsSchema, { userId }).userId}`;
const invitationPath = (invitationId: string) =>
  `/admin/invitations/${input(adminInvitationParamsSchema, { invitationId }).invitationId}`;
const accountReply = (id: string) =>
  adminDataSchema.refine(({ admin }) => admin.id === id);
const invitationReply = (id: string) =>
  adminInvitationDataSchema.refine(({ invitation }) => invitation.id === id);
const observe = async <T>(
  dispatch: () => Promise<AxiosResponse<unknown>>,
  schema: z.ZodType<T>,
  status = 200,
): Promise<T> => {
  const runtime = getSessionRuntime();
  const scope = runtime.scope();
  const response = await dispatch();
  runtime.assertCurrent(scope);
  return parseApiResponse(response, schema, status).data;
};
const list = async <
  T extends { items: unknown[]; pagination: { page: number; limit: number } },
>(
  path: string,
  schema: z.ZodType<T>,
  query: AdminListQuery,
  signal?: AbortSignal,
): Promise<T> => {
  const params = input(identityListQuerySchema, query);
  const runtime = getSessionRuntime();
  const scope = runtime.scope();
  const response = await apiClient.get<unknown>(path, {
    params,
    ...(signal === undefined ? {} : { signal }),
  });
  runtime.assertCurrent(scope);
  const parsed = parseApiResponse(response, schema, 200).data;
  const envelope = successEnvelopeSchema.safeParse(response.data);
  if (
    !envelope.success ||
    parsed.pagination.page !== params.page ||
    parsed.pagination.limit !== params.limit ||
    parsed.items.length > params.limit
  )
    throw safeApiError("contract", "CONTRACT_ERROR");
  const metadata = envelope.data.paginationMeta;
  if (
    metadata !== undefined &&
    Object.entries(metadata).some(
      ([key, value]) => Reflect.get(parsed.pagination, key) !== value,
    )
  )
    throw safeApiError("contract", "CONTRACT_ERROR");
  return parsed;
};

export const adminsApi = {
  listAdmins: (query: AdminListQuery, signal?: AbortSignal) =>
    list("/admin/admins", adminListDataSchema, query, signal),
  getAdmin: (id: string, signal?: AbortSignal) =>
    observe(
      () =>
        apiClient.get<unknown>(
          accountPath(id),
          signal === undefined ? {} : { signal },
        ),
      accountReply(id),
    ),
  changeStatus: (id: string, body: AdminStatusBody) =>
    observe(
      () =>
        apiClient.patch<unknown>(
          `${accountPath(id)}/status`,
          input(adminStatusBodySchema, body),
        ),
      accountReply(id),
    ),
  listInvitations: (query: AdminListQuery, signal?: AbortSignal) =>
    list("/admin/invitations", adminInvitationListDataSchema, query, signal),
  getInvitation: (id: string, signal?: AbortSignal) =>
    observe(
      () =>
        apiClient.get<unknown>(
          invitationPath(id),
          signal === undefined ? {} : { signal },
        ),
      invitationReply(id),
    ),
  issueInvitation: (body: AdminInvitationIssueBody) =>
    observe(
      () =>
        apiClient.post<unknown>(
          "/admin/invitations",
          input(adminInvitationIssueBodySchema, body),
        ),
      adminInvitationDataSchema,
      201,
    ),
  reissueInvitation: (id: string, body: AdminInvitationCommandBody) =>
    observe(
      () =>
        apiClient.post<unknown>(
          `${invitationPath(id)}/reissue`,
          input(adminInvitationCommandBodySchema, body),
        ),
      invitationReply(id),
    ),
  revokeInvitation: (id: string, body: AdminInvitationCommandBody) =>
    observe(
      () =>
        apiClient.post<unknown>(
          `${invitationPath(id)}/revoke`,
          input(adminInvitationCommandBodySchema, body),
        ),
      invitationReply(id),
    ),
};
