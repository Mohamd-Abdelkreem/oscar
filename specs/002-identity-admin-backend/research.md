# P02 Research: Identity, Authorization, and Admin Backend

**Date**: 2026-10-03 | **Status**: Design decisions for the [specification](spec.md); proposed behavior is not implemented or tested by PLAN.

## Evidence and planning gates

The selected feature pointer is `specs/002-identity-admin-backend`. The actual Git branch is `001-financial-backend-foundation`; `setup-plan.sh` reports the selected feature basename as `BRANCH`, which does not establish a Git branch change. There were no previous P02 planning artifacts and no extension-hook file. The populated constitution, entire roadmap, eight engineering guides, current callers, installed dependencies and predecessor evidence were inspected.

Pre-research constitution review passes for this bounded backend design: it preserves existing ownership, frozen UI, financial history, current authority and required future verification. The [P01 evidence](../001-financial-backend-foundation/tasks.md) records completed implementation/remediation and 67 migrated-database tests. Owner-selected read-only CONVERGE on 2026-10-03 returned zero findings after checking 74 requirements/acceptance criteria, 40 tasks, eight design areas and seven constitution principles; P01 tasks were unchanged and no tests were run. Its predecessor gate is closed. P02 requirements review/actual acceptance and the missing admin login/other frozen-surface decisions before P03 remain separate gates.

## 1. Existing stack and ownership

**Decision:** Extend existing Express auth/users, shared contracts and Prisma persistence. Add focused admin and session responsibilities; retain package names, versions and the pnpm/Turborepo workflow. No new dependency is selected.

**Rationale:** Manifests establish Node `>=24 <25`, pnpm `>=11 <12` with package manager `11.17.0`, TypeScript `5.9.3`, Express `5.2.1`, Zod `4.4.3`, Prisma/client/adapter-pg `7.9.1`, jsonwebtoken `9.0.3`, Argon2 `0.45.1`, express-rate-limit `8.6.1`, Resend `6.20.0`, Vitest `4.1.10`, Supertest `7.1.4` and Testcontainers `12.1.0`. Integration setup uses PostgreSQL `18.4` and deploys migrations to disposable databases. Existing security/email/response adapters already establish the protocol.

**Alternatives considered:** A second auth framework, universal repository/DI layer, Redis service, generic notification outbox and event bus add unneeded authority or infrastructure. None is required to satisfy P02 on the explicitly bounded API topology.

## 2. Stable session authority

**Decision:** Introduce a stable `AuthSession` per login. Access and refresh JWTs require `sessionId`, retain existing rotating `tokenId`/`jti`, purpose, issuer, audience and HS256 checks. Refresh rows belong to the stable session and its user. Protected requests check live User plus owned, unrevoked, unexpired session; signed role is informational.

**Rationale:** Today middleware checks current User but has no session lookup. Deleting refresh rows on reset/logout does not revoke already issued access tokens. Using the rotating refresh row as access authority would unexpectedly invalidate access on ordinary refresh. A stable session supports multiple devices, immediate revocation and absolute family expiry without that coupling.

**Alternatives considered:** A JWT blacklist, refresh-row existence checks and `User.authRevision` were considered. A common User lock orders every issuance/rotation/revocation, and session tombstones are checked live; an additional account-wide auth revision is redundant. `accountVersion` below has only stale-command semantics.

## 3. Transactional authority and races

**Decision:** Every login, refresh, logout, reset/change and consequential profile/admin write locks the relevant User rows before checking changing authority and committing. Admin-population/invitation operations first lock the singleton admin guard, then User IDs ascending, sessions, refresh credentials and invitations in deterministic order. Preserve P01's User-before-wallet-before-allocation order whenever sharing those owners. Hashing and network calls remain outside transactions.

Login/password comparison may run before the transaction, but must recheck the exact password hash under lock. Refresh consumes the exact current hash/id once, retaining the stored original expiry. Revocation marks stable sessions and deletes their refresh credentials atomically. If refresh wins first, revocation covers the replacement; if revocation wins first, refresh fails. Restoration never clears revocation. Authenticated mutations recheck actor session, account, role and target state after locks; middleware alone cannot authorize a racing write.

**Rationale:** Existing refresh and profile writes pre-read authority before narrower mutations. Those checks can race a reset or full suspension. P01 already uses parameterized `Prisma.sql` and explicit sorted locks, so focused identity helpers can follow that pattern.

Evaluate expiry using an actual server instant after lock acquisition, rather than transaction-start time. Transactions use maxWait 5,000 ms, timeout 10,000 ms and at most three total attempts with zero deliberate delay. Retry only P2034 or known Prisma adapter errors with driverAdapterError.cause.originalCode exactly 40001/40P01, matching the inspected P01 installed-adapter evidence. Recheck eligibility/expiry/intent each time; do not retry stale intent, arbitrary nested code/text, uniqueness or provider errors. No provider call is allowed in the retry body.

**Alternatives considered:** Global serializable isolation, process mutexes and optimistic pre-reads alone either broaden contention or fail across processes. See [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html), [date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html) and [Prisma transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

## 4. Sponsor identity and atomic wallet provisioning

**Decision:** Each employee has unique `referralCode`, 32 lowercase hexadecimal characters generated from a random UUID, and nullable immutable `sponsorUserId`. Incoming `referralCode` resolves an existing USER; omission means permanently unassigned. Freeze role, own code and sponsor relationship, including null, with database protection after the historical backfill. No public sponsor-ID patch or role assignment exists. Registration creates User, sponsor decision and the existing zero Wallet atomically before email delivery.

**Rationale:** An insert-only sponsor edge to an existing employee, combined with immutable edges and a no-self check, cannot form a cycle. Database uniqueness/FK/check/trigger protections cover direct writes and concurrency as well as HTTP validation. Historical accounts get codes but no invented sponsors. Generate an internal code for every stored User; a database default supports existing direct fixtures and admin creation, while only employee codes resolve as sponsors and safe admin projections expose `referralCode: null`.

**Alternatives considered:** User-editable sponsor IDs, retroactive referral inference and code values from fixtures violate the approved immutable tree. A separate referral service or commission model belongs to P04. Only the exact referralCode unique constraint gets at most three fresh-code attempts without delay; exhaustion safely fails 503 with no partial provisioning, never a uniqueness bypass.

## 5. Status and independent restrictions

**Decision:** Keep existing employee states `PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`; append employee `BANNED` and admin `DEACTIVATED`. Use independent `tasksBlocked` and `withdrawalsBlocked` booleans plus nonnegative `accountVersion` for version-guarded status/restriction commands. Profile edits do not arbitrarily overwrite this versioned control state. Admin lifecycle is a separate role-specific service.

**Rationale:** Full denial revokes all sessions. Partial controls do not deny login or alter the other control. The current SQL check requires verification for every nonpending status; replace it so ACTIVE requires verification while unverified suspension/ban remains representable. Restore an employee to ACTIVE only if already verified, otherwise PENDING_VERIFICATION. Activation consumes only a current pending credential and never unsuspends. Admin activation requires a verified DEACTIVATED account; historical pending admins remain ineligible until ordinary email activation. Normalize historical ADMIN SUSPENDED to DEACTIVATED.

**Alternatives considered:** One restriction enum cannot represent independent task/withdrawal blocks. A generic User patch would bypass role/lifecycle safety. P02 does not cancel withdrawals, award commissions, change wallets or claim downstream task enforcement.

Correction: accountVersion advances once on every status/restriction transition, including public email activation, so prior confirmed admin intent becomes stale. Full denial clears verification/reset pairs with session revocation; restoration requires new eligible links. Profile/password changes do not advance control version. ADMIN lifecycle targets verified ACTIVE/DEACTIVATED identities only; denial of already-provisioned pending membership/verification is excluded until email proof. Outstanding invitations remain revocable.

## 6. Irreversible bootstrap and last-admin guard

**Decision:** Add one `AdminSetupState` row (ID 1) with an irreversible first-admin account/time marker. Seed the marker from any historical ADMIN, including pending/inactive, so setup cannot reopen. Lock this row for bootstrap and all admin-population/invitation mutations. All denial paths retain at least one active verified admin; self-deactivation is always rejected.

Provide a protected local application CLI, outside HTTP routing. It accepts fullName/email/password/reason through protected stdin, derives operator identity from the protected OS runner, hashes outside the transaction, then creates one PENDING_VERIFICATION ADMIN plus marker and audit atomically. Send ordinary verification after commit. Failure or uncertain send retains recoverable pending state. The proposed compiled entrypoint and script must be verified during implementation; they do not exist today.

Correction: this is a protected Linux CLI with required CLI-only ADMIN_BOOTSTRAP_OPERATOR_UID. Match an explicit nonroot UID to real/effective OS/process identity before input or database/provider access; fail closed on missing, unsupported, elevated or mismatched identity. Audit trusted UID/name, never submitted identity or USER/USERNAME environment values. The protected launch configuration/OS secret permissions are external operator evidence. A historical database must retain at least one ACTIVE verified or ordinarily recoverable pending ADMIN before cutover. Only-ineligible historical admins halt preflight/authority migration unchanged; no bootstrap reopening, implicit activation or rescue path is introduced.

**Rationale:** One database row serializes bootstrap, last-admin competition and invitation/issuer lifecycle races across API processes. Email proof, rather than an operator-supplied verified timestamp, grants initial active authority. A permanent marker survives all later deactivations.

**Alternatives considered:** A public bootstrap route, production use of the local seed, counting admins without a coordinating lock, or a resettable marker can create unauthorized/additional first admins. Advisory locks were considered; a visible constrained singleton row also stores the required durable completion evidence.

## 7. Single-use invitation generations

**Decision:** Keep one invitation intent per normalized email, recording fullName, current issuer, hash, positive generation (`tokenVersion`), issue/expiry instants, acceptance/revocation evidence and safe email-attempt status. Use a distinct `ADMIN_INVITATION` JWT purpose signed with the explicit verification key; bind invitation ID, generation and normalized email. Validate purpose before database use. Default lifetime remains the current verification duration (24 hours).

Issue/reissue/revoke require current admin session, explicit confirmation and a nonblank reason. Reissue replaces the current generation and issuer; old tokens remain unusable. Acceptance under guard/User/invitation locks proves invited email, checks current issuer authority and unused email, creates one ACTIVE verified ADMIN with the recipient's password, consumes the credential and commits audit. It does not create a second session-issuance path; recipient signs in through shared admin login. Issuer deactivation revokes all outstanding invitations atomically; already accepted accounts are not undone.

**Rationale:** Unique intent/email and exact generation/hash checks prevent competing acceptance, password overwrite and revival. Expiry is derived at `now >= expiresAt`; no expiry worker is necessary. Read-only validation never consumes a credential.

**Alternatives considered:** Public ADMIN registration, promotion of existing employees, invitations overwriting an existing admin, storing raw links, a fifth mandatory signing key and detached unobservable delivery do not serve the approved scope.

Correction: disposition precedence is ACCEPTED, then REVOKED, then EXPIRED, otherwise PENDING; delivery remains independent. Recheck generation/issuer/outstanding eligibility before dispatch/retry, and condition results after I/O. Same-generation acknowledgement returns fresh current disposition; superseded generation returns 409, failed/uncertain send 503. A late unusable email is possible after a concurrent closure; locks never span network I/O. The [operations contract](contracts/operations.md#resend-boundary-and-failure-semantics) defines the observable race cases.

## 8. Recoverable email and bounded provider transport

**Decision:** Persist complete pending state before delivery, retain it on rejection or uncertainty, and allow bounded resend/reissue. Store invitation email attempt as UNKNOWN before network dispatch, then generation-condition its safe ACKNOWLEDGED/REJECTED/UNKNOWN update. ACKNOWLEDGED means API acceptance, never mailbox delivery. No raw action token, rendered email or private provider response is persisted in account/audit output. A crash before/after dispatch remains recoverable by credential replacement rather than guessed delivery.

Use the existing protected email adapter owner with a narrow typed native-fetch Resend REST transport. Preserve Resend as production provider and installed dependencies; do not use SDK private overrides or global console/environment mutations. Restrict destination to the official HTTPS API origin, prohibit redirects and implicit `RESEND_BASE_URL`, bound request/response handling and retry duration, validate the successful provider ID and project errors to allowlisted codes. Keep at most three existing retry attempts with the same key and identical payload for one generation/attempt. An ambiguous attempt remains UNKNOWN unless subsequently acknowledged; a later rejection alone does not erase earlier uncertainty.

The verified request is `POST https://api.resend.com/emails`, with Authorization, JSON content type and Idempotency-Key headers, allowlisted from/to/subject/html and optional REST `reply_to`. Proposed local bounds are 10 seconds per attempt and a 64 KiB streamed response cap, using `AbortSignal.timeout(10_000)` through body consumption and `redirect: "error"`; tests inject this transport rather than changing global behavior. See the [official Resend endpoint](https://resend.com/docs/api-reference/emails/send-email), [Node 24 timed abort API](https://nodejs.org/download/release/v24.0.0/docs/api/globals.html#static-method-abortsignaltimeoutdelay) and [Fetch redirect policy](https://fetch.spec.whatwg.org/#dom-requestinit-redirect). These numeric bounds are project design choices, not provider guarantees.

**Rationale:** Installed Resend 6.20.0 turns network/JSON failures into an error result, has no typed send timeout/signal, implicitly honors a base-URL environment override, and prints provider errors outside production. Existing adapter sanitization does not control that SDK path. A small provider adapter using Node 24 fetch can express the timeout/origin/redaction boundary without replacing auth or introducing dependencies. The existing registration deletion and detached resend behavior must deliberately change.

**Alternatives considered:** Blind send retries with new keys, declaring provider acceptance delivered, deleting pending identities, retaining reusable credentials in an outbox, and SDK monkey-patching were rejected. Stable idempotency keys apply within provider retention, not as a permanent exactly-once guarantee. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) and [event meanings](https://resend.com/docs/webhooks/event-types). The exact HTTP mapping and bounds are recorded in the email/operations contract after primary-source verification.

The current resend predicate rejects a pending account with null action hash/expiry. Change that predicate under User lock: an otherwise eligible pending employee/admin without a current credential receives a fresh bound verification link; cooldown applies only when prior issuance exists. Otherwise migration-cleared pending identities would have no recovery path. Keep public response neutral and full-denied accounts ineligible.

Recovery at issuance, GET/HEAD validation and consumption requires current ACTIVE verified USER/ADMIN; partial controls remain eligible, all pending/unverified/fully denied states are ineligible. Preserve clearing outstanding reset credentials on password change. User-lock serialization invalidates recovery issued before change and permits fresh eligible issuance after it. Resend/forgot neutrality covers equal status/content/headers for equivalent limiter histories, including provider failure; provider-dependent timing equalization is explicitly excluded. The [HTTP contract](contracts/http-api.md#authentication-and-own-account) owns these decisions, not a new recovery service.

## 9. Production auth/provider configuration

**Decision:** In production explicitly require all four existing signing settings: `AUTH_JWT_SECRET`, `AUTH_REFRESH_JWT_SECRET`, `AUTH_VERIFICATION_JWT_SECRET`, `AUTH_RESET_JWT_SECRET`. Preserve the 32-character minimum, reject empty/whitespace values and known repository example/local/test defaults, compare all six pairs, and permit no fallback. Configuration failures name purposes/settings without values. Isolate the parser for unit tests; preserve JWT string encoding and installed library behavior.

Require production Resend configuration and explicitly configured company sender/name/support identity; do not inherit boilerplate/example identity or console previews. Retain validated HTTPS `WEB_APP_URL`. A proposed `ADMIN_INVITATION_ACCEPT_URL` must stay on that approved web origin and point to an owner-approved invitation/password-setting surface. Production startup/sending is gated until that destination is approved; do not invent a frontend route. Existing verification/reset URLs remain `/auth/verify-email` and `/auth/reset-password`, with administrator reuse subject to P03 review.

**Rationale:** Current refresh/verify/reset configuration falls back to the access key even in production, and current mail identity has example defaults. Length/distinctness checks implement the specified acceptance cases but cannot prove random entropy. Company/provider credentials and actual sender-domain readiness are external launch prerequisites.

**Alternatives considered:** Automatic key generation at startup, a secret-management framework, weaker development fallbacks in production, a made-up company address, or a fabricated invitation route are outside scope.

## 10. Rate limits and actual topology

**Decision:** Retain installed express-rate-limit and existing bounded source/account/token limits, adding admin entry and invitation/admin command limits through their existing owner. Credential keys are hashed; authenticated admin keys derive from the live actor. This design explicitly supports **one API process** with the current MemoryStore. Counter loss on restart is documented, and a VPS or a single launch script alone is not proof of deployed process count.

**Rationale:** No multi-process production topology or shared limiter infrastructure is established. Before deployment acceptance, verify that all API traffic reaches the one limiter process and proxy/source identity is correct. If replicas/processes are introduced, FR-033 remains blocked until a shared store and fail-closed failure tests are implemented and verified.

**Alternatives considered:** Speculatively adding Redis or custom PostgreSQL rate-limit tables increases infrastructure without evidence of need. Do not claim process-local tests establish cross-replica protection. See [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration).

Current refresh limiter keys include the rotating credential hash, so successful rotation resets that bucket. Preserve its bounded attempt protection but add a bounded source bucket before credential work and a verified stable-session/source bucket (default 60 each per 15 minutes) for refresh. Derive current-logout keys from authenticated stable session ID rather than the cookie hash. Admin login shares ordinary-login buckets so changing entrypoint cannot reset them. These are necessary corrections within the existing limiter owner, not evidence that today's keys already enforce a stable session budget.

## 11. Safe contracts, audit and frozen consumers

**Decision:** Preserve ResponseHelper envelopes, bearer-access JSON, HttpOnly refresh cookie, readable CSRF cookie/header and auth cookie path. Put admin login at proposed `/auth/admin/login` to reuse those owners. Keep current `/users/me` name/phone edits only. Shared schemas strictly allowlist registration, identity controls, admin lifecycle and invitation inputs/outputs. Add append-only identity/admin audit separately from P01 financial audit; actor/time/outcome derive from trusted context, with required reasons and allowlisted state snapshots.

**Rationale:** Account DTOs must never expose hashes, raw tokens, provider payloads or fabricated fixture identity. Admin entry uses generic credential denial; privileged callers may receive safe conflict/expiry/provider-state messages. Current-session context is internal and separate from the public user DTO.

Correction: keep existing legacy safeUser/authUserData/authSessionData schemas/types unchanged for frozen web fixtures/callers. Add strict identityUser/identityUserData/identitySessionData schemas reusing their fields, requiring P02 additions and role-compatible status, for API producer aliases/OpenAPI. Existing web adapters use typed Axios responses without parsing those legacy schemas; P03 adopts the full identity exports. This preserves one wire protocol and required-field validation with zero web edits. Confirmation is required only for reset/change/invitation acceptance, retaining strict password-only registration. The data model enumerates audit action/actor/COMMITTED-outcome/snapshot rules. Lists use createdAt DESC, id DESC and one bounded read-only RepeatableRead page/count snapshot.

Current response paths use Express `request.path`, excluding token query values, and existing request sanitization handles recognized query credentials. Remaining gaps require bounded shared corrections: serialized Referer headers can contain action links; unexpected errors are logged as raw objects and copied to development stacks. Under existing request-sanitizer/logger/error-handler owners, omit credential-bearing referrers and raw unexpected error objects/messages/stacks from ordinary logs and HTTP diagnostics in every environment. Keep safe operational codes/metadata and test the actual HTTP/logger boundary with sentinels. Request IDs may be client-supplied validated correlation values; they are not audit actors or universally server-generated identifiers.

P03 must reconcile the missing `/admin/auth/login`, invitation/password-setting destination, create-admin invitation semantics/reason, lifecycle reasons, restriction-removal reasons, edit-admin email control, and fixture-only last-active data. Recovery copy currently says two hours/employee while reset defaults remain 30 minutes. Central transport will need public-endpoint allowlist changes in P03. No frontend source is edited or approved by P02 PLAN.

**Alternatives considered:** UI redirects as authorization, arbitrary User patches, adding hidden success behavior, invented `lastActiveAt` values and frozen UI changes violate scope or truthfulness.

## 12. Forward migration and verification boundary

**Decision:** Add enum values in a committed forward migration before using them in a second migration. Preserve all P01 tables/amounts/postings. Backfill missing employee wallets once with explicit IDs/update timestamps and `ON CONFLICT(owner_user_id) DO NOTHING`; assign codes without invented sponsors; install invariants after backfill; seed the guard; invalidate legacy refresh and unbound action hashes. Reject access tokens missing `sessionId`. Coordinate schema/API cutover and require fresh sign-in/resend, without a legacy authority bypass.

Boundedly adjust local seed behavior to avoid existing role/password/status/sponsor replacement and provision new employees consistently. Update existing schema inventory expectations and test cleanup for restrictive owned-wallet/session/audit relations; never remove financial history to make a fixture pass.

Audited administrator/invitation fixtures cannot be deleted in relation order because audit is append-only with restrictive references. Use unique per-test IDs/emails and retain those fixtures until disposable database teardown, or isolate the scenario database. Existing employee-only cleanup may remove only owned empty/no-history rows in valid order.

**Rationale:** PostgreSQL enum values cannot be used until their adding transaction commits. Existing P01 SQL has no wallet ID/update-time default. New immutable identity constraints otherwise break the seed's overwrite behavior. See [PostgreSQL ALTER TYPE](https://www.postgresql.org/docs/18/sql-altertype.html) and [Prisma custom migrations](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations).

**Alternatives considered:** Editing old migrations, `db push`, resetting historical wallets, inferring sponsors and trusting legacy token families were rejected. Actual upgrade/rollback/replay/concurrency evidence belongs to the future implementation and real migrated PostgreSQL harness, not this documentation command.

The owning-artifact corrections above resolve the previously identified internal design findings; checklist evidence review and actual P02 acceptance remain pending. P01 convergence passed the owner-selected read-only review. P03 owner decisions, provider/company/bootstrap-runner configuration and deployment-topology verification remain explicit external gates, without a claimed pass. Provider retry classification/waits are local policy enumerated in the operations contract, not a guarantee inferred from provider status alone.
