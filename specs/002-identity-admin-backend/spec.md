# Feature Specification: P02 - Identity, Authorization, and Admin Backend

**Feature Branch**: `001-financial-backend-foundation` (existing branch; no branch-creation hook is installed)

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "PHASE_ID=P02 - Identity, Authorization, and Admin Backend. Read docs/workflow/speckit-prompts.txt. Apply OPERATING CONTRACT and execute SPECIFY only."

**Roadmap Phase**: P02 - Identity, Authorization, and Admin Backend

**Feature Directory**: specs/002-identity-admin-backend

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: P02 from [PLAN.md](../../PLAN.md), Section 7: employee email/password registration and email-link activation/recovery; immutable sponsor assignment and zero-balance wallet provisioning; account, task-only and withdrawal-only restrictions; owner-safe profiles; current role/status/session authority and effective session revocation; administrator email/password sign-in; protected first-admin bootstrap; single-use administrator invitations, list/read and activation/deactivation; last-admin/self-lockout protection; and production auth-credential validation. Sections 3.1, 3.8 and 5.6 supply applicable business/security rules. Extend the existing shared authentication.
- **Exclusions**: P01 arithmetic/calendar/ledger reimplementation; referral awards, subscriptions, purchases and wallet-history views (P04); tasks/proofs/rewards (P06); deposits/custody (P08); withdrawal requests, cancellation, reservation release and payouts (P10-P11); cross-domain employee search/detail, deletion, financial adjustments, destination replacement, settings and aggregates (P13); frontend integration; deployment/release. No registration OTP, Google sign-in, KYC, device/single-account ban, admin 2FA, dual approval or second auth system.
- **Prerequisites**: The populated [constitution](../../.specify/memory/constitution.md), roadmap, all eight [engineering guides](../../docs/engineering/README.md), and existing authentication/contracts are available. Owner-selected P01 CONVERGE on 2026-10-03 returned zero findings after checking 74 requirements/acceptance criteria, 40 tasks, eight design areas and seven constitution principles; P01 tasks remained byte-for-byte unchanged. It reused [P01 recorded execution evidence](../001-financial-backend-foundation/tasks.md), including the 67-test migrated-database remediation run, and ran no tests. The P01 predecessor gate is closed; P02 requirements review and implementation acceptance remain separate gates.
- **Frontend boundary**: Backend only. Pages, routes, layouts, navigation, popups, copy and styling stay frozen. P03 owns real auth/account integration and protected layouts after P01-P02 pass. Email links must target approved existing verification/recovery surfaces where applicable; this does not authorize new UI.
- **Owner decisions**: The mandatory dedicated admin login screen is absent at `/admin/auth/login`, while the constitution freezes new screens/routes. An explicit owner decision is required before P03 creates that surface. Preserve the admin sign-in backend requirement. P03 must also verify that administrator invitation/password-setting and recovery can use approved surfaces; any missing required surface needs an owner decision. These downstream conflicts do not block backend specification or grant UI approval.
- **P03 recovery evidence**: The existing [employee reset screen](../../apps/web/src/features/employee/components/auth/reset-password-screen.tsx) states a maximum two-hour link lifetime and describes successful recovery as access to an employee account, while the retained [backend configuration](../../apps/api/src/core/config/auth.config.ts) defaults reset links to 30 minutes. P03 requires an owner decision to reconcile frozen copy with the configured lifetime and any administrator recovery/invitation reuse that needs changed frozen presentation or a missing surface. This clarification records the conflict; it changes neither P02's retained lifetime policy nor the approved UI.
- **Acceptance gate**: All identity/admin behavior and validated, authorized account/session contracts needed by P03 must meet the scenarios/outcomes below. P02 implementation must add/extend actual automated tests, preserve affected auth/contract/configuration/migration regressions, and demonstrate persisted atomicity and lifecycle concurrency with real migrated PostgreSQL. Email failure/uncertainty must be exercised at the email boundary without live credentials. Missing required infrastructure, predecessor evidence or acceptance results leaves its gate incomplete. Withdrawal cancellation integration remains P10-P11. This spec/checklist is requirements evidence only.

The [operating contract](../../docs/workflow/speckit-prompts.txt) and constitution govern this phase. No implementation, other workflow stage or release action follows automatically.

### Actors and Current Capability

Employees register, activate email, manage their own account basics and use multiple device sessions. Administrators authenticate with their own credentials and manage permitted restrictions and administrator membership. A protected setup operator provisions the first administrator. Invited administrators prove control of the invited email and choose their own password. Maintainers need attributable lifecycle changes and truthful provider/configuration failures.

Current source inspected for this specification:

| Evidence                                                                                                                                                                                                    | Existing capability and P02 gap                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Auth service](../../apps/api/src/modules/auth/auth.service.ts) and [routes](../../apps/api/src/modules/auth/auth.routes.ts)                                                                                | Registration, single-use activation/reset, multi-device refresh rotation, password change and current/all-device logout exist. Registration creates only an account and attempts pending-account cleanup on email failure; sponsor/wallet provisioning is missing. Refresh deletion does not revoke already-issued access credentials. |
| [Authentication](../../apps/api/src/middlewares/auth.middleware.ts) and [authorization](../../apps/api/src/middlewares/authorization.middleware.ts)                                                         | Protected requests load current active/verified status and role. Session revocation and independent task/withdrawal restrictions are missing.                                                                                                                                                                                          |
| [Users routes](../../apps/api/src/modules/users/users.routes.ts), [profile contracts](../../packages/contracts/src/auth/auth.schema.ts) and [safe mapper](../../apps/api/src/modules/users/users.mapper.ts) | Own-profile reads and allowlisted name/phone changes exist, unsupported fields are rejected and credential hashes are excluded. Sponsor/admin lifecycle contracts are absent.                                                                                                                                                          |
| [Persistence schema](../../packages/database/prisma/schema.prisma)                                                                                                                                          | P01 wallets, ledger, reservations and financial audit now exist alongside accounts/refresh credentials. Wallet ownership is unique and source balances default to zero. Sponsor identity, independent restrictions, invitations and identity/admin audit are missing. The roadmap's auth-only starting-point inventory is historical.  |
| [API router](../../apps/api/src/router.ts) and [local seed policy](../../packages/database/src/seed-config.ts)                                                                                              | Shared auth/users/health are composed; no dedicated admin sign-in/lifecycle boundary exists. The local admin seed rejects production credentials and is not the required production bootstrap.                                                                                                                                         |
| [Auth configuration](../../apps/api/src/core/config/auth.config.ts) and [rate limiter](../../apps/api/src/middlewares/rate-limit.middleware.ts)                                                             | Keys have length checks, but three signing purposes fall back to the access key even in production. Limits are process-local; multi-process enforcement is not established.                                                                                                                                                            |
| [Email service](../../apps/api/src/infrastructure/email/email.service.ts) and [configuration](../../apps/api/src/core/config/email.config.ts)                                                               | Verification/reset delivery and Resend configuration exist. Links currently target generic boilerplate auth paths. Company sender/support readiness remains a launch dependency; provider acknowledgement does not prove mailbox delivery.                                                                                             |
| [Auth integration tests](../../apps/api/src/modules/auth/auth.service.integration.test.ts) and [HTTP tests](../../apps/api/src/app.integration.test.ts)                                                     | Baseline link/refresh replay and password/logout tests exist. This is not fresh execution evidence or acceptance of new revocation/admin/sponsor/configuration behavior.                                                                                                                                                               |
| [Admin layout](../../apps/web/src/app/admin/layout.tsx) and [constants](../../apps/web/src/features/admin/constants/admin.constants.ts)                                                                     | Dashboard/fixture identity exist without real layout access enforcement; the dedicated admin login route is absent. P02 changes neither surface.                                                                                                                                                                                       |

## User Scenarios & Testing _(mandatory)_

Each journey is independently verifiable within its prerequisites. Priorities do not bypass P01. Acceptance requires actual added/extended tests during implementation; none are claimed to have run here.

### User Story 1 - Register and Activate an Employee (Priority: P1)

An employee registers with email/password and an optional referral code, activates through an email link, and receives one empty wallet and fixed sponsor relationship.

**Why this priority**: Later business operations depend on trustworthy identity, wallet ownership and a fixed sponsor tree.

**Independent Test**: Register distinct sponsored/unsponsored employees, inspect saved relationships, activate through captured test emails, and attempt invalid/repeated/concurrent registration and activation.

**Acceptance Scenarios**:

1. **Given** an unused normalized email and no referral code, **When** registration succeeds, **Then** one pending employee account and one owned wallet exist, all available/reserved source amounts are zero, no credit/paid membership is created, and protected access is denied until activation.
2. **Given** a code identifying an existing employee, **When** registration succeeds, **Then** that employee is the saved sponsor, the new employee receives their own stable shareable code, and later profile/activation requests cannot replace the sponsor.
3. **Given** an invalid code, self-ID sponsor, cycle attempt or forged role/balance/sponsor-ID fields, **When** registration is evaluated, **Then** it is rejected without partial account/wallet/sponsor or financial effects.
4. **Given** competing registrations for one normalized email or uses of one activation link, **When** they execute concurrently, **Then** at most one account/wallet pair and one activation transition result; losing requests cannot duplicate records or alter the sponsor.
5. **Given** a pending registration and email rejection, timeout or lost acknowledgement, **When** recovery/resend is requested, **Then** the complete pending account remains recoverable, delivery status grants no active authority, and retries cannot create another account/wallet or erase history.
6. **Given** an activation link, **When** it is used before expiry, **Then** only its intended pending account activates; at/after expiry, after replacement/consumption or with another purpose it cannot grant authority. An old link cannot unsuspend/unban an account.
7. **Given** existing employees with missing wallets and employees with funded wallets/history but unknown sponsors, **When** identity upgrades run repeatedly/concurrently, **Then** each missing wallet is provisioned exactly once at zero, every existing source amount/history entry stays intact, and no sponsor is invented or reassigned.

---

### User Story 2 - Authenticate with Current Authority (Priority: P1)

An employee or administrator signs in with their own credentials. Admin entry accepts only a currently active, verified administrator; all protected access uses current server authority.

**Why this priority**: Login presentation and old credential claims cannot grant administrative permission.

**Independent Test**: Exercise shared/admin sign-in with valid, invalid, employee, unverified, suspended and deactivated identities, then request account/admin data with changed role/status and forged input.

**Acceptance Scenarios**:

1. **Given** a verified active administrator, **When** correct email/password are submitted at admin entry, **Then** shared session behavior issues administrator access and returns safe authenticated identity.
2. **Given** a nonexistent email, wrong password, employee credentials or unverified/suspended/deactivated admin, **When** admin sign-in occurs, **Then** no session is issued and generic credential denial does not reveal which admin eligibility check failed.
3. **Given** anonymous/employee callers, **When** admin data/actions are requested directly, **Then** access is denied regardless of navigation, submitted role, target ID or fixture identity.
4. **Given** previously issued credentials, **When** role/status changes before a protected request or consequential write, **Then** current authority determines the outcome and stale privilege cannot authorize it.
5. **Given** credential attempts reaching the configured limit, **When** another attempt occurs, **Then** the affected sign-in/recovery/invitation operation is rate-limited without credential disclosure.

---

### User Story 3 - Recover Passwords and Revoke Sessions (Priority: P1)

Employees and administrators recover/change passwords and end one device session or every session, effectively revoking both access and refresh authority.

**Why this priority**: Refresh deletion alone leaves credentials usable after logout or compromise.

**Independent Test**: Use two sessions for one account and a separate account, rotate refresh credentials, log out one/all sessions, reset/change passwords, and retry old credentials through protected/concurrent operations.

**Acceptance Scenarios**:

1. **Given** two independent sessions, **When** current-session logout completes, **Then** that session's existing access/refresh credentials fail on subsequent protected requests while the other session and other accounts remain valid.
2. **Given** multiple sessions, **When** logout-all, valid reset or confirmed password change completes, **Then** all earlier account sessions are revoked, an updated password rejects the old password, and unrelated accounts remain unaffected.
3. **Given** an eligible account, **When** recovery is requested, **Then** a bounded email link is issued without publicly revealing eligibility; nonexistent/ineligible accounts receive the same neutral response.
4. **Given** one reset link or refresh credential, **When** competing requests consume it, **Then** only one permitted transition succeeds; replay, replacement, wrong-purpose and expired credentials cannot cause another session/password change.
5. **Given** refresh racing with revocation/deactivation, **When** both finish, **Then** no credential derived from revoked authority grants later access. Rotation never extends the original session's absolute expiry.
6. **Given** a suspended/deactivated account restored by an authorized administrator, **When** revoked credentials are retried, **Then** they remain invalid and a fresh eligible sign-in is required.

---

### User Story 4 - Protect Profiles and Independent Restrictions (Priority: P1)

Employees manage only their own permitted account basics. Administrators apply separate full-account, task-only and withdrawal-only controls with confirmation/reason.

**Why this priority**: Restrictions must deny the intended activity while preserving privacy, funds and history.

**Independent Test**: Read/update profiles with another identity, forge privileged fields, and apply each restriction separately/in combination through an active administrator.

**Acceptance Scenarios**:

1. **Given** an active verified employee, **When** they read/update their own name/phone, **Then** only supported fields change and safe output excludes credentials and others' private data.
2. **Given** another user's ID or role/status/sponsor/wallet/entitlement/restriction input, **When** an own-profile request occurs, **Then** cross-user and unsupported changes are denied without saved effects.
3. **Given** an authorized admin and a confirmed action with nonblank reason, **When** a task-only/withdrawal-only block is applied, **Then** each restriction is independently saved and visible in authorized current-account data, without itself blocking login/profile access.
4. **Given** full suspension/ban, **When** sign-in, refresh or protected session access occurs, **Then** authority is denied and wallet amounts, sponsor and history remain intact.
5. **Given** conflicting target state or an actor losing authority, **When** restriction/lifecycle actions compete, **Then** only an allowed current-state result commits with its audit, without lost independent restrictions or stale-actor writes.
6. **Given** no task/withdrawal workflow in P02, **When** a restriction is saved, **Then** its authoritative state is available to later services; P02 claims no cancellation, refund, reward or commission execution.

---

### User Story 5 - Provision and Manage Administrators (Priority: P2)

A protected operator provisions the first administrator. Active administrators invite colleagues and list/read/activate/deactivate membership without locking out administration.

**Why this priority**: Administrative access must be explicitly granted without public role escalation or accidental loss of control.

**Independent Test**: Attempt protected bootstrap repeatedly/concurrently, invite/accept using captured test emails, query as each actor type, and race remaining-admin deactivations.

**Acceptance Scenarios**:

1. **Given** no first administrator provisioned, **When** authorized protected bootstrap completes, **Then** exactly one first administrator is provisioned and can authenticate only after required password/email eligibility is satisfied. Public registration and local-only seed credentials cannot bootstrap production.
2. **Given** completed or competing bootstrap, **When** another attempt occurs, **Then** it cannot add administrators or overwrite the first; subsequent administrators require authenticated invitations.
3. **Given** an active administrator, **When** a confirmed, reasoned invitation targets an unused email, **Then** the addressed recipient gets a bounded single-use link, proves that email through acceptance, chooses their own password and receives the same ADMIN role.
4. **Given** an invitation, **When** it is replayed/concurrently accepted, expired, revoked, replaced, invalidated by its issuer's deactivation or used for another email/action, **Then** no duplicate administrator, password overwrite or unintended privilege results. An employee account cannot be silently promoted, and restoring the issuer does not revive invalidated invitations.
5. **Given** failed/uncertain delivery, **When** the inviter inspects/reissues the invitation, **Then** sending remains distinct from acceptance, no administrator activates from an attempted send, and replacement cannot leave multiple usable invitations for that email.
6. **Given** an authorized active admin, **When** list/read or permitted lifecycle actions occur, **Then** only safe bounded admin identity/status is returned, deactivation revokes the target's sessions, and historical actions remain.
7. **Given** self-deactivation or the last active administrator, **When** deactivation or competing deactivations occur, **Then** self-deactivation is rejected and at least one active administrator remains, with no partial losing lifecycle/audit effects.
8. **Given** invitation acceptance racing with issuer deactivation, **When** they reach their authority-changing boundary, **Then** acceptance is allowed only while the issuer is still active, verified ADMIN; if deactivation wins, outstanding invitation authority is revoked and acceptance fails without a new administrator. Later issuer restoration cannot revive the invitation. An acceptance already committed before deactivation remains a completed administrator provisioning event.
9. **Given** invitation issue/reissue/revocation/acceptance, bootstrap or a restriction/admin lifecycle change, **When** a material change commits, **Then** its durable audit identifies the action/target/time/outcome and required reason from authenticated, protected-operator or validated-invitation context; submitted actor identity and reusable invitation credentials cannot become audit data.

---

### User Story 6 - Operate Without Credential Exposure (Priority: P2)

Maintainers accept traffic only with valid production credentials/configuration and diagnose identity/provider failures without exposing secrets.

**Why this priority**: Example credentials, shared signing keys and secret-bearing failures undermine identity controls.

**Independent Test**: Validate missing/example/reused/short production keys and a valid explicit set, inspect outputs/diagnostics with secret sentinels, and exercise unavailable email and affected auth protections.

**Acceptance Scenarios**:

1. **Given** a missing access/refresh/verification/reset signing key, known example/default placeholder, value below the existing minimum or reuse between purposes, **When** production startup is attempted, **Then** it fails before traffic without printing values.
2. **Given** strong distinct explicitly supplied keys and valid required configuration, **When** startup validation occurs, **Then** valid configuration is accepted and development/test defaults cannot satisfy production requirements.
3. **Given** forged/expired/wrong-purpose credentials or authenticated writes missing required request-forgery protection, **When** requested, **Then** existing authentication, validation and cookie/request-forgery protections deny them without state changes.
4. **Given** secret/private provider data in failure inputs, **When** auth/invitation/email/configuration failures are observed, **Then** unrelated/public output, ordinary logs, checked-in templates and diagnostics contain no secret value or raw private payload. Intended session credentials and recipient-bound action links may be delivered only through their authorized channels.
5. **Given** one authorized admin performs a material identity action, **When** it commits, **Then** audit has the server-derived actor/target/action/time and required reason; no second-admin or 2FA step is imposed and no security guarantee is claimed.

### Edge Cases

- Email case/outer-space variants represent one identity; entered passwords are not trimmed/transformed.
- Omitted referral code means no sponsor; supplied invalid codes fail. Distinct accounts of one person may refer each other only where the relationship remains noncyclic; self-ID sponsorship is forbidden.
- Sponsor omission/assignment remains fixed. Existing accounts with unknown sponsor history receive no invented sponsor, and identity upgrades never reset balances/history.
- Email or client acknowledgement is lost after provisioning/activation/reset/invite acceptance. Recovery reconciles saved state rather than assuming no effect or duplicating authority.
- Expiry is an exclusive server-instant boundary, independent of browser/host timezone. Identity links remain usable on weekends without task hours/withdrawal delay rules.
- Replacement/concurrent link uses cannot retain two valid credentials or unsuspend an account. Read-only validation and email prefetch cannot consume credentials or mutate authority.
- Refresh/password/logout/deactivation races cannot escape revocation; later activation never revives revoked sessions.
- Partial restrictions preserve unrelated permitted access; full-account denial revokes authority. A stale actor or fixture identity cannot authorize writes.
- Employee/admin email collisions, duplicate invitations, self-lockout and last-admin races cannot silently overwrite passwords/roles or partially commit audit/state.
- Later withdrawal integration must distinguish unsent from possibly sent payouts. No P02 restriction action guesses a refund, redirects payment or destroys source accounting.
- Process-local rate limiting does not establish multi-process enforcement; actual production topology must satisfy the required limit before deployment acceptance.

## Requirements _(mandatory)_

### Functional Requirements

#### Registration, Sponsor and Wallet Ownership

- **FR-001**: Public registration MUST create only an employee identity using email/password and optional referral code, with email-link activation. No registration OTP, Google sign-in or client-selected admin role.
- **FR-002**: Registration MUST use one normalized unique email identity and the shared bounded password policy without changing password characters. Preserve its existing password-only body plus optional referralCode; passwordConfirmation is required only for reset, change and invitation acceptance. Duplicate/concurrent requests MUST create at most one account for that email.
- **FR-003**: Successful employee provisioning MUST save exactly one owned zero-balance wallet together with its account/sponsor decision. All available/reserved referral/non-referral amounts MUST start at zero; dependent failure MUST leave no partial registration/orphan wallet/posting. Registration grants neither money nor paid entitlement.
- **FR-004**: Every registered employee MUST have a stable unique shareable referral code. Supplied codes MUST resolve to existing employees; invalid codes, self-ID links and cycles MUST fail. The selected sponsor, including no sponsor, MUST be immutable after registration.
- **FR-005**: Multiple accounts belonging to one person and multiple device sessions MUST be permitted. KYC, device/single-account bans and a hidden ban on referrals between distinct accounts of that person MUST NOT be introduced.
- **FR-006**: Activation MUST consume only the current intended user/action/email-bound unexpired credential and perform at most one pending-to-active transition. That status transition advances the control version once, invalidating earlier confirmed control intent. Replay, replacement, expiry or another purpose MUST cause no authority change; activation MUST NOT override suspension/ban.
- **FR-007**: Existing identity/financial history MUST survive upgrades. Missing employee wallets MUST be provisioned once without resetting existing amounts; unknown historical sponsors MUST remain unknown/unassigned rather than invented.

#### Authentication, Recovery and Sessions

- **FR-008**: Employee/admin authentication MUST reuse shared email/password, recovery and session services. Admin entry MUST issue sessions only for currently active, verified ADMIN accounts, with generic denial for invalid credential/eligibility cases.
- **FR-009**: Every protected P02 read/write MUST enforce current server identity, active/verified status, role, session authority and applicable ownership/restrictions. Consequential writes MUST recheck changing actor/target authority at commit; old claims or frontend navigation MUST NOT grant permission.
- **FR-010**: Suspended/banned employees and deactivated admins MUST be unable to sign in, refresh or use existing protected sessions. Full denial atomically invalidates outstanding verification/reset credentials as well as revoking sessions. Restoration MUST NOT revive old sessions or action links; new eligible resend/recovery is required.
- **FR-011**: Recovery MUST use bounded single-use email links and neutral public responses for nonexistent/ineligible accounts. Issuance, read-only validation and consumption require a current ACTIVE, email-verified employee or ADMIN; pending, unverified, suspended, banned and deactivated identities are ineligible. Partial task/withdrawal blocks do not affect recovery eligibility. Reset MUST NOT activate, unsuspend or elevate accounts. Password change MUST require the current password and shared new-password policy, atomically invalidate outstanding reset credentials and revoke sessions. Recovery issued before a competing password change is invalidated; issuance after committed change may create a fresh eligible link.
- **FR-012**: Reset/change/logout-all MUST revoke all earlier account access/refresh authority before success. Current-session logout MUST revoke that session while preserving other independent sessions. Subsequent protected requests MUST fail without waiting for access expiry.
- **FR-013**: Refresh MUST be single-use, rotate safely under concurrency and retain the original absolute expiry. Refresh racing with revocation MUST NOT create surviving authority; unrelated accounts MUST remain unaffected.
- **FR-014**: Activation/reset/invitation validity MUST use server instants, valid strictly before expiry and invalid at/after it. Host/browser timezone changes MUST NOT alter eligibility; weekends MUST NOT impose task windows or withdrawal delays.
- **FR-015**: Read-only credential validation MUST NOT consume credentials or change identity. Activation/reset/invite acceptance/lifecycle mutations MUST require an explicit state-changing request; opening/previewing an email link MUST NOT perform them.

#### Account Basics and Restrictions

- **FR-016**: Employees MUST read only their own safe account and update only supported name/phone fields. Profile input MUST NOT modify another account, email identity, role, status, sponsor, restrictions, wallet or entitlement.
- **FR-017**: Account/session/admin projections MUST allowlist authorized identity/status/restriction fields needed by P03 and exclude credential hashes, reusable secrets, raw private provider payloads and other users' data. Valid IDs MUST NOT grant access to admin projections.
- **FR-018**: Current active admins MUST apply/remove independent full-account, task-only and withdrawal-only controls on employee accounts with explicit confirmation and a nonblank reason. Partial restrictions MUST NOT themselves block login/profile access or alter the other restriction. ADMIN access changes MUST use the protected administrator lifecycle and obey FR-027.
- **FR-019**: Restriction/lifecycle changes MUST preserve wallet sources/reservations, sponsor and history. P02 MUST expose current restrictions for later services without claiming task/referral/withdrawal cancellation/refund/payout workflows; their financial gates remain P04/P06/P10-P11.
- **FR-020**: Concurrent/stale restriction/lifecycle actions MUST produce an allowed consistent current-state result or safe conflict/denial. They MUST NOT overwrite independent restrictions, authorize stale actors or partially commit target/audit changes.

#### Administrator Provisioning and Lifecycle

- **FR-021**: First-admin bootstrap MUST be protected application setup available only to an authorized operator before the first admin is provisioned. Require an explicitly authorized nonprivileged OS runner matching trusted execution identity; unavailable, mismatched or elevated identity fails closed before provisioning, under the [operations policy](contracts/operations.md#protected-first-administrator). Repeated/concurrent bootstrap MUST provision at most one first admin without overwriting credentials. Historical ADMIN presence permanently closes bootstrap. Before populated cutover, require an ACTIVE verified historical ADMIN or a pending ADMIN recoverable through ordinary email proof/resend; otherwise halt without changing identity/credentials/history and require a separately authorized recovery decision. Public registration/local-only seed settings MUST NOT bootstrap production.
- **FR-022**: Additional admins MUST receive invitations from a current active admin to a specific unused email and set their own password. Acceptance MUST prove the invited email and grant only ADMIN; clients MUST NOT choose another role/email/account.
- **FR-023**: Invitations MUST be bounded, intended email/action-scoped and single-use. Expired/revoked/replaced/malformed/wrong-purpose/replayed credentials MUST NOT grant authority. Reissue MUST invalidate earlier outstanding authority for that email; concurrent acceptance MUST create at most one administrator. Acceptance MUST recheck that the issuer remains active, verified ADMIN. Deactivation MUST invalidate outstanding invitations atomically with the issuer's authority change, including under concurrent acceptance; restoration MUST NOT revive them. An acceptance committed before deactivation remains completed.
- **FR-024**: Existing employee/admin email collisions MUST return safe conflict without employee promotion, password overwrite or duplicate admins. Existing inactive admins MUST use authorized activation rather than invitation reassignment.
- **FR-025**: Active admins MUST have authorized bounded list/read access to safe admin identity/status, with bounded pagination and deterministic ordering. Anonymous/employee/deactivated callers MUST be denied; credentials/invitation tokens MUST be absent.
- **FR-026**: Admin activation/deactivation MUST require current ADMIN authority, explicit confirmation and nonblank reason, committing lifecycle/audit/required revocation together. Targets must be verified ACTIVE or DEACTIVATED admins. Deactivation MUST invalidate target sessions/action links immediately; activation MUST require verified identity and preserve history. Denial of already-provisioned pending ADMIN membership/verification is intentionally excluded from P02; pending identity activates only through ordinary email proof. Outstanding unaccepted invitations remain revocable.
- **FR-027**: Self-deactivation and equivalent self-suspension/ban MUST be rejected. At least one active, verified administrator eligible to authenticate MUST remain after all concurrent admin access-denial transitions, without partial losing authority/audit effects. Alternate restriction actions, public actions and recovery MUST NOT bypass these protections.
- **FR-028**: All admins MUST share ADMIN authority; any one current authorized admin MAY perform a permitted action. No admin 2FA/dual approval. Compromised-admin/host risks MUST remain explicit for independent launch review.

#### Email, Production Configuration and Evidence

- **FR-029**: Verification/recovery/invitation email MUST use approved Resend delivery and configured company identity. Missing required production provider configuration MUST fail closed; no production console credential previews. Domain/sender/support readiness MUST remain a launch dependency without invented addresses.
- **FR-030**: Email rejection/timeout/uncertain acknowledgement MUST NOT imply activation, acceptance or mailbox delivery. Complete pending registrations/invitations MUST remain recoverable through bounded resend/reissue without duplicate identity/wallet/sponsor/authority or history loss. Public recovery stays neutral in status, content and headers under equivalent limiter histories; provider-dependent timing equalization is outside P02. Privileged delivery status stays independent of current invitation disposition; accepted/revoked disposition takes precedence over later expiry. Delayed dispatch/result handling follows the [operations contract](contracts/operations.md#resend-boundary-and-failure-semantics).
- **FR-031**: Email links MUST target approved verification/recovery surfaces for the intended identity/action. Missing admin login or invite/password-setting presentation MUST remain a P03 owner decision where required; backend work MUST NOT create screens/routes or conceal the gap by bypassing authority.
- **FR-032**: Existing password hashing, bounded validation, credential purpose/issuer/audience/expiry checks, secure refresh cookies, request-forgery protection and redaction MUST be preserved/tested when affected. Unsupported authority fields MUST be rejected rather than copied into saved state.
- **FR-033**: Admin sign-in and affected registration/recovery/refresh/invitation operations MUST have bounded rate limits effective across the actual production API topology. Process-local evidence MUST NOT be claimed as shared enforcement; needed infrastructure is a planning decision based on actual topology.
- **FR-034**: Production MUST explicitly supply strong distinct keys for access, refresh, verification and reset signing. Reject missing values, values below the existing 32-character minimum, known repository example/default placeholders and equal purpose keys. No cross-purpose or development/test fallback; valid explicit independent credentials MUST be accepted.
- **FR-035**: Signing/provider secrets, password hashes and private payloads MUST be absent from checked-in source/examples/templates, public/unrelated output, ordinary logs and diagnostic/test reports. The shared protocol MAY deliver session credentials to their intended session and action links to their intended email recipient; they MUST NOT leak into account projections, unrelated responses, logs or retained public/shared caches. Configuration errors MAY name a setting/purpose without its value.
- **FR-036**: Material admin identity mutations, including bootstrap, invitation issue/reissue/revocation/acceptance, employee restrictions and admin lifecycle, MUST have durable server-derived actor/target/action/time/outcome and required reason. Actor identity MUST come from authenticated, protected-operator or validated email-action context rather than submitted actor fields. Required audit MUST commit with saved state, exclude credentials/reusable invitation links/private payloads and preserve financial audit/history. Recipient acceptance records inviter and validated recipient identity with no admin reason; pending ADMIN email activation records validated recipient proof with no admin reason. Employee public activation adds no admin audit. The [data model audit matrix](data-model.md#append-only-identityadmin-audit) defines allowed actions/actors/snapshots.
- **FR-037**: P02 MUST provide shared validated request/response contracts and safe observable success/denial/conflict/expiry/rate-limit/unavailable-provider outcomes for P03, preserving the established authentication/response protocol. Preserve existing shared account/session contracts for frozen callers; additive P02 contracts MUST require every new account field and govern enriched backend responses. No new field becomes optional and no web edit is required, as detailed in the [HTTP compatibility decision](contracts/http-api.md#request-and-projection-rules). Failed lookups/providers MUST NOT become fixture/default/empty successful identities.
- **FR-038**: Implementation MUST add/extend actual automated tests for these journeys, including real migrated-database provisioning/token/admin atomicity and concurrency, authorization/ownership/mass assignment, revocation, failed/uncertain email and invalid/valid production keys. Missing predecessor/execution evidence MUST remain an open gate.

### Key Entities _(include if feature involves data)_

- **Account**: Stable identity, normalized email, password credential, employee/ADMIN role, verification/account status, supported profile fields and lifecycle times; changes preserve owned history.
- **Referral identity and sponsor relationship**: Stable employee code and optional registration-time sponsor, immutable without self-ID/cyclic links. No commission/paid entitlement is created here.
- **Wallet ownership**: One employee wallet retaining P01 referral/non-referral and available/reserved sources; starts at zero and is never reset by identity changes.
- **Session authority**: Independent device/session access, rotating refresh authority, original expiry and revocation state, subject to account-wide revocation.
- **Action credential**: Intended identity/email/action, issuance/expiry and consumption/replacement status for activation/reset/invitation; no general role assignment authority.
- **Account restrictions**: Full-account status plus independent task/withdrawal blocks and authorized change metadata; later workflow execution remains out of scope.
- **Administrator provisioning**: Protected bootstrap completion and invitation intent, invited email/issuer, validity/acceptance/revocation state; sending differs from acceptance.
- **Identity/admin audit**: Durable attributable actor/target/action/time/outcome/reason committed with the material change, without credential material.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Each accepted registration produces exactly one account/wallet and fixed sponsor decision, with zero source balances. Invalid/duplicate/concurrent/failed attempts produce zero duplicate/partial records or money/entitlement credits. (US1; FR-001-FR-007)
- **SC-002**: Every listed admin-entry/direct-access denial grants zero unauthorized sessions, private records or mutations. Valid active verified admin credentials succeed through shared identity services. (US2; FR-008-FR-010, FR-017, FR-025, FR-037)
- **SC-003**: The first protected request after committed logout/revocation/reset/change/deactivation rejects all affected earlier access/refresh credentials, preserving unrelated sessions/accounts. Concurrent refresh cannot escape revocation and restoration revives zero old sessions. (US3; FR-010-FR-015, FR-026)
- **SC-004**: Each activation/reset/invite credential causes at most one transition across replay/concurrency and zero transitions at/after expiry, after replacement/revocation or under another purpose. Every failed/uncertain email scenario preserves recoverable complete pending state without delivery-based authority. (US1, US3, US5; FR-006, FR-011, FR-013-FR-015, FR-023, FR-030)
- **SC-005**: Ownership/mass-assignment cases leave unauthorized fields/other accounts unchanged. Partial controls change only the intended restriction; full-account denial blocks login/sessions. All lifecycle cases preserve wallet source values, sponsor and history. (US4; FR-016-FR-020, FR-032)
- **SC-006**: Bootstrap competition provisions exactly one first admin; invite collisions/replays yield zero unintended admins/password overwrites. Self/last-admin/concurrent deactivations retain at least one active admin and zero partial losing changes. Every committed material admin identity mutation has its required audit. (US5; FR-021-FR-028, FR-036)
- **SC-007**: All enumerated missing/short/example/reused/fallback production-key cases stop startup before traffic; valid explicit distinct keys are accepted. Sentinel signing/provider secrets appear zero times in inspected output, ordinary logs, checked-in templates and verification diagnostics; session/action credentials appear only in their authorized delivery channels. (US6; FR-029, FR-032-FR-035)
- **SC-008**: Every P03 consumer journey has defined authorized success/failure outcomes, with affected actual automated checks passing at P02 implementation completion. P02 changes zero frontend artifacts; unresolved predecessor/UI/later financial gates remain visible and are not called passed. (FR-019, FR-031, FR-037-FR-038)

## Assumptions

- Employee authority maps to the existing ordinary user role; administrator authority remains ADMIN. Full suspension/ban denies account access, while task/withdrawal blocks remain independent. Specific persistence/transport representations belong to planning.
- Profile scope stays name/phone only. Email changes, sponsor reassignment, financial edits and employee deletion are not added P02 self-service capabilities.
- Retain existing verification/reset duration and resend cooldown. New invitations default to the existing verification-link duration (currently 24 hours); all expiries are exclusive server instants. Later approved duration changes cannot revive consumed/revoked links.
- Each device login has independent authority. Single logout affects only that session; logout-all and reset/change revoke all earlier sessions, including the caller, requiring fresh eligible sign-in.
- Invitations target unused emails without promoting employees; inactive admins use protected activation. Deactivating an issuer invalidates their outstanding invitations without revival on restoration. Self-deactivation/equivalent denial is rejected even when another active admin exists, and concurrent actions preserve the last active verified admin eligible to authenticate.
- Failed/unknown sends retain a complete pending registration/invitation for bounded resend/reissue. This is required P02 behavior, not a description of today's cleanup/detached sends, and does not imply a universal notification/outbox framework.
- Acceptance uses isolated migrated PostgreSQL and email-boundary doubles. Live Resend domain/company sender/support and actual deployment topology are external launch dependencies, unverified by this invocation.
- P01 final convergence passed the owner-selected read-only review on 2026-10-03; its passing tests are recorded/reused evidence, not fresh results here. P02 requirements review and actual implementation acceptance remain pending. Missing admin login and any missing invitation/password-setting surface require an owner decision before affected P03 integration; no P02 UI is authorized.
