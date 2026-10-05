import { z } from "zod";
import { createDocument } from "zod-openapi";

import {
  identityUserSchema,
  identityUserDataSchema,
  identitySessionDataSchema,
  identityUserParamsSchema,
  identityListQuerySchema,
  tokenQuerySchema,
  employeeRestrictionsBodySchema,
  employeeRestrictionsDataSchema,
  adminDataSchema,
  adminListDataSchema,
  adminStatusBodySchema,
  adminInvitationDataSchema,
  adminInvitationListDataSchema,
  adminInvitationParamsSchema,
  adminInvitationIssueBodySchema,
  adminInvitationCommandBodySchema,
  adminInvitationAcceptBodySchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
  catalogSchema,
  adminCatalogSchema,
  packageEditSchema,
  referralEditSchema,
  referralSettingsDataSchema,
  configurationResultSchema,
  configurationOutcomeSchema,
  membershipSchema,
  purchaseQuoteBodySchema,
  purchaseQuoteSchema,
  confirmedPurchaseBodySchema,
  purchaseCommandResultSchema,
  purchaseResultSchema,
  purchaseHistorySchema,
  subscriptionHistorySchema,
  quoteOutcomeSchema,
  boundedPageQuerySchema,
  financialRequestKeySchema,
  walletViewSchema,
  ledgerPageSchema,
  ledgerFilterSchema,
  employeeLedgerDetailSchema,
  adminWalletViewSchema,
  adminFinancePageSchema,
  adminLedgerFilterSchema,
  adminLedgerDetailSchema,
  employeeTeamSummarySchema,
  employeeMemberPageSchema,
  employeeMemberFilterSchema,
  employeeCommissionPageSchema,
  commissionFilterSchema,
  rootIdentityPageSchema,
  rootSearchFilterSchema,
  adminTeamSummarySchema,
  adminMemberPageSchema,
  adminMemberFilterSchema,
  adminCommissionPageSchema,
  adminCommissionFilterSchema,
} from "@template/contracts";

import { appConfig } from "../../core/config/app.config.js";
import {
  changePasswordBodyDtoSchema,
  emailRequestBodyDtoSchema,
  loginBodyDtoSchema,
  registerBodyDtoSchema,
  resetPasswordBodyDtoSchema,
} from "../../modules/auth/dto/index.js";
import { updateProfileBodyDtoSchema } from "../../modules/users/dto/update-profile.dto.js";
import {
  quoteParamsSchema,
  purchaseParamsSchema,
  employeeMembershipParamsSchema,
} from "../../modules/subscriptions/subscriptions.controller.js";

import {
  operationParamsSchema,
  walletEmployeeParamsSchema,
} from "../../modules/wallets/wallets.controller.js";
import { referralRootParamsSchema } from "../../modules/referrals/referrals.controller.js";
import {
  packageParamsSchema,
  configurationParamsSchema,
} from "../../modules/packages/packages.controller.js";

const tokenParameter = tokenQuerySchema.shape.token.meta({
  param: {
    name: "token",
    in: "query",
  },
});

const jsonBody = (schema: z.ZodType) => ({
  required: true,
  content: { "application/json": { schema } },
});

const successEnvelope = (data: z.ZodType): z.ZodType =>
  successEnvelopeSchema.safeExtend({ data });

const successResponse = (description: string, data: z.ZodType) => ({
  description,
  content: { "application/json": { schema: successEnvelope(data) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorEnvelopeSchema } },
});

const publicActionErrors = {
  "400": errorResponse("Invalid request"),
  "403": errorResponse("Request forbidden"),
  "429": errorResponse("Rate limit exceeded"),
  "500": errorResponse("Unexpected server error"),
};
const commonErrors = {
  ...publicActionErrors,
  "401": errorResponse("Authentication failed"),
};

const adminReadErrors = {
  ...commonErrors,
  "404": errorResponse("Role-filtered target not found"),
};
const adminCommandErrors = {
  ...adminReadErrors,
  "409": errorResponse(
    "Stale version, unchanged or prohibited transition, or identity collision",
  ),
};
const adminReadSecurity = [{ BearerAuth: [] }];
const adminWriteSecurity = [{ BearerAuth: [], CsrfHeader: [] }];
const adminAuthority =
  "Requires current ACTIVE verified ADMIN and an owned unrevoked session. Responses use Cache-Control: no-store.";
const adminCommandAuthority = `${adminAuthority} Also requires matching CSRF, confirmed intent, reason, current version where applicable, and transactional audit.`;

const emptyObjectSchema = z.object({}).strict();
const messageSchema = z.object({ message: z.string() }).strict();
const validCredentialSchema = z.object({ valid: z.literal(true) }).strict();
const credentialValidation = (
  description: string,
  errors: typeof publicActionErrors | typeof commonErrors,
) => ({
  get: {
    summary: description,
    description:
      "Read-only credential check; does not consume the link or issue a session. Responses use Cache-Control: no-store. Limits apply to a single API process.",
    parameters: [tokenParameter],
    responses: {
      "200": successResponse("Current credential valid", validCredentialSchema),
      ...errors,
    },
  },
  head: {
    summary: `${description} without a response body`,
    parameters: [tokenParameter],
    responses: {
      "200": { description: "Current credential valid; not consumed" },
      ...Object.fromEntries(
        Object.entries(errors).map(([status, response]) => [
          status,
          { description: response.description },
        ]),
      ),
    },
  },
});
const healthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["ok", "error", "not_checked"]),
    uptime: z.string(),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .strict();

export const buildOpenApiDocument = () =>
  createDocument({
    openapi: "3.1.0",
    info: {
      title: `${appConfig.name} OpenAPI`,
      version: "1.0.0",
      description:
        "Identity and administrator API with live session authority, immediate revocation, CSRF, strict inputs and safe projections. Credential/account responses use no-store. Login/refresh cookies are Secure in production; refresh is HttpOnly at the auth path and readable CSRF is at /. Rate-limit evidence covers a single API process; deployed topology and company email/destination approval remain external gates.",
    },
    servers: [{ url: appConfig.apiPrefix, description: "Configured API" }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        RefreshCookie: {
          type: "apiKey",
          in: "cookie",
          name: "refreshToken",
        },
        CsrfHeader: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
        },
      },
      schemas: {
        IdentityUser: identityUserSchema,
        IdentityUserData: identityUserDataSchema,
        IdentitySessionData: identitySessionDataSchema,
        AdminData: adminDataSchema,
        AdminListData: adminListDataSchema,
        InvitationData: adminInvitationDataSchema,
        InvitationListData: adminInvitationListDataSchema,
        EmployeeRestrictionsData: employeeRestrictionsDataSchema,
        ErrorEnvelope: errorEnvelopeSchema,
      },
    },
    paths: {
      "/wallet/me": {
        get: {
          summary: "Read walletView",
          description:
            "Requires current ACTIVE verified USER and an owned unrevoked session. Private responses use Cache-Control: no-store.",
          security: adminReadSecurity,
          responses: {
            "200": successResponse(
              "Consistent private projection",
              walletViewSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/wallet/me/ledger": {
        get: {
          summary: "Read ledgerPage",
          description:
            "Requires current ACTIVE verified USER and an owned unrevoked session. Private responses use Cache-Control: no-store.",
          security: adminReadSecurity,
          requestParams: { query: ledgerFilterSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              ledgerPageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/wallet/me/ledger/{operationId}": {
        get: {
          summary: "Read employeeLedgerDetail",
          description:
            "Requires current ACTIVE verified USER and an owned unrevoked session. Private responses use Cache-Control: no-store.",
          security: adminReadSecurity,
          requestParams: { path: operationParamsSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              employeeLedgerDetailSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/wallets/{employeeId}": {
        get: {
          summary: "Read adminWalletView",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { path: walletEmployeeParamsSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              adminWalletViewSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/finance": {
        get: {
          summary: "Read adminFinancePage",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { query: adminLedgerFilterSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              adminFinancePageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/finance/{operationId}": {
        get: {
          summary: "Read adminLedgerDetail",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { path: operationParamsSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              adminLedgerDetailSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/referrals/me": {
        get: {
          summary: "Read employeeTeamSummary",
          description:
            "Requires current ACTIVE verified USER and an owned unrevoked session. Private responses use Cache-Control: no-store.",
          security: adminReadSecurity,
          responses: {
            "200": successResponse(
              "Consistent private projection",
              employeeTeamSummarySchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/referrals/me/members": {
        get: {
          summary: "Read employeeMemberPage",
          description:
            "Requires current ACTIVE verified USER and an owned unrevoked session. Private responses use Cache-Control: no-store.",
          security: adminReadSecurity,
          requestParams: { query: employeeMemberFilterSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              employeeMemberPageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/referrals/me/commissions": {
        get: {
          summary: "Read employeeCommissionPage",
          description:
            "Requires current ACTIVE verified USER and an owned unrevoked session. Private responses use Cache-Control: no-store.",
          security: adminReadSecurity,
          requestParams: { query: commissionFilterSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              employeeCommissionPageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/referrals/roots": {
        get: {
          summary: "Read rootIdentityPage",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { query: rootSearchFilterSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              rootIdentityPageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/referrals/{rootId}": {
        get: {
          summary: "Read adminTeamSummary",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { path: referralRootParamsSchema },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              adminTeamSummarySchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/referrals/{rootId}/members": {
        get: {
          summary: "Read adminMemberPage",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: {
            query: adminMemberFilterSchema,
            path: referralRootParamsSchema,
          },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              adminMemberPageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/referrals/{rootId}/commissions": {
        get: {
          summary: "Read adminCommissionPage",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: {
            query: adminCommissionFilterSchema,
            path: referralRootParamsSchema,
          },
          responses: {
            "200": successResponse(
              "Consistent private projection",
              adminCommissionPageSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/packages": {
        get: {
          summary: "Read current ordered package terms",
          description:
            "Current verified USER or ADMIN. Private no-store read; no financial effects.",
          security: adminReadSecurity,
          responses: {
            "200": successResponse("Current terms", catalogSchema),
            ...commonErrors,
          },
        },
      },
      "/admin/packages": {
        get: {
          summary: "Read package terms and effective subscription counts",
          description: `${adminAuthority} Counts at one serverNow use saved code and activation <= now < expiry under RepeatableRead. No-store.`,
          security: adminReadSecurity,
          responses: {
            "200": successResponse(
              "Current terms and counts",
              adminCatalogSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/admin/packages/{packageCode}": {
        patch: {
          summary: "Save reviewed future package terms",
          description: `${adminAuthority} Confirmation/reason required. Matching actor-command replay precedes version validation. CONFIGURATION_SUPERSEDED requires absent command and greater locked target version; generic stale/errors are nonterminal. No-store.`,
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestParams: { path: packageParamsSchema },
          requestBody: jsonBody(packageEditSchema),
          responses: {
            "200": successResponse(
              "Saved immutable change or replay",
              configurationResultSchema,
            ),
            ...commonErrors,
            "404": errorResponse("Configured package not found"),
            "409": errorResponse(
              "CONFIGURATION_SUPERSEDED, CONFIGURATION_STALE or changed command intent",
            ),
          },
        },
      },
      "/admin/referral-settings": {
        get: {
          summary: "Read current future referral rates",
          description: `${adminAuthority} Private no-store read.`,
          security: adminReadSecurity,
          responses: {
            "200": successResponse(
              "Current five rates",
              referralSettingsDataSchema,
            ),
            ...commonErrors,
          },
        },
        patch: {
          summary: "Save reviewed future referral rates",
          description: `${adminAuthority} Exactly five fixed-level rates; confirmation/reason. Actor-command replay before locked version validation; CONFIGURATION_SUPERSEDED is terminal only for this unchanged original intent. No-store.`,
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(referralEditSchema),
          responses: {
            "200": successResponse(
              "Saved immutable change or replay",
              configurationResultSchema,
            ),
            ...commonErrors,
            "409": errorResponse(
              "CONFIGURATION_SUPERSEDED, CONFIGURATION_STALE or changed command intent",
            ),
          },
        },
      },
      "/admin/configuration-changes/{commandId}": {
        get: {
          summary: "Observe own configuration command",
          description: `${adminAuthority} Actor-scoped no-store observation. NOT_OBSERVED is nonterminal; absent GET never proves supersession or authorizes replacement.`,
          security: adminReadSecurity,
          requestParams: { path: configurationParamsSchema },
          responses: {
            "200": successResponse(
              "COMMITTED or nonterminal NOT_OBSERVED",
              configurationOutcomeSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/subscriptions/me": {
        get: {
          summary: "Read own effective membership",
          description:
            "Current verified USER. Exclusive expiry is authoritative without a maintenance job; no-store.",
          security: adminReadSecurity,
          responses: {
            "200": successResponse("Membership", membershipSchema),
            ...commonErrors,
          },
        },
      },
      "/subscriptions/me/history": {
        get: {
          summary: "Read own saved subscription history",
          description:
            "Current verified USER; no-store. Bounded activation/id paging with consistent rows/count under RepeatableRead. Saved terms and lifecycle remain intact at expiry; reads perform no maintenance writes.",
          security: adminReadSecurity,
          requestParams: { query: boundedPageQuerySchema },
          responses: {
            "200": successResponse(
              "Saved subscriptions",
              subscriptionHistorySchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/admin/subscriptions/{employeeId}": {
        get: {
          summary: "Read an employee's effective membership",
          description: `${adminAuthority} No-store. Employee targets only; missing or non-employee IDs return 404. Saved CURRENT terms use activation <= serverNow < expiry without a maintenance job.`,
          security: adminReadSecurity,
          requestParams: { path: employeeMembershipParamsSchema },
          responses: {
            "200": successResponse("Employee membership", membershipSchema),
            ...adminReadErrors,
          },
        },
      },
      "/subscriptions/purchase-quotes": {
        post: {
          summary: "Review an owned full-price purchase",
          description:
            "Current verified USER, CSRF and bounded actor action limit. Ten-minute exclusive quote TTL, referral-first partial funding/top-up and disclosed Baghdad work dates. No debit or reservation.",
          security: adminWriteSecurity,
          requestBody: jsonBody(purchaseQuoteBodySchema),
          responses: {
            "201": successResponse("Owned quote", purchaseQuoteSchema),
            ...adminCommandErrors,
          },
        },
      },
      "/subscriptions/purchase-quotes/{quoteId}/outcome": {
        get: {
          summary: "Observe an owned purchase outcome",
          description:
            "Current verified USER; no-store. Shared buyer lock and fresh ReadCommitted observation. COMMITTED wins after expiry; live NOT_OBSERVED remains uncertain. EXPIRED_UNCOMMITTED requires the completed lock barrier; failed observation is never terminal evidence.",
          security: adminReadSecurity,
          requestParams: { path: quoteParamsSchema },
          responses: {
            "200": successResponse(
              "Authoritative observation",
              quoteOutcomeSchema,
            ),
            ...adminCommandErrors,
          },
        },
      },
      "/subscriptions/purchases": {
        post: {
          summary: "Commit or explicitly replay an owned full-price purchase",
          description:
            "Current verified USER, CSRF and bounded actor action limit. Atomically debits the FULL target price, replaces/creates the saved term and awards fixed-level event commissions. Upgrade commission base is the positive prior-snapshot price difference. Quote/key replay rechecks authority and binds incoming aliases; stale configuration/funds/membership/date preview reject without effects. 5xx/lost acknowledgement is uncertain: retain the original quote and observe its outcome.",
          security: adminWriteSecurity,
          requestParams: {
            header: z.object({
              "Idempotency-Key": financialRequestKeySchema.optional().meta({
                param: { required: false },
              }),
            }),
          },
          requestBody: jsonBody(confirmedPurchaseBodySchema),
          responses: {
            "201": successResponse(
              "New atomic purchase",
              purchaseCommandResultSchema,
            ),
            "200": successResponse(
              "Immutable purchase replay",
              purchaseCommandResultSchema,
            ),
            ...adminCommandErrors,
          },
        },
        get: {
          summary: "Read own saved purchase history",
          description:
            "Current verified USER; bounded stable time/id paging under RepeatableRead. Saved walletAfter is event history, not today's balance. No-store.",
          security: adminReadSecurity,
          requestParams: { query: boundedPageQuerySchema },
          responses: {
            "200": successResponse(
              "Saved purchase page",
              purchaseHistorySchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/subscriptions/purchases/{purchaseId}": {
        get: {
          summary: "Read an owned immutable purchase",
          description:
            "Current verified USER. Missing/foreign IDs return 404; saved CURRENT-at-purchase is separate from live lifecycle. No-store.",
          security: adminReadSecurity,
          requestParams: { path: purchaseParamsSchema },
          responses: {
            "200": successResponse("Saved purchase", purchaseResultSchema),
            ...adminReadErrors,
          },
        },
      },
      "/auth/register": {
        post: {
          summary: "Register with email and password",
          requestBody: jsonBody(registerBodyDtoSchema),
          responses: {
            "201": successResponse(
              "Pending employee and zero wallet created; provider acknowledged verification email (not mailbox delivery)",
              identityUserDataSchema,
            ),
            "409": errorResponse("Email already registered"),
            "503": errorResponse(
              "Verification dispatch failed or uncertain; pending account retained for resend",
            ),
            ...publicActionErrors,
          },
        },
      },
      "/auth/verify-email": {
        post: {
          summary: "Verify an email address",
          parameters: [tokenParameter],
          responses: {
            "200": successResponse("Email verified", identityUserDataSchema),
            ...publicActionErrors,
          },
        },
      },
      "/auth/resend-verification": {
        post: {
          summary: "Request another verification link",
          description:
            "Always returns a neutral response to prevent account enumeration.",
          requestBody: jsonBody(emailRequestBodyDtoSchema),
          responses: {
            "200": successResponse("Request processed", messageSchema),
            ...publicActionErrors,
          },
        },
      },
      "/auth/login": {
        post: {
          summary: "Create an authenticated session",
          requestBody: jsonBody(loginBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Signed in; refresh and CSRF cookies set",
              identitySessionDataSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/admin/login": {
        post: {
          summary: "Sign in as a currently ACTIVE verified administrator",
          description:
            "Reuses shared sessions and ordinary login source/account budgets. Missing, wrong-password, employee, pending and disabled identities receive generic 401 denial.",
          requestBody: jsonBody(loginBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Administrator signed in; refresh and CSRF cookies set",
              identitySessionDataSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/validate-verification-token": credentialValidation(
        "Validate an email-verification link",
        publicActionErrors,
      ),
      "/auth/validate-admin-invitation": credentialValidation(
        "Validate an administrator invitation",
        publicActionErrors,
      ),
      "/auth/admin-invitations/accept": {
        post: {
          summary: "Accept the current email-bound administrator invitation",
          description:
            "Public single-use action credential; requires current eligible issuer and unused invited email. Recipient sets a confirmed password, cannot override email/role/actor, and receives no session. Sign in after acceptance.",
          parameters: [tokenParameter],
          requestBody: jsonBody(adminInvitationAcceptBodySchema),
          responses: {
            "201": successResponse(
              "Verified administrator created without a session",
              identityUserDataSchema,
            ),
            "409": errorResponse(
              "Email already used or invitation state conflict",
            ),
            ...publicActionErrors,
          },
        },
      },
      "/auth/refresh": {
        post: {
          summary: "Rotate the refresh token and issue a new access token",
          security: [{ RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse(
              "Session refreshed",
              identitySessionDataSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/logout": {
        post: {
          summary:
            "Revoke the current stable session and its access/refresh authority",
          security: adminWriteSecurity,
          responses: {
            "200": successResponse("Signed out", emptyObjectSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/logout-all": {
        post: {
          summary:
            "Revoke all prior account sessions and access/refresh authority",
          security: adminWriteSecurity,
          responses: {
            "200": successResponse(
              "Signed out from all devices",
              emptyObjectSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          summary: "Request a password reset",
          description:
            "Always returns a neutral response to prevent account enumeration.",
          requestBody: jsonBody(emailRequestBodyDtoSchema),
          responses: {
            "200": successResponse("Request processed", messageSchema),
            ...publicActionErrors,
          },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Reset a password with a one-time token",
          parameters: [tokenParameter],
          requestBody: jsonBody(resetPasswordBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Password reset and existing sessions revoked",
              identityUserDataSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/validate-reset-token": credentialValidation(
        "Validate a password-reset link",
        commonErrors,
      ),
      "/auth/change-password": {
        patch: {
          summary: "Change the authenticated user's password",
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(changePasswordBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Password changed and existing sessions revoked",
              identityUserDataSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/users/me": {
        get: {
          summary: "Read the current user",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": successResponse("Current user", identityUserDataSchema),
            ...commonErrors,
          },
        },
        patch: {
          summary: "Update the current user's profile",
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(updateProfileBodyDtoSchema),
          responses: {
            "200": successResponse("Profile updated", identityUserDataSchema),
            ...commonErrors,
          },
        },
      },
      "/admin/employees/{userId}/restrictions": {
        get: {
          summary: "Read employee restrictions",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { path: identityUserParamsSchema },
          responses: {
            "200": successResponse(
              "Minimal USER control projection",
              employeeRestrictionsDataSchema,
            ),
            ...adminReadErrors,
          },
        },
        patch: {
          summary: "Apply versioned independent employee controls",
          description: `${adminCommandAuthority} Full denial revokes sessions/action links; restoration revives none. Preserve omitted controls, wallet sources, reservations and history. ADMIN targets are excluded.`,
          security: adminWriteSecurity,
          requestParams: { path: identityUserParamsSchema },
          requestBody: jsonBody(employeeRestrictionsBodySchema),
          responses: {
            "200": successResponse(
              "Employee controls updated",
              employeeRestrictionsDataSchema,
            ),
            ...adminCommandErrors,
          },
        },
      },
      "/admin/admins": {
        get: {
          summary: "List administrator identities",
          description: `${adminAuthority} ADMIN rows only; createdAt DESC, id DESC. Page/count share a read-only RepeatableRead snapshot. No invented activity timestamp.`,
          security: adminReadSecurity,
          requestParams: { query: identityListQuerySchema },
          responses: {
            "200": successResponse(
              "Bounded administrator page with pagination metadata",
              adminListDataSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/admin/admins/{userId}": {
        get: {
          summary: "Read an administrator identity",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { path: identityUserParamsSchema },
          responses: {
            "200": successResponse("Safe ADMIN identity", adminDataSchema),
            ...adminReadErrors,
          },
        },
      },
      "/admin/admins/{userId}/status": {
        patch: {
          summary: "Activate or deactivate verified administrator membership",
          description: `${adminCommandAuthority} Self-deactivation, pending membership denial and loss of the last eligible ADMIN are prohibited. Deactivation revokes sessions/action links and outstanding issuer invitations; restoration revives none.`,
          security: adminWriteSecurity,
          requestParams: { path: identityUserParamsSchema },
          requestBody: jsonBody(adminStatusBodySchema),
          responses: {
            "200": successResponse(
              "Administrator membership updated",
              adminDataSchema,
            ),
            ...adminCommandErrors,
          },
        },
      },
      "/admin/invitations": {
        get: {
          summary: "List current invitation generations",
          description: `${adminAuthority} createdAt DESC, id DESC with snapshot-consistent page/count. Terminal acceptance/revocation precedes expiry; delivery status is independent of disposition. Credentials/provider payloads are excluded.`,
          security: adminReadSecurity,
          requestParams: { query: identityListQuerySchema },
          responses: {
            "200": successResponse(
              "Bounded invitation page",
              adminInvitationListDataSchema,
            ),
            ...commonErrors,
          },
        },
        post: {
          summary: "Invite a new administrator to an unused email",
          description: `${adminCommandAuthority} Persist intent before bounded dispatch. Acknowledgement is provider API acceptance, not mailbox delivery. Known closure/supersession conflicts; failed or uncertain dispatch retains intent.`,
          security: adminWriteSecurity,
          requestBody: jsonBody(adminInvitationIssueBodySchema),
          responses: {
            "201": successResponse(
              "Invitation intent with current disposition and acknowledged delivery",
              adminInvitationDataSchema,
            ),
            "503": errorResponse(
              "Failed/uncertain dispatch; pending intent retained",
            ),
            ...adminCommandErrors,
          },
        },
      },
      "/admin/invitations/{invitationId}": {
        get: {
          summary: "Read the current safe invitation generation",
          description: adminAuthority,
          security: adminReadSecurity,
          requestParams: { path: adminInvitationParamsSchema },
          responses: {
            "200": successResponse(
              "Current disposition and independent delivery status",
              adminInvitationDataSchema,
            ),
            ...adminReadErrors,
          },
        },
      },
      "/admin/invitations/{invitationId}/reissue": {
        post: {
          summary: "Replace invitation authority with a new generation",
          description: `${adminCommandAuthority} Shares actor/recipient issue budgets and requires the 60-second replacement cooldown. Invalidates the old link; never overwrites an accepted identity/password.`,
          security: adminWriteSecurity,
          requestParams: { path: adminInvitationParamsSchema },
          requestBody: jsonBody(adminInvitationCommandBodySchema),
          responses: {
            "200": successResponse(
              "Current generation and delivery disposition",
              adminInvitationDataSchema,
            ),
            "503": errorResponse(
              "Failed/uncertain dispatch; new generation retained",
            ),
            ...adminCommandErrors,
          },
        },
      },
      "/admin/invitations/{invitationId}/revoke": {
        post: {
          summary: "Revoke an outstanding invitation generation",
          description: adminCommandAuthority,
          security: adminWriteSecurity,
          requestParams: { path: adminInvitationParamsSchema },
          requestBody: jsonBody(adminInvitationCommandBodySchema),
          responses: {
            "200": successResponse(
              "Invitation revoked",
              adminInvitationDataSchema,
            ),
            ...adminCommandErrors,
          },
        },
      },
      "/health/live": {
        get: {
          summary: "Liveness check",
          responses: { "200": successResponse("Service alive", healthSchema) },
        },
      },
      "/health/ready": {
        get: {
          summary: "Readiness check",
          responses: {
            "200": successResponse("Service ready", healthSchema),
            "503": errorResponse("Database unavailable"),
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI 3.1 document",
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
    },
  });
