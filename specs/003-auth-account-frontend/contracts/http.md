# P03 HTTP Consumer Contract

**Status**: Existing P02 endpoints with implemented validated browser consumers; final acceptance evidence is recorded in [quickstart.md](../quickstart.md). No new backend endpoint is designed. Default prefix is `/api/v1`; use the configured central base URL. Paths below are prefix-relative. Backend source owners: auth/admin/users routes/controllers/services and shared auth/identity/admin/http schemas.

## Parsing and Security

Receive unknown data. Validate successEnvelopeSchema, actual HTTP status/statusCode agreement, then operation data. Accept tokens/DTOs only for the current epoch/check/flow. Return safe domain data to caches; token-bearing responses, raw Axios/Zod errors, config, bodies, URLs, stacks and nested causes are not cached. Map controlled codes/known editable fields to approved Arabic feedback; raw server message is not display authority.

Existing identitySessionDataSchema/identityUserDataSchema replace legacy web AuthSessionData/AuthUserData assumptions. adminSchema differs from identityUserSchema. Strict private/extra-field and role/status validation is mandatory. Implemented credentialValidityDataSchema, neutralEmailDataSchema and emptyActionDataSchema describe existing replies; their definitions are in [data-model.md](../data-model.md#proposed-small-shared-reply-schemas).

Preserve bearer access in memory, HttpOnly refresh cookie, readable CSRF cookie and x-csrf-token handling. Authenticated writes require existing CSRF protections; refresh requires CSRF when its cookie is present. Current server account/session/role/resource checks remain independent of client guards. No role selector, public admin signup or client audit actor is introduced.

## Authentication and Account Operations

| Method/path                           | Parsed request                                    | Success data                               | HTTP |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------------ | ---- |
| POST /auth/register                   | registerBodySchema                                | identityUserDataSchema                     | 201  |
| POST /auth/login                      | loginBodySchema                                   | identitySessionDataSchema                  | 200  |
| POST /auth/admin/login                | loginBodySchema                                   | identitySessionDataSchema, permitted ADMIN | 200  |
| POST /auth/refresh                    | Existing refresh cookie/CSRF; empty body          | identitySessionDataSchema                  | 200  |
| GET /users/me                         | Current bearer/session authority                  | identityUserDataSchema                     | 200  |
| GET /auth/validate-verification-token | tokenQuerySchema                                  | credentialValidityDataSchema               | 200  |
| POST /auth/verify-email               | tokenQuerySchema; empty body                      | identityUserDataSchema                     | 200  |
| POST /auth/resend-verification        | emailRequestBodySchema                            | neutralEmailDataSchema                     | 200  |
| POST /auth/forgot-password            | emailRequestBodySchema                            | neutralEmailDataSchema                     | 200  |
| GET /auth/validate-reset-token        | tokenQuerySchema                                  | credentialValidityDataSchema               | 200  |
| POST /auth/reset-password             | tokenQuerySchema; resetPasswordBodySchema         | identityUserDataSchema                     | 200  |
| PATCH /auth/change-password           | changePasswordBodySchema; bearer/CSRF             | identityUserDataSchema                     | 200  |
| POST /auth/logout                     | Empty body; bearer/CSRF                           | emptyActionDataSchema                      | 200  |
| POST /auth/logout-all                 | Empty body; bearer/CSRF                           | emptyActionDataSchema                      | 200  |
| GET /auth/validate-admin-invitation   | tokenQuerySchema                                  | credentialValidityDataSchema               | 200  |
| POST /auth/admin-invitations/accept   | tokenQuerySchema; adminInvitationAcceptBodySchema | identityUserDataSchema, no session         | 201  |

Token query is a single bounded string, 1–4096 characters. Pass it only to its declared existing API operation. Validation returns only {valid:true}, never email/role/expiresAt; it consumes nothing. Never decode claims for authority or automatically POST on mount/reload/preview. Explicit verification/reset/acceptance still checks expiry/current generation/purpose at commit.

Generic /auth/login accepts eligible USER or ADMIN; employee entry uses its real returned role for navigation. Only /auth/admin/login imposes admin-only sign-in. Approved forms submit rememberMe:false because no selector is approved. Keep existing-password/new-password/confirmation/referral semantics in the [data model](../data-model.md).

Registration returns pending identity without session or financial entitlement. Verification returns committed identity without auto-login. Acceptance creates one verified admin without auto-login. Reset/change success require fresh sign-in and invalidate the target account's previous sessions. Ordinary logout invalidates only its session; logout-all remains compatible without adding a new UI control.

Resend/forgot responses remain neutral for unknown/ineligible recipients and swallowed delivery failures. Acknowledgement cannot prove mailbox receipt. Registration provider failure may follow a committed pending account; do not resubmit automatically or claim persistence failed.

## Administrator Operations

All routes below require current active verified ADMIN. Writes additionally preserve CSRF/current transactional authority and server-derived audit. List query is existing identityListQuerySchema: only page/limit, defaults 1/25, maximum limit 100, safe offset. No search/status filter capability is assumed.

| Method/path                                   | Parsed request                               | Success data                  | HTTP |
| --------------------------------------------- | -------------------------------------------- | ----------------------------- | ---- |
| GET /admin/admins                             | identityListQuerySchema                      | adminListDataSchema           | 200  |
| GET /admin/admins/:userId                     | identityUserParamsSchema                     | adminDataSchema               | 200  |
| PATCH /admin/admins/:userId/status            | Params plus adminStatusBodySchema            | adminDataSchema               | 200  |
| GET /admin/invitations                        | identityListQuerySchema                      | adminInvitationListDataSchema | 200  |
| GET /admin/invitations/:invitationId          | adminInvitationParamsSchema                  | adminInvitationDataSchema     | 200  |
| POST /admin/invitations                       | adminInvitationIssueBodySchema               | adminInvitationDataSchema     | 201  |
| POST /admin/invitations/:invitationId/reissue | Params plus adminInvitationCommandBodySchema | adminInvitationDataSchema     | 200  |
| POST /admin/invitations/:invitationId/revoke  | Params plus adminInvitationCommandBodySchema | adminInvitationDataSchema     | 200  |

Issue body: fullName, email, entered reason, confirmed:true. Status body: ACTIVE or DEACTIVATED, reason, confirmed:true, expectedVersion from current accountVersion. Reissue/revoke: reason, confirmed:true, expectedVersion from current tokenVersion. Confirmation literal is sent only after genuine explicit review/action; do not fabricate reason strings or version/actor/time. Existing name/email editing is unsupported.

Lists supply authoritative data.pagination; where paginationMeta is present it must agree. No item array longer than 100, current-page status totals labeled global, unbounded page collection or fixture fallback. Recover an out-of-range page from that settled same-scope result; distinguish empty from unavailable/denied.

Display server invitation status separately from deliveryStatus. ACKNOWLEDGED is provider acceptance, not mailbox receipt or invitation acceptance. Reissue replaces generation/issuer and may permit unaccepted revoked/expired invitations under server cooldown/current state. Revoke requires outstanding pending/current generation; do not derive eligibility solely from client time. Acceptance additionally requires eligible current issuer. Deactivation revokes authority/invitations; restore never revives old sessions.

## Failure and Retry Agreement

| Observed code/status        | Consumer behavior                                                                                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VALIDATION_ERROR / 400      | Safe mapping to known current editable fields; no raw request/error echo.                                                                                                                                                                         |
| BAD_REQUEST / 400           | Safe invalid action/referral/password feedback according to operation; no invented precise cause from a generic code.                                                                                                                             |
| UNAUTHORIZED / 401          | Protected authentication denial retires authority after the controlled shared refresh path. Public reset-link failure is a link outcome, not permission to refresh/replay or revoke an unrelated identity.                                        |
| FORBIDDEN / 403             | Deny operation; distinguish expected role boundary/current authority reconciliation from policy/CSRF denial. Do not infer global revocation from this code alone.                                                                                 |
| NOT_FOUND / 404             | Safe absent target/link outcome, no default row or hidden success.                                                                                                                                                                                |
| CONFLICT / 409              | Refresh authorized target/version/list and retain appropriate safe draft. May represent collision, stale/current generation, cooldown, self/last-admin/pending target or ineligible transition; do not promise a finer code than server provides. |
| RATE_LIMIT_EXCEEDED / 429   | Approved cooldown/rate-limit feedback and explicit permitted retry; no local limit bypass or guessed authoritative deadline.                                                                                                                      |
| SERVICE_UNAVAILABLE / 503   | Retryable read feedback; command may have committed before provider failure. Reconcile rather than replay or claim rollback.                                                                                                                      |
| Network/lost response       | Explicit unavailable/uncertain state; observation failure does not prove server failure/revocation.                                                                                                                                               |
| Invalid successful response | Safe non-retryable contract error; accept no token/user/list/default value or leaked parser payload.                                                                                                                                              |

Read retries retain the existing bounded policy only for classified transient transport/server failures. Cancellation, obsolete scope, contract errors and confirmed denials are not blindly retried. Mutations retain retry:false and no offline replay. A controlled authenticated 401 replay is allowed only where server authentication necessarily rejects before use-case execution; public one-time action failures are excluded.

Lost status/reissue/revoke results reconcile existing authorized detail/list state without attributing another actor's newer state to this request. Lost issuance without ID can be investigated only through existing bounded lists; absence on one page is inconclusive. Keep uncertainty visible rather than invent search/idempotency endpoints, fetch every page or automatically issue again. Password uncertainty requires fresh sign-in/recovery, not automatic single-use resubmission or claimed success from old-session denial.

Credential links use existing email destinations: shared /auth/verify-email and /auth/reset-password; explicitly configured ADMIN_INVITATION_ACCEPT_URL targets /admin/auth/accept-invitation. Test configuration uses approved loopback origin only; production destinations/company delivery remain launch gates.
