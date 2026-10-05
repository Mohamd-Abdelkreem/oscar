# Feature Specification: P03 - Authentication and Account Frontend

**Feature Branch**: `002-identity-admin-backend` (existing branch; no branch-creation hook is configured)

**Created**: 2026-10-03

**Status**: Clarified - predecessor backend acceptance recorded; P03 implementation and acceptance pending

**Input**: User description: "PHASE_ID = P03 - Authentication and Account Frontend. Read docs/workflow/speckit-prompts.txt. Apply OPERATING CONTRACT and execute SPECIFY only."

**Amendment 2026-10-03**: The subsequent owner instruction “ignore converge for p02 we will not make converge in following phases” removes the separate CONVERGE stage for P02 onward. This targeted specification correction records the effective predecessor evidence and U1's unavailable recovery boundary; it preserves C1-C3, backend acceptance, implementation review, tests and release gates.

**Roadmap Phase**: P03 - Authentication and Account Frontend

**Feature Directory**: `specs/003-auth-account-frontend`

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: Integrate the five existing employee authentication routes, employee account identity/password/logout, employee and administrator access boundaries, authenticated administrator identity, and administrator list/invitation/lifecycle controls. Preserve the dedicated administrator email/password sign-in requirement and shared recovery access. Establish the real browser verification harness required by P03. Scope comes from [PLAN.md](../../PLAN.md), Sections 3.1, 3.8, 5.6, 7/P03, 8 and 9.
- **Exclusions**: Rebuilding P01 money/calendar/ledger or P02 identity/admin services; first-admin bootstrap implementation; financial account widgets, subscriptions, referrals, tasks, deposits, withdrawals, destination management, cross-domain employee administration, policy/support content and dashboard aggregates owned by later phases. Do not remove the global fixture providers before their later-phase consumers migrate. No new authentication system, public admin signup, client-selected role, registration OTP, Google sign-in, KYC, single-person account ban, admin 2FA or dual approval. No deployment, live email sending, production credentials, real funds, commits or pushes are authorized.
- **Prerequisites**: The populated [constitution](../../.specify/memory/constitution.md) is version 1.0.0. The [P02 task evidence](../002-identity-admin-backend/tasks.md) records P01 closure and T001-T067 complete; its [final handoff](../002-identity-admin-backend/quickstart.md) records 628 passing backend acceptance/regression tests with real isolated persistence and injected email. These are reused predecessor results, not fresh checks here. P02's historical statement that CONVERGE has not run does not impose that removed stage: the subsequent owner instruction omits separate CONVERGE for P02 onward. Required backend acceptance and any actual unresolved blocker still gate integration; no convergence execution or fresh backend pass is claimed.
- **Frontend boundary**: Only minimal functional integration of approved existing surfaces is authorized. Preserve existing URLs, route placement, layouts, navigation, popups, static copy, Cairo, Arabic/RTL, light styling, spacing, icons, sizes and breakpoints. Runtime identity and command state may replace fixtures. C1 authorizes the bounded admin entry/invitation/logout and public-layout exception; C2 authorizes the bounded authentication copy/control adaptations; C3 authorizes the bounded management and unavailable-data treatment recorded below. All unrelated frontend surfaces remain frozen.
- **Owner decisions**: C1-C3 below record material presentation decisions. C1-C3 are resolved by four owner answers recorded in Clarifications. Underlying authentication, invitation, confirmation, reason and truthful-data requirements remain mandatory.
- **Acceptance gate**: Recorded predecessor backend acceptance and resolved C1-C3 must support integration; all in-scope acceptance scenarios and measurable outcomes, actual changed automated test files, implementation reviews, relevant shared regressions and real browser evidence must pass. Missing infrastructure, an actual unresolved blocker or an unapproved surface leaves the affected gate incomplete. Requirements checklist review is not implementation or test completion. No separate CONVERGE is required for P03.

Apply the constitution and [operating contract](../../docs/workflow/speckit-prompts.txt). All eight [engineering guides](../../docs/engineering/README.md) were consulted. Their older starting-point descriptions do not override current P01-P02 implementation or the frontend freeze.

### Actors and Current Capability

Actors are an anonymous visitor, a pending employee proving their email, an active employee, an active verified administrator, and an addressed administrator-invitation recipient. Suspended/banned employees and deactivated administrators cannot use a protected session. Task-only and withdrawal-only restrictions do not themselves prohibit otherwise valid sign-in.

Source inspection on 2026-10-03 establishes the following current state; it does not establish P03 completion:

| Evidence owner                                                                                                                                                                                                                                                                                                                                                                                                                 | Current capability and remaining gap                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [P02 auth routes](../../apps/api/src/modules/auth/auth.routes.ts), [admin routes](../../apps/api/src/modules/admins/admins.routes.ts) and [identity contracts](../../packages/contracts/src/identity/identity.schema.ts)                                                                                                                                                                                                       | Employee/admin password sign-in, link validation/consumption, current session authority, safe account data and invitation/lifecycle operations exist. P03 consumes them rather than rebuilding them.                                                                                                                                                        |
| [Employee login](../../apps/web/src/features/employee/components/auth/login-screen.tsx) and [registration](../../apps/web/src/features/employee/components/auth/register-screen.tsx)                                                                                                                                                                                                                                           | Forms use timers/navigation rather than persisted authentication. Login has demo credentials and incorrectly applies the new-password minimum to existing-password entry. Referral input has an example code incompatible with the current format.                                                                                                          |
| [Verification](../../apps/web/src/features/employee/components/auth/verify-email-screen.tsx), [forgot password](../../apps/web/src/features/employee/components/auth/forgot-password-screen.tsx) and [reset password](../../apps/web/src/features/employee/components/auth/reset-password-screen.tsx)                                                                                                                          | Presentation states exist, but timers, a demo activation action and caller-supplied state select apparent outcomes. Recovery copy states two hours; the [backend default](../../apps/api/src/core/config/auth.config.ts) is 30 minutes.                                                                                                                     |
| [Employee account](../../apps/web/src/features/employee/components/account/account-screen.tsx) and [password dialog](../../apps/web/src/features/employee/components/account/change-password-modal.tsx)                                                                                                                                                                                                                        | Identity and financial/address regions use fixtures; logout only navigates; password change simulates success. Identity is read-only, with no profile editor. Copy describes local/preview password changes.                                                                                                                                                |
| [Employee app layout](<../../apps/web/src/app/employee/(app)/layout.tsx>) and [admin layout](../../apps/web/src/app/admin/layout.tsx)                                                                                                                                                                                                                                                                                          | Approved shells lack OSCAR session guards. Dedicated administrator login is absent. The dashboard shell currently wraps the entire administrator subtree.                                                                                                                                                                                                   |
| [Shared auth adapters](../../apps/web/src/features/auth/api/auth.api.ts), [hooks](../../apps/web/src/features/auth/hooks/auth.hooks.ts) and [users adapter](../../apps/web/src/features/users/api/users.api.ts)                                                                                                                                                                                                                | Real generic auth/account operations exist. Consumers lack full current-response validation; a reset token is retained in a query identity, and credential mutation inputs need transient ownership. Navigation targets generic boilerplate destinations.                                                                                                   |
| [Admin topbar](../../apps/web/src/features/admin/components/common/admin-topbar.tsx) and [sidebar](../../apps/web/src/features/admin/components/common/admin-sidebar.tsx)                                                                                                                                                                                                                                                      | Display identity is hard-coded; employee-preview links exist. No administrator logout control is present in these surfaces.                                                                                                                                                                                                                                 |
| [Admin list](../../apps/web/src/features/admin/components/settings/admins-list-screen.tsx), [add dialog](../../apps/web/src/features/admin/components/settings/add-admin-dialog.tsx), [edit dialog](../../apps/web/src/features/admin/components/settings/edit-admin-dialog.tsx), [admin contracts](../../packages/contracts/src/admin/admin.schema.ts) and [admin reads](../../apps/api/src/modules/admins/admins.service.ts) | UI creates/edits/toggles fixture accounts and displays activity, local search/filter and counts. P02 provides bounded lists and reasoned/confirmed/versioned invitation/status commands, but no admin email-edit, activity projection, list search/filter or status aggregates. The screen has no paging, invitation disposition controls or reason fields. |
| [Email destinations](../../apps/api/src/infrastructure/email/email.service.ts) and [web manifest](../../apps/web/package.json)                                                                                                                                                                                                                                                                                                 | Verification/recovery mail targets generic `/auth/*` surfaces. Configured Playwright/browser `test:e2e` work is absent; historical screenshots are not that gate.                                                                                                                                                                                           |

### Owner Decision Gates

- **C1 - Administrator entry and lifecycle surfaces (resolved 2026-10-03)**: The owner authorizes only the new `/admin/auth/login` and `/admin/auth/accept-invitation` routes using existing visual components, a usable admin logout control, and the public/protected layout separation needed to avoid dashboard authority and redirect loops. Preserve all existing URLs and dashboard appearance. Reuse existing `/auth/verify-email`, `/auth/forgot-password`, and `/auth/reset-password` for shared role-neutral activation/recovery and employee/admin sign-in destinations. Dedicated admin entry still enforces the admin-only server boundary; invitation acceptance requires explicit matching password entry without automatic sign-in. Generic auth copy/feedback adaptation is governed by C2. No other route, dashboard redesign, public admin signup or security exception is authorized.
- **C2 - Public authentication actions and truthful copy (resolved 2026-10-03)**: The owner authorizes minimal local content/control adaptations in existing authentication surfaces and the account password flow: replace demo activation with explicit verification confirmation; remove simulated reset links and prefilled demo credentials; provide resend email entry when legitimate context is absent; correct referral examples, lifetime/delivery/entitlement claims and local/preview password copy. Shared generic activation/recovery becomes role-neutral with employee/admin sign-in destinations. Permit Arabic pending, validation, error, restricted, rate-limit, uncertainty and retry feedback using existing visual components. Preserve existing URLs, layouts, styles and server credential lifetimes; show no numeric lifetime unless it matches authoritative configuration, no guaranteed mailbox delivery or paid entitlement, and never consume credentials on opening/preview/reload. Unrelated copy/presentation stays frozen.
- **C3 - Management and account data mismatches (resolved 2026-10-03)**: The owner authorizes adapting the existing add-admin dialog into invitation issuance, genuine confirmation and entered reasons for issuance/status/reissue/revoke, an invitation section on the existing administrator-management screen with distinct disposition/delivery evidence and read/reissue/revoke controls, and existing pagination for both bounded lists with server-authoritative total counts. Permit necessary Arabic labels/pending/error/conflict/retry feedback while preserving visual style, existing URLs and server protections. Disable unsupported administrator name/email editing and global search/status filters; show activity and status-specific summary counts as unavailable, using only pagination metadata for real total counts. Do not implement current-page filtering/status counts as substitutes. Keep account subscription/balance/withdrawal-address regions in place with Arabic unavailable values and disabled unsupported actions until their domain gates; never substitute zero, Free status, an empty address or fixtures for unknown data. Final administrator capabilities remain for P13/P14 requirements and integration; account domains remain P05/P12/P14. No new management page, unrelated redesign or backend capability is authorized.

## Clarifications

### Session 2026-10-03

- Q: Which exception to the frontend freeze is authorized for missing administrator access surfaces? → A: Permit `/admin/auth/login` and `/admin/auth/accept-invitation` using existing visual components, an admin logout control, and separation of public authentication from the protected dashboard while preserving existing URLs/dashboard appearance. Reuse existing `/auth/verify-email`, `/auth/forgot-password`, and `/auth/reset-password` as shared role-neutral activation/recovery with employee/admin sign-in destinations.
- Q: May authentication surfaces receive the minimal content and controls needed for real behavior? → A: Authorize explicit verification confirmation, removal of simulated reset links/demo credentials, resend email entry without context, truthful referral/lifetime/delivery/entitlement/password copy, and Arabic loading/error/retry feedback with role-neutral shared activation/recovery and both sign-in destinations. Preserve existing layouts/styles and server lifetimes; token opening never consumes it.
- Q: How much of the existing administrator invitation/lifecycle backend should this screen expose? → A: Complete the existing invitation controls: adapt the add-admin dialog into an invitation flow; use entered reasons and genuine confirmation for issue/status/reissue/revoke; add an invitation section with distinct disposition/delivery and read/reissue/revoke; reuse existing pagination for both bounded lists and server-authoritative totals. Permit necessary Arabic labels/error/conflict feedback while preserving visual style, existing URLs and server protections.
- Q: How should unsupported management controls and later-phase account data appear? → A: Disable unsupported administrator name/email editing and global search/status filters; mark activity and status-specific summary counts unavailable while using real pagination totals. Preserve account subscription/balance/withdrawal-address regions with Arabic unavailable values and disabled unsupported actions until domain gates. Final admin capabilities remain P13/P14; account domains remain P05/P12/P14. Do not substitute current-page filtering/counts, fixtures or invented values.

## User Scenarios & Testing _(mandatory)_

Each journey is independently testable after required predecessor backend acceptance using the approved C1-C3 surfaces. Priority does not bypass those gates. Implementation must create or extend actual automated tests; these scenarios are requirements, not executed results.

### User Story 1 - Employee Sign-in and Protected Access (Priority: P1)

An employee signs in with their credentials and enters their account. Anonymous, ineligible and wrong-role visitors cannot see protected content or trigger private reads.

**Why this priority**: Persisted identity and safe access precede every employee integration.

**Independent Test**: Exercise existing login with eligible, unverified, suspended, banned and invalid-credential accounts; directly open protected URLs and reload. Requires recorded P01-P02 backend acceptance and uses C2's approved feedback.

**Acceptance Scenarios**:

1. **Given** an active verified employee, **When** valid credentials are submitted, **Then** current server identity is established and navigation reaches the permitted employee destination; reload restores the same account without demo credentials.
2. **Given** invalid credentials or an unverified/suspended/banned employee, **When** sign-in is attempted, **Then** no protected access is granted and safe feedback supplies permitted recovery/verification without revealing account existence through credential errors.
3. **Given** an anonymous visitor or pending session check, **When** a protected employee URL opens, **Then** protected content and private reads wait for authorization; confirmed anonymity selects appropriate sign-in.
4. **Given** unavailable or malformed session lookup, **When** access is checked, **Then** approved retryable error feedback appears without granting access, claiming successful login or treating outage as proof of anonymity.
5. **Given** a previously allowed session, **When** a subsequent authoritative check denies it after ban/suspension/revocation, **Then** protected content/actions stop and old completions cannot restore access; restoring the account does not revive its revoked session.
6. **Given** an external, credential-bearing or wrong-role return destination, **When** login completes, **Then** that destination is rejected in favor of a safe role-appropriate internal destination.

### User Story 2 - Registration and Email Activation (Priority: P1)

A visitor registers with email/password and optional referral code, then explicitly confirms an email link.

**Why this priority**: Registration must persist a real pending account and fixed sponsor without unproved access.

**Independent Test**: Register, retrieve a test email link and confirm activation; repeat with duplicate email, invalid referral and expired/replayed credentials. Uses the approved C2 controls and feedback.

**Acceptance Scenarios**:

1. **Given** valid fields and absent/valid referral code, **When** registration is accepted, **Then** one pending employee persists with its fixed sponsor decision and the inbox state appears; no session, balance or paid entitlement is invented.
2. **Given** duplicate normalized email, invalid/self/cyclic sponsor or mismatched password confirmation, **When** registration is submitted, **Then** appropriate feedback appears without duplicate/partial successful registration. Distinct same-person accounts remain permitted.
3. **Given** a valid verification link, **When** opened/inspected, **Then** validation alone does not activate the account; explicit confirmation consumes it once and authoritative success alone selects success presentation.
4. **Given** an expired/replaced/replayed/wrong-purpose link, **When** confirmation is attempted, **Then** no activation occurs and approved recovery/resend remains usable. Forged `state=success` grants nothing.
5. **Given** a resend request, **When** the server supplies neutral acknowledgement/cooldown/rate limiting, **Then** the UI follows that result without asserting mailbox delivery or bypassing limits. Missing email context uses only an approved surface.

### User Story 3 - Dedicated Administrator Sign-in (Priority: P1)

An administrator signs in at the dedicated entry, reaches the dashboard with real identity, and can sign out/recover access.

**Why this priority**: Navigation and fixture identity do not establish administrative authority.

**Independent Test**: Exercise approved admin entry/recovery/logout with two administrators, an employee and a deactivated admin, including direct-load/reload. Uses the approved C1-C2 surfaces and feedback.

**Acceptance Scenarios**:

1. **Given** an active verified administrator, **When** dedicated admin login succeeds, **Then** `/admin` opens with that administrator's authoritative header identity; reload retains the permitted session.
2. **Given** employee/invalid/deactivated/unverified credentials, **When** admin login is attempted, **Then** generic denial grants no dashboard content or admin data requests.
3. **Given** an anonymous/wrong-role visitor, **When** an admin URL opens directly, **Then** protected content/reads are denied while public admin entry remains reachable without a loop.
4. **Given** an allowed administrator later revoked/deactivated, **When** the next protected request/revalidation is denied, **Then** private administrative state is discarded and pending handlers/completions cannot regain authority.
5. **Given** a logged-in administrator, **When** approved logout completes, **Then** that session is revoked and reload/back cannot restore dashboard data. Shared recovery and fresh sign-in authorize only a new permitted session.
6. **Given** an administrator follows an existing employee-preview link, **When** the employee boundary is reached, **Then** navigation does not impersonate an employee, create a wallet or display employee fixtures as real identity.

### User Story 4 - Password Recovery, Change and Session Isolation (Priority: P1)

Both roles recover passwords; an employee changes their password through the account dialog. Private state ends according to server session authority.

**Why this priority**: Recovery/teardown must remain safe across devices, reload, races and identity changes.

**Independent Test**: Run reset/change/logout across two browser sessions, then switch A to B while earlier reads/commands remain pending. Uses the approved C1-C2 surfaces and feedback.

**Acceptance Scenarios**:

1. **Given** known/unknown/ineligible recovery email, **When** instructions are requested, **Then** public responses remain neutral without guaranteed delivery; rate-limit/unavailable results do not become simulated success.
2. **Given** a valid unexpired reset link, **When** a matching new password is explicitly submitted, **Then** success requires server commitment; all previous sessions are invalid and fresh role-appropriate sign-in is required.
3. **Given** missing/expired/replayed/replaced/wrong-purpose reset credentials or expiry during submission, **When** reset is attempted, **Then** no password change/apparent success occurs and approved new recovery remains available.
4. **Given** an employee password dialog, **When** correct current and valid different matching new passwords are submitted, **Then** confirmed change ends previous sessions; wrong-current/mismatch/unchanged-password failures retain recoverable input without success.
5. **Given** two valid sessions, **When** ordinary logout completes in one, **Then** only that session ends; password reset/change/account-wide revocation deny all old sessions.
6. **Given** A has pending reads/commands, **When** it signs out or B signs in, **Then** A's private content, credentials, errors and late completions cannot enter B's state. Back/refresh do not redisclose A's data.
7. **Given** a lost cookie-changing response or its requesting page closing/reloading, **When** the outcome is unknown, **Then** private restoration and further cookie-changing actions in that browser context remain unavailable across tabs/reloads. C2 uncertainty feedback explains recovery through a wholly isolated browser profile/private session when the original request can no longer be observed. A fresh context requires explicit sign-in and current authority validation; it does not prove the abandoned command committed or revoke a session it may have created. No automatic one-time replay or success/revocation claim is permitted.

### User Story 5 - Authoritative Account Basics (Priority: P2)

An employee reads their own identity and uses existing account password/logout controls and links.

**Why this priority**: Account basics should become real without acquiring later financial/policy domains.

**Independent Test**: Open/reload account as two employees and verify identity/commands. Uses C3's approved unavailable-region treatment.

**Acceptance Scenarios**:

1. **Given** an authorized employee, **When** account loads, **Then** name/email come from their current server account and survive reload; fixtures grant no permission or displayed identity fact.
2. **Given** identity loading fails or access is denied, **When** basics are requested, **Then** approved loading/error/restricted feedback appears without another identity or a fabricated default account.
3. **Given** financial/subscription/destination frontend gates are incomplete, **When** basics integrate, **Then** those regions gain no real financial action or invented current value; owner-approved unavailable treatment preserves the design and later ownership.

### User Story 6 - Administrator List and Invitation Controls (Priority: P2)

An administrator reads real admin accounts, invites an addressed recipient and changes permitted lifecycle state with confirmation and reason.

**Why this priority**: Controls must stop creating local privileged accounts and communicate pending invitations/lifecycle truthfully.

**Independent Test**: Read bounded lists, issue/accept an invitation, sign in the recipient and deactivate/restore an eligible target; exercise stale/concurrent commands and mail failure. Uses the approved C1-C3 surfaces and controls. Unsupported final management capabilities stay P14 after P13.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** the list opens, **Then** server identities/statuses and truthful scope/counts appear; empty/failed differ and another account's cache is absent.
2. **Given** unused email, entered name/reason and genuine confirmation, **When** invitation issuance commits, **Then** a pending invitation appears rather than an immediately active account. Existing employee/admin email cannot be promoted or have credentials replaced.
3. **Given** acknowledged/rejected/unknown/not-attempted delivery, **When** rendered, **Then** delivery evidence remains distinct from invitation disposition/mailbox receipt; lost responses do not trigger duplicate issuance automatically. A confirmed eligible reissue invalidates the previous generation; a confirmed revoke prevents acceptance. Stale-version, cooldown, ineligible-state or authority denials produce feedback without apparent replacement/revocation, and uncertain responses require reconciliation.
4. **Given** a valid addressed invitation and eligible issuer, **When** the recipient explicitly supplies a valid matching password, **Then** one verified admin is created and must sign in separately; validation alone and invalid/replayed/revoked/replaced/expired/issuer-denied credentials grant nothing.
5. **Given** eligible target/current version, **When** confirmed reasoned activation/deactivation commits, **Then** authoritative state and revocation/non-revival appear; self/last-admin/pending-target denial is shown safely.
6. **Given** concurrent commands, stale target or actor revocation, **When** one result is permitted, **Then** losing UI refreshes truth without invented success, partial audit attribution or newer-state overwrite.
7. **Given** unsupported edit/activity/search/status-aggregate controls, **When** integrated, **Then** owner-approved disposition applies; fixtures, page-only totals labeled complete, fabricated reasons and unsupported requests are never substitutes.

### Edge Cases

- Existing-password input shorter than the new-password minimum remains accepted; new/reset/change/invitation passwords retain 15-128 characters. Passwords are not trimmed/normalized.
- Blank referral input means no sponsor; valid input follows shared normalization. Sponsor never changes later and public input cannot select ADMIN.
- Direct links on another device, absent registration context, forged display-state queries and malformed/oversized/wrong-purpose credentials grant no activation/password setting.
- Exact server expiry is invalid despite an earlier valid check. Browser/host timezone does not determine expiry; previews/reload/repeated rendering do not consume credentials.
- Rapid clicks, remount, closing a pending dialog and concurrent tabs cannot override single-use/version authority. Uncertain commands are not automatically repeated.
- Refresh/read/mutation completion after logout/revocation/switch cannot restore old tokens, private data or authority.
- Network/provider/contract errors differ from confirmed anonymous/forbidden results. Malformed success cannot supply a user, token, empty list or zero balance.
- Restoring banned employees/deactivated admins never revives old sessions. Partial task/withdrawal restrictions do not prohibit otherwise valid login.
- Admin preview links cannot grant an employee persona. Guest-only treatment must not block legitimate verification/reset/invitation because an unrelated account is signed in.
- Empty/out-of-range lists and changing target state use approved feedback; unsupported global search/status filters stay disabled, and unbounded fetching or current-page status totals cannot bypass bounded contracts.
- Long Arabic names/mixed-direction emails/codes, keyboard focus, dialog dismissal and pending actions remain usable on narrow screens through approved C1-C3 feedback; additional unapproved surfaces remain owner gates.
- No authentication timer/fixture/link grants paid membership, task entitlement, credit, reservation or transfer. Financial calendars/provider outcomes remain outside P03.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Integrate only P03 surfaces after required predecessor backend acceptance; apply only the explicit C1-C3 bounded exceptions, preserving all other frontend restrictions, without waiving requirements or silently adding other UI. (All stories; scope/gates)
- **FR-002**: Employee login MUST establish current server identity from supplied credentials, without prefilled demo credentials, timer authorization or fixture fallback. Only confirmed permitted identity grants access. (US1/AC1-4)
- **FR-003**: Existing-password entry MUST accept supported 1-128-character input without the new-password minimum. New passwords MUST enforce 15-128 characters, confirmation and server different-password rules where applicable. Never change password text. (US1/AC1-2; US2/AC2; US4/AC2-4)
- **FR-004**: Post-login/reauthentication navigation MUST use current role and safe `/employee` or `/admin` destinations. Reject external, protocol-relative, malformed, credential-bearing, wrong-role and authentication-loop return targets. (US1/AC6; US3/AC1-3)
- **FR-005**: Protected boundaries MUST resolve authoritative sessions before showing private content or starting private reads. Anonymous/inactive/unverified/wrong-role cannot pass. Unavailable/malformed checks produce approved retry feedback, not authorized/anonymous defaults. (US1/AC2-4; US3/AC2-3)
- **FR-006**: Confirmed authority denial MUST stop protected content/reads/handlers; old completions cannot restore access. Every protected server request still authorizes independently of UI controls. (US1/AC5; US3/AC4; US4/AC6)
- **FR-007**: Registration MUST use email/password, name and optional referral through the current employee boundary; no public role, OTP or social auth. Preserve its fixed sponsor decision across reload/later use. (US2/AC1-2)
- **FR-008**: Registration MUST distinguish pending acceptance from validation/conflict/provider failure; repeated requests cannot produce apparent duplicate creation. Invent no balance/membership/session; allow distinct same-person accounts. (US2/AC1-2/5)
- **FR-009**: Verification/reset/invitation outcomes MUST follow authoritative validation and explicit action. Link opening/preview/reload and display-state parameters cannot consume credentials or select successful activation/password setting. (US2/AC3-4; US4/AC2-3; US6/AC4)
- **FR-010**: Missing/malformed/expired/replaced/revoked/replayed/wrong-purpose/ineligible credentials MUST show approved invalid/expired/recovery outcomes without state change. Exclusive server expiry prevails over earlier checks/browser time. (US2/AC4; US4/AC3; US6/AC4)
- **FR-011**: Resend MUST use legitimate email context and neutral/cooldown/rate-limit results, including direct-link/reload cases. Never invent delivery/existence; use C2's approved email entry when context is missing and neutral Arabic feedback. (US2/AC5)
- **FR-012**: Dedicated email/password admin entry at `/admin/auth/login` MUST use the existing admin-only boundary and admit only active verified admins; employee/invalid/unverified/disabled credentials receive generic denial. No public admin signup; use the C1-authorized existing visual components. (US3/AC1-3)
- **FR-013**: Public admin entry/recovery/invitation MUST remain reachable without dashboard authority/redirect loops while dashboard stays protected. C1 authorizes the necessary public/protected layout separation and shared generic activation/recovery reuse; preserve existing URLs and dashboard appearance. (US3/AC3; US6/AC4)
- **FR-014**: Admin header identity MUST come from the authenticated admin. Hard-coded identity grants no permission or real audit actor/time; preview navigation cannot impersonate an employee. Later-domain fixtures gain no server authority. (US3/AC1/6; US6/AC6)
- **FR-015**: Both roles MUST retain shared recovery, neutral public outcomes and role-appropriate fresh sign-in. Use C1's shared generic destinations and C2's approved role-neutral Arabic feedback; lifetime/delivery claims must match server evidence and admin recovery cannot invent employee identity. (US3/AC5; US4/AC1-3)
- **FR-016**: Employee password change MUST use existing dialog/current password and valid different matching new password; success requires server commitment. End all prior sessions and clear credential/private state before fresh sign-in; C2 authorizes replacing local/preview-success copy with the committed outcome and fresh sign-in guidance. (US4/AC4/6)
- **FR-017**: Employee/admin logout MUST end the current server session and clear/cancel private state. Ordinary logout preserves other devices; reset/change/account-wide denial ends prior sessions per P02. Use the C1-authorized admin logout control. (US3/AC5; US4/AC5-6)
- **FR-018**: Reload MUST recover only valid server authority. Suspension/ban/deactivation/revocation deny old sessions at the next authoritative check; restoration requires fresh permitted login. Independent task/withdrawal blocks preserve otherwise valid login. (US1/AC1/5; US3/AC4-5; US4/AC5)
- **FR-019**: Switching/ending identity MUST isolate private work by account/session. Passwords/action credentials/raw secret-bearing errors cannot persist in browser storage, cache identities/metadata, retained command state, logs or shared artifacts. Do not propagate credential links into return navigation/incidental requests. (US4/AC6; link scenarios)
- **FR-020**: Auth/session/account/admin/invitation successful responses MUST satisfy current shared public contracts before credentials/data are accepted. Missing/wrong-role/malformed/private fields yield safe contract errors, without default identities, leaked payloads or endless retry. (US1/AC4; US5/AC2; US6/AC1)
- **FR-021**: Integration MUST retain existing cookie/refresh/CSRF, bounded validation/rate-limit and redaction protections, using the existing shared session/transport owners. No second auth path or weakened checks to enable a screen. (US1/AC1-5; US3/AC1-5; US4/AC2-7)
- **FR-022**: Operations MUST expose safe approved pending/validation/restricted/conflict/rate-limit/unavailable/retry outcomes through approved surfaces. Acknowledgement cannot prove mailbox delivery. C1-C3 authorize only the recorded bounded authentication/management feedback and Arabic unavailable-data treatment; any additional missing surface requires a new owner decision. (US1/AC2-4; US2/AC2/5; US4/AC1/7; US6/AC2-6)
- **FR-023**: Credential/admin commands MUST prevent duplicate in-flight submission and automatic uncertain mutation replay. Dialog close/remount cannot unlock the request. Lost responses require approved uncertainty/reconciliation, not invented success/revocation. (US4/AC7; US6/AC3/6)
- **FR-024**: Account basics MUST display authorized current employee name/email in existing read-only identity and connect password/logout. Create no profile editor or unsupported email/sponsor/identity change. (US5/AC1-2)
- **FR-025**: Account financial/subscription/address/policy/support work MUST remain with later gates. No P03 financial workflows or fixtures/defaults presented as authenticated financial facts; use C3's approved Arabic unavailable values and disable unsupported actions in the existing regions until P05/P12/P14 gates, without fabricated zero/Free/empty-address defaults. (US5/AC3)
- **FR-026**: Admin list/read MUST use authorized bounded results and distinct empty/unavailable/denied states. C3 authorizes existing pagination for administrator and invitation lists and total counts from their server pagination metadata. Disable unsupported global search/status filters; show status-specific aggregates and activity as unavailable pending P13/P14. Do not use current-page counts/filtering or fetch all pages as substitutes for global capabilities. (US6/AC1/7)
- **FR-027**: Invitation issuance MUST use entered name/email/reason and genuine confirmation through the C3-authorized adaptation of the existing add-admin dialog. Describe pending invitation, not local instant ADMIN creation; collisions cannot promote accounts or replace credentials. (US6/AC2)
- **FR-028**: Invitation display MUST separate pending/accepted/revoked/expired disposition from not-attempted/acknowledged/rejected/unknown delivery. C3 authorizes an invitation section on the existing management screen with read/reissue/revoke controls using current version, entered reason and genuine confirmation; reissue/revoke outcomes must reconcile authoritative disposition/delivery without invented acceptance. (US6/AC3/7)
- **FR-029**: Invitation password setting MUST validate purpose/address/current issuer, require explicit matching password and create one verified admin without auto-session; sign-in is separate. Use the C1-authorized `/admin/auth/accept-invitation` surface. (US6/AC4)
- **FR-030**: Admin lifecycle commands MUST use the C3-authorized existing confirmation/reason surfaces, entered reason/current version and committed results. Safely show stale/self/last-admin/pending-target/revoked-actor denial; restore no old sessions. (US6/AC5-6)
- **FR-031**: Unsupported administrator name/email management editing, activity, global search/status filters and status-specific aggregates MUST follow C3's disabled/unavailable disposition and remain for P13/P14 requirements/integration. No invented P03 backend or simulated successful operation. (US6/AC7)
- **FR-032**: Saves MUST reconcile affected authorized views from validated results/refetches. Preserve unrelated dirty input on refresh; late results/stale versions/concurrent changes cannot overwrite newer identity, draft or lifecycle state. (US4/AC6; US6/AC5-6)
- **FR-033**: Preserve approved Arabic/RTL/Cairo/light rendering, navigation, static copy and dimensions outside explicit exceptions. Inputs/errors/dialogs MUST provide labels, keyboard/focus/pending behavior and readable mixed-direction identity. (All stories; C1-C3)
- **FR-034**: Implementation MUST establish absent configured Playwright/web `test:e2e` work and actual auth/account/admin-list/adapter/component tests. Browser acceptance uses real test web/API/persistence sessions, cookies, reload/history/account isolation and controlled email; screenshots/component-only doubles cannot substitute. (All stories; SC-001-SC-008)
- **FR-035**: Phase acceptance MUST run focused new/changed and affected shared auth/contract/transport/session regressions plus mobile/accessibility/UI-preservation browser checks. Distinguish fresh/cached/reused/unrun checks/missing services; unmet prerequisites/decisions/results cannot be reported as P03 complete. (All stories; scope/gates)

### Key Entities _(include if feature involves data)_

- **Current account**: Server identity, role, lifecycle/verification, employee referral identity and independent restrictions belonging to current session; no other account/fixture substitutes.
- **Session authority**: Device/session permission with refresh/revocation/expiry; multiple devices permitted, ordinary logout distinct from account-wide ending.
- **Registration/sponsor decision**: Pending employee and fixed optional sponsor; activation grants no financial entitlement.
- **One-time action credential**: Purpose/subject/expiry/consumption/replacement proof for verification, reset or invitation. Validation differs from consumption; transient client input.
- **Administrator account**: Real ADMIN identity, pending/active/deactivated state/current version with server self/last-admin/pending-account protections.
- **Administrator invitation**: Addressed name/email, issuer, generation/version, expiry/disposition and separate delivery evidence; acceptance creates once without promoting existing accounts.
- **Private view/command state**: Account-scoped reads/results/drafts, genuine reason/confirmation and safe feedback; cannot outlive owning authority or become financial/audit truth.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All five employee auth routes and account identity/password/logout complete declared accepted/denied journeys against persisted test accounts. Every successful login reloads as the same identity; zero timer/display-state/fixture paths grant access. (US1, US2, US4, US5; FR-002-FR-011/015-FR-024)
- **SC-002**: Guest/employee/active-admin/unverified/suspended/banned/deactivated access cases yield zero unauthorized content disclosures/private reads. Unavailable/malformed session checks grant zero access; dedicated admin entry has no dashboard loop. (US1, US3; FR-004-FR-006/012-FR-014/018-FR-022)
- **SC-003**: Verification/reset/invitation previews consume zero credentials. Each valid explicit action accepts at most once across repeats/concurrency; missing/wrong-purpose/replaced/replayed/revoked/expired credentials, including exact expiry, yield zero unauthorized effects/apparent success. (US2, US4, US6; FR-009-FR-011/015-FR-016/029)
- **SC-004**: Two device sessions prove ordinary logout isolation; reset/change/account-wide denial reject all previous sessions at their next protected check. A-to-B switching with delayed A reads/refreshes/commands exposes zero A data/revived credentials/stale authority. (US1, US3, US4; FR-006/017-FR-019/023/032)
- **SC-005**: Declared invitation/lifecycle states distinguish delivery uncertainty, replacement/revocation and prior-token invalidation, email conflict, stale version, actor/pending-target/self/last-admin denial and restoration. Zero local ADMIN creation, invented reason/activity/count or unsupported successful edits are accepted. (US6; FR-026-FR-032)
- **SC-006**: After credential-flow settlement/teardown, sentinel passwords/action credentials occur zero times in retained application caches, storage, safe errors, return destinations or shared verification artifacts. Invalid responses supply zero accepted tokens/users/default financial values. (US4; FR-019-FR-023/025)
- **SC-007**: Integrated existing routes retain approved phone/desktop normal rendering. Focused 320px and representative 390/430px checks show zero page overflow, clipped Arabic, hidden actions or inaccessible dialogs; keyboard/focus/dismissal and loading/error feedback pass. Zero unauthorized rendering/static-copy changes; exceptions trace to C1-C3. (All stories; FR-033-FR-035)
- **SC-008**: Every in-scope requirement has automated acceptance evidence at its relevant boundary; all focused/shared/browser checks and predecessor/owner gates pass before completion. Missing evidence stays unpassed. P03 introduces zero financial transitions, unrelated-phase implementation or unauthorized surfaces. (FR-001/014/025/031/034-FR-035; scope/gates)

## Assumptions

- Account basics means current read-only name/email and password/logout controls; an owner-safe profile service does not authorize a new editor.
- Employee login has no remember-session selector. Use ordinary server session policy unless the owner approves that control; infer no browser credential storage.
- P02 identity/session/admin/invitation behavior and contracts are the baseline. Generic auth callers retain compatibility when shared helpers change, without screen redesign.
- Mail currently targets generic verification/reset routes. C1 retains those destinations for shared role-neutral activation/recovery and approves `/admin/auth/accept-invitation` as the invitation destination. Preserve existing employee URLs and explicit consumption; C2 governs the affected copy/feedback.
- Test email uses controlled boundaries/accounts. Production sender/company/support/deliverability and approved production destinations remain external launch gates; acknowledgement is not receipt.
- Metrics measure declared acceptance, not coverage/capacity/response-time promises or already executed tests. No application tests, browser checks or later workflow command runs during SPECIFY.
- Approved one-admin authority/no admin 2FA or dual approval remain. Compromised-admin/host risk and independent launch review remain visible; no security guarantee is made.
- C1-C3 are explicit bounded frontend exceptions for authorized P03 work; all four questions are answered. The effective predecessor evidence and omitted CONVERGE stage are recorded above. Production launch prerequisites remain separate gates; implementation still requires a scoped owner request.
