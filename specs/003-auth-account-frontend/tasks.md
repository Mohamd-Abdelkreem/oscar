# Tasks: P03 - Authentication and Account Frontend

**Roadmap Phase**: P03 - Authentication and Account Frontend

**Feature Directory**: `specs/003-auth-account-frontend` (verified against `.specify/feature.json` and `spec.md`). The actual Git branch is `002-identity-admin-backend`; feature selection does not require changing it.

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [HTTP contract](contracts/http.md), [UI/session contract](contracts/ui-session.md) and [quickstart.md](quickstart.md).

**Prerequisites**: Constitution 1.0.0; P01 closure and P02 T001-T067/backend acceptance recorded in predecessor artifacts; C1-C3 resolved in the clarified spec. These are reused evidence, not fresh tests. The later owner instruction recorded in `plan.md`/research R1 removes separate CONVERGE for P02 and later phases; do not reinstate that superseded procedural gate or claim it ran. Backend acceptance, implementation reviews and release gates remain mandatory.

**Implementation Scope**: Authorized IMPLEMENT completed T001-T065. Phase 9 T060-T065 closes the local P03 implementation gate with final coverage/UI/code/security/React/test/docs reviews, owning package checks, actual producer integration, all 48 browser scenarios and build/output verification. Both checklists (38/38 and 16/16), the feature pointer and predecessor task lines remain unchanged. Exact results, corrected intermediate failures, preserved concurrent work and external launch gates are recorded in `quickstart.md`. Checklist approval is distinct from implementation acceptance; local acceptance does not authorize deployment, live mail or funds.

**Tests**: REQUIRED. Tasks create/extend actual discovered test files and require observed results. No application test, browser/service startup, dependency installation or implementation occurs during TASKS. Existing paths below were inspected; absent files are proposed deliverables in their existing owners.

**Organization**: Internal Phase headings are task groups within P03, not new roadmap phases. The first group verifies selected-phase prerequisites; it initializes no toolkit/project and repeats no constitution or completed backend work.

## Scope and execution rules

- Reuse P02 routes, identity/admin schemas, authorization, cookies, CSRF, limits, lifetimes and persistence. No P03 schema migration, new production API, bootstrap, financial transition, provider integration, search API or admin email-edit capability.
- C1 permits only `/admin/auth/login`, `/admin/auth/accept-invitation`, usable admin logout and bounded public/protected layout separation. C2 permits the recorded authentication controls/truthful copy/Arabic feedback; C3 permits existing-screen invitation/confirmation/reason/pagination controls and unavailable/disabled treatment. All other URLs, page placement, layout/navigation, static copy, Cairo/RTL/light styling and dimensions stay frozen. Additional surfaces require an owner decision.
- Preserve global fixture providers for later consumers; migrated identity/admin/account basics cannot use them as facts. Account balances/subscription/destination remain unavailable, with unsupported actions disabled; no zero/Free/empty-address substitute.
- Shared boundary/lifecycle tests and backend predecessor acceptance must pass before dependent screen wiring. Tests may be authored before their implementation, but task completion requires the declared checks. Never weaken assertions or substitute mocks for required persistence/browser evidence.
- Read all eight engineering guides at implementation entry; revisit the owning sections/source per batch. Apply clean-code-guard and security-best-practices to affected production code, vercel-react-best-practices/installed Next guidance to React/Next work, test-guard to changed tests, docs-guard to changed technical docs and playwright to browser verification. Incorporate findings into the owning task, with final review in T062.
- `[P]` marks independent file ownership after its stated prerequisites pass. It is a scheduling opportunity, not permission to launch agents or implement tasks. Shared transport, hooks, guards, component test files and browser suites have single ownership at a time.

## Phase 1: Selected-Phase Prerequisites

**Purpose**: Establish the effective P03 gates and executable baseline without recreating P01/P02.

- [x] T001 Verify P03 selection/accepted C1-C3 and effective predecessor evidence in `.specify/feature.json`, `specs/003-auth-account-frontend/spec.md`, `specs/003-auth-account-frontend/plan.md`, `specs/002-identity-admin-backend/tasks.md` and `specs/002-identity-admin-backend/quickstart.md`; inspect current analysis findings and `specs/003-auth-account-frontend/checklists/auth-account.md`/`specs/003-auth-account-frontend/checklists/requirements.md` during the authorized IMPLEMENT preflight. Keep approval markers read-only during application work; report any unresolved mandatory gate before dependent edits.
- [x] T002 Verify Node/pnpm, actual scripts/test discovery/dependency outputs in `package.json`, `apps/web/package.json`, `apps/api/package.json`, `packages/contracts/package.json`, `packages/database/package.json`, `apps/web/vitest.config.ts` and API integration setup; read `apps/web/AGENTS.md`, `apps/web/CLAUDE.md` and relevant installed Next docs. Run the existing focused auth/transport/guard and contract baseline from the commands below, inspect approved screen peers before changes, and record fresh/cached failures plus Docker/Chromium/ports 3103/4103/build-resource availability in `specs/003-auth-account-frontend/quickstart.md` (depends on T001; missing browser infrastructure remains an acceptance gate).

**Checkpoint**: Scope/predecessor/checklist/analysis gates are explicit. Baseline failures are classified rather than accepted as passes. This verification batch authorizes no later-phase implementation.

## Phase 2: Foundational Boundaries and Browser Support

**Purpose**: Complete the small shared contract, transport and lifecycle changes that all journeys consume; prepare isolated browser support without changing production backend behavior.

- [x] T003 Create `packages/contracts/src/auth/auth-response.schema.test.ts` for strict valid-only, bounded nonblank neutral-message and empty-object replies; reject missing/wrong-type/private/extra fields and preserve existing password/referral/identity/admin/envelope regressions (depends on T002).
- [x] T004 Implement/export `credentialValidityDataSchema`, `neutralEmailDataSchema` and `emptyActionDataSchema` in proposed `packages/contracts/src/auth/auth-response.schema.ts` and existing `packages/contracts/src/index.ts`, describing only current P02 replies and using existing shared string/envelope owners; run T003 and existing contract tests (depends on T003).
- [x] T005 [P] Extend `apps/web/src/services/api/api-client.test.ts` and `apps/web/src/shared/query/query-client.test.ts` for safe errors before cache retention, status/envelope disagreement, malformed refresh/private output, cancellation, bounded transient read retries and exclusion of contract/denied/public-action/uncertain mutation replay; include sentinel body/header/URL/nested-message cases (depends on T002; independent of T006).
- [x] T006 [P] Create `apps/web/src/services/api/session-runtime.test.ts` for epoch/check ordering, delayed A reads/refresh/cookie commands, invalidation without authority, unsupported coordination/storage and remount guards. Cover write/read-back before dispatch, matching live-owner complete-response release versus deadline/abort/network failure, inherited/malformed barrier after holder loss and lock reacquisition, no TTL/finally/other-owner deletion, and no secret in the record; assert no private restoration/replacement cookie command or obsolete token/navigation admission while quarantined, per `specs/003-auth-account-frontend/contracts/ui-session.md` U1 (depends on T002; independent of T005).
- [x] T007 Update `apps/web/src/services/api/api-client.ts`, `apps/web/src/shared/query/query-client.ts` and, where required for known-field Arabic mapping, `apps/web/src/shared/forms/form.ts` so only bounded safe categories/status/codes/allowed field projections reach caches; discard raw Axios/Zod payloads/config/URLs/causes and retain at most two classified transient read retries with mutations unretried. Keep endpoint data schemas in feature adapters and run T005's tests (depends on T004, T005).
- [x] T008 Implement proposed browser-only `apps/web/src/services/api/session-runtime.ts` with non-secret epoch/check generations, current authority retirement, completion guards and one same-origin Web Lock plus U1's strict nonsecret localStorage cookie-write barrier. Read/validate and write/read back before dispatch; retain the original observer across component dismissal/UI deadlines, and remove only a matching live owner's record after complete terminal HTTP observation. Block private restoration/cookie writes for inherited/uncertain/invalid/unreadable state; no abort/unload/TTL/finally/lock-reacquisition release. BroadcastChannel/storage events send retirement hints only. Expose safe C2 isolated-browser-context recovery guidance without reset controls or abandoned-success/revocation claims; clean listeners/resources, preserve the barrier on teardown and avoid SSR mutable account state (depends on T006, T007).
- [x] T009 Integrate `apps/web/src/services/api/api-client.ts`, `apps/web/src/services/api/browser-location.ts` and existing `apps/web/src/services/api/index.ts` with T008: retain one memory-token/export owner and one parsed single-flight refresh for restoration/interceptors; serialize login/refresh/logout/logout-all/reset/change cookie writes without nested locks. Capture complete terminal HTTP observation internally before safe error/data projection so a real denial differs from abort/network/CORS failure without retaining raw responses; keep cookie observers separate from read cancellation/UI deadlines. Extend exact public-auth recognition for admin login/one-time actions, propagate read signals/scope and replace reload-based redirects with App Router lifecycle notifications. Replay a protected 401 only when authentication necessarily precedes execution; run T005-T006 checks (depends on T004, T007, T008).
- [x] T010 Create `apps/web/src/features/auth/api/auth.api.test.ts` and `apps/web/src/features/users/api/users.api.test.ts` for exact existing methods/paths/body/query/signals, 200/201 status/data agreement, strict identity/reply parsing before token admission, no token-bearing cache result and safe malformed/private/wrong-role rejection; cover every auth/account operation in `specs/003-auth-account-frontend/contracts/http.md` (depends on T004, T009).
- [x] T011 Extend `apps/web/src/features/auth/api/auth.api.ts` for dedicated admin login, nonconsuming verification/invitation validation and explicit acceptance; validate all auth replies with current shared schemas before returning safe DTOs/admitting current-scope tokens. Update `apps/web/src/features/users/api/users.api.ts` for parsed abortable current-user reads and compatible existing profile responses; preserve P02 wire methods/cookies/CSRF and run T010 (depends on T010).
- [x] T012 Extend `apps/web/src/features/auth/hooks/auth.hooks.test.tsx` and `apps/web/src/features/users/hooks/users.hooks.test.tsx`, and create `apps/web/src/features/auth/hooks/credential-commands.hooks.test.tsx`, using real QueryClients to prove fresh scoped authority, policy-403 reconciliation, cancellation/retirement, safe private state, command guards across remount and no settled password/action credential in query/mutation options/variables/data/errors/metadata; cover correctable live input versus completed/dismissed/retired flow (depends on T011).
- [x] T013 Update `apps/web/src/features/auth/hooks/auth.hooks.ts` and `apps/web/src/features/users/hooks/users.hooks.ts`, and create `apps/web/src/features/auth/hooks/credential-commands.hooks.ts`, for account/epoch/check-scoped reads and transient imperative credential preview/commands outside retained Mutation variables. Capture bounded link input once in browser memory and clean same-route history without consumption/storage/SSR props; preserve guards until pending/unknown work is safely settled. Implement ordinary versus account-wide teardown/uncertainty and adapt existing `apps/web/src/features/auth/components/login-form.tsx`, `apps/web/src/features/auth/components/register-form.tsx` and `apps/web/src/features/users/components/profile-form.tsx` callers without adding editors/redesign; run T012 and existing generic form regressions (depends on T012).
- [x] T014 [P] Create test-only `apps/api/tests/e2e/server.ts`, `apps/api/tests/e2e/control.ts` and `apps/api/tests/e2e/tsconfig.json`; add `check-types:e2e` to `apps/api/package.json` and narrowly register support-file typed lint coverage in `apps/api/eslint.config.mjs` without changing production build inclusion or weakening rules. Each child serves exactly one independent scenario: before config/limiter imports discard inherited DATABASE_URL, AUTH_LIMIT_* overrides, API_RATE_LIMIT_MAX and API_RATE_LIMIT_WINDOW_MS; set child-only RAILWAY_ENVIRONMENT=p03-e2e for env.ts's existing dotenv bypass and supply explicit required test configuration. Migrate its disposable PostgreSQL 18.4 using that explicit URL, seed initial test identities and compose actual `createApp` with controlled email/safe logging. Preserve real middleware/default limits/IP keys; a new OS process, not createApp reconstruction or mail reset, isolates module-level stores. Use bounded typed private IPC for scenario mail/expiry/fault/state control and injected Resend outcomes; no public control/store-reset endpoints, live mail or production imports. Fail on occupied port 4103 and dispose owned listeners/client/container on failure/disconnect (depends on T002; independent of T015).
- [x] T015 [P] Pin only web dev `@playwright/test@1.63.0` in `apps/web/package.json`/`pnpm-lock.yaml`, create `apps/web/playwright.config.ts`, `apps/web/e2e/tsconfig.json` and `apps/web/e2e/support/safe-reporter.ts`, and register `test:e2e`/`check-types:e2e` with explicit config/support/spec discovery plus narrow typed/runtime lint coverage in `apps/web/eslint.config.mjs`. Configure Chromium/one worker/fresh contexts/no server reuse/no automatic retries; disable automatic trace/video/screenshots/HTML/raw errors/HAR/storage-state and report static scenario IDs/status/safe codes only. Place runner outputs under `output/playwright/p03/` and add that precise new-output ignore to `.gitignore`, preserving historical artifacts; install test Chromium or report its absence and preserve all existing versions/checks (depends on T002; independent of T014).
- [x] T016 Create `apps/web/e2e/support/fixtures.ts` and `apps/web/e2e/support/start-web.mjs` with test-scoped new API OS process/disposable migrated database/mail/fault state/browser contexts for every independent scenario. Prepare the immutable Next build once per worker with the test public URL, then start owned Next/API processes per scenario at `127.0.0.1:3103`/`:4103`; configure exact CORS/recovery/invitation destinations in child environments only, hide Windows helpers and reject existing servers/databases. Related race/replay/abuse steps and their tabs/devices share one API/counters; budget legitimate calls against unchanged limits, without overrides, forged IPs, store resets or mid-case restarts. Bound startup and dispose all partially/fully owned resources before the next scenario; retain typed private IPC/transient mail and cleaned/masked explicit screenshots only under ignored `output/playwright/p03/` (depends on T014, T015).
- [x] T017 Update `apps/web/next.config.ts` with scoped no-referrer headers for employee/shared verification/reset and admin invitation credential pages plus version-supported development request-log suppression for those routes; retain current typedRoutes/reactCompiler/build controls. Check the installed Next logging/header guidance; actual browser/header/referrer/diagnostic verification is required by T042/T061, and production ingress remains a launch gate (depends on T002).
- [x] T018 Run focused T003-T013 and existing auth/transport/query/form regressions plus affected contract/web lint/types and both new support type checks; verify isolated API/Next startup and owned-resource cleanup from `apps/api/tests/e2e/server.ts`/`apps/web/e2e/support/start-web.mjs` with test-only configuration. Apply code/security/React/test review and record boundary readiness or actual missing infrastructure in `specs/003-auth-account-frontend/quickstart.md` (depends on T003-T017; dependent UI wiring requires the shared behavior checks to pass, and real browser acceptance cannot pass with unavailable services).

**Checkpoint**: Parsed DTOs, one refresh, safe errors and session/credential lifecycles are tested before screens consume them. Browser support is explicitly registered; its presence/type checking does not establish browser acceptance.

## Phase 3: US1 - Employee Sign-in and Protected Access (Priority: P1)

**Goal**: Establish current identity and prevent unauthorized mounting/reads with safe role navigation.

**Independent test**: Persisted active verified employee login/direct-load/reload; invalid/unverified/suspended/banned denial; partial restrictions remain eligible; unavailable/malformed checks grant nothing; later authority denial and hostile return paths cannot restore protected content. Generic login returning ADMIN navigates to admin rather than creating an employee persona. Requires T018 and real-service harness for browser evidence. Trace: FR-002-FR-006/018/020-FR-023/033-FR-035, SC-001/002/004/006/007.

### Tests

- [x] T019 [P] [US1] Extend `apps/web/src/components/auth/routes.test.tsx`, `apps/web/src/components/auth/route-state.test.ts` and `apps/web/src/features/auth/utils/safe-return-path.test.ts` for checking/allowed/denied/wrong-role/unavailable/contract outcomes, protected navigation/focus/reconnect check generations, no protected child/private-query mounting and role-safe paths rejecting encoded credentials/external/protocol-relative/backslash/control/auth-loop targets (depends on T018; independent of T020).
- [x] T020 [P] [US1] Create the US1 cases in `apps/web/src/features/employee/components/auth/employee-auth.integration.test.tsx` for blank initial credentials, shared 1-128 existing-password entry without trimming, rememberMe:false, validated role destination, generic denial, pending/double-submit and safe retry feedback; use real QueryClient and adapter-boundary controls rather than timer success (depends on T018; independent of T019).

### Implementation and verification

- [x] T021 [US1] Update `apps/web/src/components/auth/protected-route.tsx`, `apps/web/src/components/auth/guest-only-route.tsx`, `apps/web/src/components/auth/session-loader.tsx`, `apps/web/src/features/auth/utils/safe-return-path.ts`, `apps/web/src/features/auth/utils/session-navigation.ts` and `apps/web/src/features/auth/constants/auth.constants.ts` for fresh role/status/verified authority, immediate generation-derived blocking and approved Arabic error/retry states. Preserve pure guard resolvers in their owners, use typed App Router links/replace and actual-role default destinations, and adapt generic login navigation without credential propagation/reloads; run T019 (depends on T019, T020).
- [x] T022 [US1] Wire current employee access in `apps/web/src/app/employee/(app)/layout.tsx` and real login in `apps/web/src/features/employee/components/auth/login-screen.tsx`; protect shell/children as USER before private reads, remove timer/demo credentials and use shared validated login/current-account lifecycle with no fixture fallback. Preserve existing presentation except C2 feedback and run T020 (depends on T021).
- [x] T023 [US1] Create US1 scenarios in `apps/web/e2e/identity-and-admin-access.spec.ts` against real test services: permitted/denied login, direct load/reload, partial restrictions, next-check ban/restoration non-revival, blocked private reads and safe role/return navigation; use controlled boundary faults for unavailable/malformed cases without replacing normal backend journeys (depends on T022, T016).
- [x] T024 [US1] Review/run US1 component/guard/navigation and filtered real browser scenarios from `apps/web/e2e/identity-and-admin-access.spec.ts`; check phone/desktop normal rendering and record fresh outcomes plus any blocked checks in `specs/003-auth-account-frontend/quickstart.md`. Mark this slice only after its checks; cross-device/session-race acceptance is completed by US4, not inferred here (depends on T023).

## Phase 4: US2 - Registration and Email Activation (Priority: P1)

**Goal**: Persist pending employees/fixed sponsor intent and require explicit authoritative activation.

**Independent test**: Register with absent/valid referral, retrieve controlled mail, preview without activation, explicitly confirm once; repeat normalized-email/referral/confirmation failures, forged state, expired/replaced/replayed/wrong-purpose links, expiry-after-preview and neutral resend without context. No session/credit/paid entitlement. Trace: FR-003/007-FR-011/019-FR-023/033-FR-035, SC-001/003/006/007.

### Tests

- [x] T025 [US2] Extend US2 cases in `apps/web/src/features/employee/components/auth/employee-auth.integration.test.tsx` to cover shared referral normalization/blank omission, matching password confirmation, committed pending identity versus delivery uncertainty, direct-link/reload/missing-email resend, no POST on preview, forged success and expiry after preview; exercise the existing generic `apps/web/src/features/auth/components/verify-email-panel.tsx` as well (depends on T024; single owner of the shared test file).

### Implementation and verification

- [x] T026 [US2] Wire `apps/web/src/features/employee/components/auth/register-screen.tsx` to shared employee registration/transient commands with client matching confirmation, optional 32-character hexadecimal referral normalization and no public role. Display pending inbox state only on validated acceptance; correct the referral/example/entitlement copy under C2 and reconcile provider/lost-response uncertainty without automatic registration replay/session creation (depends on T025).
- [x] T027 [US2] Wire `apps/web/src/features/employee/components/auth/verify-email-screen.tsx` and `apps/web/src/features/auth/components/verify-email-panel.tsx` to transient nonconsuming validation and explicit confirmation; remove demo activation/display-state authority, retain C2 missing-context email input and neutral resend/rate-limit/retry states, clean credential history and distinguish expired/replaced/replayed/wrong-purpose/uncertain from committed success. Shared generic copy/sign-in destinations are role-neutral; run T025 (depends on T026, T013, T017).
- [x] T028 [US2] Create US2 cases in `apps/web/e2e/auth-account.spec.ts` for persisted pending registration/fixed sponsor, controlled verification mail, preview/reload without consumption, explicit single use, replacement/wrong-purpose/expiry-after-preview and neutral resend; inspect final isolated server state through private fixture control and reuse P02 exact-expiry/concurrency evidence for unchanged server semantics (depends on T027).
- [x] T029 [US2] Apply production/security/React/test review and run US2 focused component/shared adapter-contract and filtered `apps/web/e2e/auth-account.spec.ts` cases; record actual paths/results and truthful email evidence in `specs/003-auth-account-frontend/quickstart.md` (depends on T028).

## Phase 5: US3 - Dedicated Administrator Sign-in (Priority: P1)

**Goal**: Expose only the authorized public entry while protecting dashboard identity/content and providing real logout.

**Independent test**: Two active administrators independently sign in/reload/see their own identity/log out; employee/guest/unverified/deactivated denied without private reads; next-check revocation hides state, public entry has no loop and employee-preview links grant no persona. Shared recovery end-to-end additionally requires US4 T043. Trace: FR-004-FR-006/012-FR-015/017-FR-023/033-FR-035, SC-002/004/006/007.

### Tests

- [x] T030 [P] [US3] Create `apps/web/src/features/admin/components/auth/admin-login-screen.test.tsx` covering admin-only request, matching current authority before navigation, generic credential denial, pending/rate-limit/unavailable states, shared recovery link, real header identity and current-session logout without hard-coded actor/token retention (depends on T024; independent of T031).
- [x] T031 [P] [US3] Extend `apps/web/src/components/auth/routes.test.tsx` and `apps/web/src/components/auth/route-state.test.ts` for exact public admin login/acceptance allowlisting, unknown admin paths still guarded, no dashboard shell before ADMIN permission and generic action/recovery reachability for unrelated signed-in accounts or unavailable session discovery (depends on T024; independent of T030; no concurrent US1 edits).

### Implementation and verification

- [x] T032 [US3] Create `apps/web/src/features/admin/components/common/admin-route-boundary.tsx` and update `apps/web/src/app/admin/layout.tsx` to preserve metadata/CSS/RTL wrapper and guard every path before AdminShell except the exact C1 login/acceptance paths. Update `apps/web/src/app/auth/layout.tsx`, `apps/web/src/app/auth/login/page.tsx` and `apps/web/src/app/auth/register/page.tsx` so guest-only applies only to login/register, leaving shared verification/recovery reachable. Move no dashboard files/URLs and run T031 (depends on T030, T031).
- [x] T033 [US3] Create thin `apps/web/src/app/admin/auth/login/page.tsx` and existing-style `apps/web/src/features/admin/components/auth/admin-login-screen.tsx` using shared admin-only login/current authority and recovery. Wire `apps/web/src/features/admin/components/common/admin-topbar.tsx` to current identity plus C1 logout, retaining existing employee-preview links with USER guards; preserve token/cookie/uncertainty handling from T013 and run T030 (depends on T032).
- [x] T034 [US3] Extend US3 cases in `apps/web/e2e/identity-and-admin-access.spec.ts` for dedicated entry, two admin identities, direct load/reload/logout, wrong-role/inactive denial, later deactivation/non-revival, exact public-boundary behavior and nonimpersonating preview navigation; no later dashboard domain integration (depends on T033).
- [x] T035 [US3] Review/run US3 entry/layout/header/logout tests and filtered `apps/web/e2e/identity-and-admin-access.spec.ts` cases; record accepted slice and the separate US4 recovery dependency in `specs/003-auth-account-frontend/quickstart.md`, without claiming all US3 acceptance until T043 passes (depends on T034).

## Phase 6: US4 - Password Recovery, Change and Session Isolation (Priority: P1)

**Goal**: Complete both-role recovery and employee password change, including device/tab/session teardown and uncertain outcomes.

**Independent test**: Controlled recovery/reset for both roles, employee password dialog, two independent device contexts and same-origin tabs; ordinary logout ends one session, reset/change/account-wide revocation end prior target sessions; delayed A reads/refreshes/commands cannot enter B. Unknown responses remain visibly uncertain without automatic replay, and sentinel secrets disappear after settlement/teardown. Trace: FR-003/006/009-FR-011/015-FR-023/032-FR-035, SC-001/003/004/006/007.

### Tests

- [x] T036 [P] [US4] Extend `apps/web/src/services/api/api-client.test.ts`, `apps/web/src/services/api/session-runtime.test.ts`, `apps/web/src/features/auth/hooks/auth.hooks.test.tsx` and `apps/web/src/features/auth/hooks/credential-commands.hooks.test.tsx` with complete reset/change/logout response-loss, unrelated-account reset, A-to-B late command/navigation, shared-tab lock/invalidation and authority-reconciliation cases; assert no blind replay or success inferred merely from session/token denial (depends on T035, T029; independent of T037).
- [x] T037 [P] [US4] Extend US4 cases in `apps/web/src/features/employee/components/auth/employee-auth.integration.test.tsx` and create `apps/web/src/features/employee/components/account/change-password-modal.test.tsx` for neutral both-role recovery, missing/expired/reset-after-preview, wrong-current/unchanged/mismatched/new-password boundaries, retained correctable input versus cleaned settled secrets, close/remount duplicate guards and keyboard/pending/error/uncertainty behavior; exercise generic forgot/reset components (depends on T035, T029; independent of T036).

### Implementation and verification

- [x] T038 [US4] Wire `apps/web/src/features/employee/components/auth/forgot-password-screen.tsx`, `apps/web/src/features/employee/components/auth/reset-password-screen.tsx`, `apps/web/src/features/auth/components/forgot-password-form.tsx` and `apps/web/src/features/auth/components/reset-password-form.tsx` to neutral requests and transient preview/explicit reset. Remove simulated links/display-state success/timers, use approved role-neutral shared feedback/sign-in destinations and no unsupported numeric lifetime/mailbox claim; authoritative reset success alone permits fresh sign-in guidance, and missing/invalid/uncertain outcomes remain recoverable (depends on T036, T037).
- [x] T039 [US4] Wire `apps/web/src/features/employee/components/account/change-password-modal.tsx` to shared current/new/confirmation rules and committed password change with account-wide teardown/fresh sign-in; replace local/preview-success copy under C2. Correct only required focus containment/background blocking/unique IDs/restoration in existing `apps/web/src/features/employee/components/common/confirmation-sheet.tsx`, with behavior tests in T037's modal test; maintain pending guards across dismissal/remount and no visual redesign (depends on T038).
- [x] T040 [US4] Extend real US4 password/recovery/logout cases in `apps/web/e2e/auth-account.spec.ts` for two roles/devices, unrelated signed-in account on a shared reset route, no preview consumption, expiry-after-preview, explicit commit and all prior target-session invalidation; use private disposable expiry control, not sleeps/live mail (depends on T039).
- [x] T041 [US4] Extend real race/isolation cases in `apps/web/e2e/identity-and-admin-access.spec.ts` for independent device contexts versus same-origin tabs, ordinary logout isolation, reset/change/account-wide revocation, delayed actual A reads/refresh/cookie commands before B and back/reload nonredisclosure. Exercise holder reload/close during delayed real cookie-writing requests, surviving-tab lock reacquisition and new-tab/reload barrier persistence: no replacement login/refresh/protected reads or marker removal from `/users/me`, timeout or another owner. Cover live-owner terminal release, unsupported/malformed storage, record secrecy and explicit fresh isolated-context sign-in recovery without abandoned-success/revocation claims; split independent cases into T016's isolated scenarios while keeping related race steps together (depends on T040; single owner of shared E2E files).
- [x] T042 [US4] Add credential privacy checks to `apps/web/e2e/auth-account.spec.ts`/`apps/web/e2e/ui-preservation.spec.ts` for cleaned history, no-referrer headers/incidental referrers, browser storage/messages/return paths and sanitized retained artifacts; inspect Query/Mutation caches and safe errors in the T036 hook tests. After flow settlement/teardown sentinel credentials must be absent; legitimate credential HTTP transport is expected, and automatic raw diagnostics stay disabled (depends on T041, T017).
- [x] T043 [US4] Apply code/security/React/test review and run US4 focused tests plus US1/US3 shared access/recovery/browser regressions from `apps/web/e2e/auth-account.spec.ts` and `apps/web/e2e/identity-and-admin-access.spec.ts`; record real device/tab/uncertainty/privacy evidence and remaining unavailable checks in `specs/003-auth-account-frontend/quickstart.md`. US3 shared recovery is accepted only with these results (depends on T042).

## Phase 7: US5 - Authoritative Account Basics (Priority: P2)

**Goal**: Display only the current employee's read-only identity and connect password/logout while preserving unavailable later-domain regions.

**Independent test**: Open/reload account as A then B, verify server name/email and real password/logout; unavailable/denied identity has no fixture fallback, while subscription/balance/address remain visibly unavailable with unsupported actions disabled. Trace: FR-005/006/017-FR-025/033-FR-035, SC-001/004/006/007/008.

### Tests

- [x] T044 [US5] Create `apps/web/src/features/employee/components/account/account-screen.test.tsx` for current A/B read-only identity, pending/unavailable/denied states, password/logout integration and preserved Arabic unavailable financial/subscription/address regions; assert no fixture/zero/Free/empty-address default, copy of unknown address, unsupported action or new profile editor (depends on T043).

### Implementation and verification

- [x] T045 [US5] Wire `apps/web/src/features/employee/components/account/account-screen.tsx` to current validated employee identity and T039 password/T013 logout lifecycle; remove its fixture authority and navigation-only logout. Preserve sections/ordinary navigation; render C3 unavailable values and disable unsupported subscription/balance/destination actions, including address copy/change, without financial queries/mutations or provider removal; run T044 (depends on T044).
- [x] T046 [US5] Extend US5 persisted identity/unavailable-region/reload/account-switch cases in `apps/web/e2e/auth-account.spec.ts`; reuse US4 password/logout evidence rather than duplicating entire journeys and assert no financial endpoint/effect is introduced (depends on T045).
- [x] T047 [US5] Review/run account/modal/identity and filtered `apps/web/e2e/auth-account.spec.ts` checks; verify approved narrow account rendering and record actual test-file/absence-of-financial-action evidence in `specs/003-auth-account-frontend/quickstart.md` (depends on T046).

## Phase 8: US6 - Administrator List and Invitation Controls (Priority: P2)

**Goal**: Read bounded authoritative accounts/invitations and issue/read/reissue/revoke/accept/change status with genuine reasons, confirmation and versions.

**Independent test**: Real paged lists, issue pending invitation, inspect distinct delivery/disposition, validate then explicitly accept without a session, sign in separately, deactivate/restore eligible target; exercise collision/replaced/revoked/expired/issuer-denied credentials, stale/cooldown/self/last-admin/pending-target/revoked-actor/unknown-response cases without invented success. Unsupported editing/global filtering/activity/status counts remain disabled/unavailable. Trace: FR-009/010/012/013/019-FR-023/026-FR-035, SC-003/005/006/007/008.

### Tests

- [x] T048 [P] [US6] Create `apps/web/src/features/admin/api/admins.api.test.ts` for all eight existing admin/invitation methods in `specs/003-auth-account-frontend/contracts/http.md`, strict DTO/status/metadata agreement, bounded page/limit/signals, real reason/confirmation/expectedVersion payloads, safe malformed/private denial and no unsupported search/edit request (depends on T047; independent of T049).
- [x] T049 [P] [US6] Create `apps/web/src/features/admin/components/settings/admins-list-screen.test.tsx` and `apps/web/src/features/admin/components/auth/accept-invitation-screen.test.tsx`, and extend `apps/web/src/features/admin/components/common/admin-confirm-dialog.test.tsx` for paged/empty/unavailable/denied views, distinct invitation/delivery states, genuine reason/confirmation, explicit acceptance without auto-login, disabled unsupported controls, pending/focus/dismissal and stale/uncertain feedback without fixtures (depends on T047; independent of T048).

### Implementation and verification

- [x] T050 [US6] Create `apps/web/src/features/admin/api/admins.api.ts` using current shared request/response schemas and central safe transport for list/detail/status and invitation list/detail/issue/reissue/revoke; propagate read signals, require current-scope parsing and matching pagination metadata, and add no profile/search/filter capability or response default. Run T048 (depends on T048).
- [x] T051 [US6] Create `apps/web/src/features/admin/hooks/admins.hooks.test.tsx` using real QueryClients for separate account/epoch/page-scoped lists/details, target/version-scoped guards across close/remount, authority denial/late completion, conflict/refetch with unrelated dirty input retained and uncertain issuance without ID remaining unresolved when bounded reads cannot prove it (depends on T050).
- [x] T052 [US6] Create `apps/web/src/features/admin/hooks/admins.hooks.ts` for independently bounded admin/invitation queries and safe reasoned/versioned unretried commands; reconcile only affected same-account scopes from validated result/detail/refetch and retire revoked authority. No optimistic ADMIN/status creation, unbounded page collection, fabricated attribution or automatic uncertain replay; run T051 (depends on T051).
- [x] T053 [US6] Adapt `apps/web/src/features/admin/components/settings/add-admin-dialog.tsx` to name/email invitation intent with entered reason and genuine reviewed confirmation via the existing `apps/web/src/features/admin/components/common/admin-confirm-dialog.tsx`; disable unsupported name/email editing in existing `apps/web/src/features/admin/components/settings/edit-admin-dialog.tsx`. Preserve the existing visual surfaces, show pending invitation rather than active account and retain recoverable safe input on denied/uncertain results (depends on T049, T052).
- [x] T054 [US6] Wire `apps/web/src/features/admin/components/settings/admins-list-screen.tsx` to real bounded admin/invitation queries, C3 invitation section/read controls and independent existing `apps/web/src/features/admin/components/common/admin-pagination.tsx` instances; use only server pagination for totals, settle same-scope out-of-range recovery, disable global search/status filters and show activity/status aggregates unavailable. Preserve empty versus failed/denied and distinct disposition/delivery without fixture/page-only global substitutes (depends on T053).
- [x] T055 [US6] Wire confirmed status/reissue/revoke handlers in `apps/web/src/features/admin/components/settings/admins-list-screen.tsx` using existing `apps/web/src/features/admin/components/common/admin-confirm-dialog.tsx` entered reason/current validated detail version; block pending/obsolete handlers and reconcile stale/self/last-admin/pending-target/cooldown/actor-denied/unknown outcomes without attributing another actor's state. Make only demonstrated shared confirmation behavior corrections with T049 coverage; preserve unrelated dirty safe drafts (depends on T054).
- [x] T056 [US6] Create thin `apps/web/src/app/admin/auth/accept-invitation/page.tsx` and existing-style `apps/web/src/features/admin/components/auth/accept-invitation-screen.tsx` using transient nonconsuming preview and explicit matching 15-128-character password acceptance through existing auth adapters; retain C1 public boundary/Suspense as required, clean history/input and require separate admin sign-in after validated commitment. Invalid/purpose/replay/revoked/replaced/expired/issuer-denied/uncertain credentials grant no session/success; run T049 (depends on T055, T013, T032).
- [x] T057 [US6] Extend US6 successful browser journeys in `apps/web/e2e/auth-account.spec.ts` with private test fixtures exceeding one list page, real pagination/totals, confirmed reasoned issue/read, distinct delivery/disposition, explicit acceptance/separate sign-in and eligible deactivation/restoration; verify actual persisted admin/invitation/audit state and no old-session revival (depends on T056).
- [x] T058 [US6] Extend US6 failure/reconciliation cases in `apps/web/e2e/auth-account.spec.ts` and authority cases in `apps/web/e2e/identity-and-admin-access.spec.ts` for email collisions, replay/replacement/revocation/expiry/issuer loss, rejected/unknown/not-attempted delivery, stale/cooldown/self/last-admin/pending-target/actor-revoked commands, concurrent target changes and lost results with/without IDs. Use controlled real-service boundaries/P02 backend race evidence; bounded-list absence cannot prove failed issuance or permit blind retry (depends on T057).
- [x] T059 [US6] Apply production/security/React/test review and run admin adapter/hook/component/confirmation plus filtered US6 browser tests in `apps/web/e2e/auth-account.spec.ts`/`apps/web/e2e/identity-and-admin-access.spec.ts`; verify truthful unsupported controls and record fresh persistence/delivery/version/authority/UI outcomes in `specs/003-auth-account-frontend/quickstart.md` (depends on T058).

## Phase 9: Cross-Story Acceptance and Handoff

**Purpose**: Close demonstrated P03 gaps, reviews and actual evidence. No broad refactoring or extra roadmap checkpoint.

- [x] T060 Audit FR-001-FR-035/SC-001-SC-008 against actual contract/adapter/hook/component tests and `apps/web/e2e/identity-and-admin-access.spec.ts`, `apps/web/e2e/auth-account.spec.ts`, `apps/web/e2e/ui-preservation.spec.ts`; add only genuinely missing in-scope cases, preserving meaningful regressions and unchanged P02 exact-boundary/concurrency evidence. Cover missing/malformed/oversized credentials, races, correctable/uncertain results and no unauthorized private reads. In `auth-account.spec.ts` prove unchanged-limit real 429 within one isolated scenario and first eligible request success in a following new-process scenario; repeat those focused scenarios in another order, never resetting within the abuse case. Run each added case before recording acceptance (depends on T024, T029, T035, T043, T047, T059).
- [x] T061 Complete/run `apps/web/e2e/ui-preservation.spec.ts` against the approved existing route/component peers for all five employee auth routes, account, shared verification/forgot/reset, admin login/acceptance, header and admin management: normal phone/desktop plus focused 320px and representative 390/430px, long mixed-direction identity, RTL/Cairo/light, overflow/clipped/hidden actions, labels/alerts, keyboard/focus containment/restoration and pending dismissal. Verify credential headers/referrers and safe diagnostics; fail unexpected console errors/privileged reads. Save only cleaned/masked explicit evidence under `output/playwright/p03/`, trace exceptions to C1-C3 and fix only approved in-scope defects (depends on T060).
- [x] T062 Review affected production paths `apps/web/src/services/api/`, `shared/query/`, `shared/forms/`, `components/auth/`, `features/auth/`, `features/users/`, `features/employee/components/auth/`, `features/employee/components/account/`, `features/admin/api/`, `features/admin/hooks/`, `features/admin/components/auth/`, `features/admin/components/settings/`, `features/admin/components/common/`, `apps/web/src/app/`, `apps/web/next.config.ts` and `packages/contracts/src/auth/` against their engineering owners with clean-code-guard/security-best-practices/vercel-react-best-practices; apply test-guard to changed colocated/E2E/support tests. Fix evidenced in-scope findings with focused regressions; verify no credential leak, unsafe cast/check weakening, second auth stack or unauthorized presentation/financial scope (depends on T061).
- [x] T063 Run manifest-backed owning checks below, full web suite, affected shared contract/auth/transport/guard regressions, relevant actual P02 producer integration files, both support type checks, explicit complete Playwright acceptance and build/output checks from `apps/web/package.json`, `apps/api/package.json`, `packages/contracts/package.json` and `package.json`; use migrated disposable PostgreSQL/controlled email/installed Chromium. Record fresh/cached/reused/unrun results and actual missing services/resources in `specs/003-auth-account-frontend/quickstart.md`; no mocked browser/database or unavailable check can pass the gate (depends on T062).
- [x] T064 Update `specs/003-auth-account-frontend/quickstart.md` with final implemented paths/scripts, six-story/FR/SC acceptance evidence, exact executed commands/results, UI exceptions/preservation and code/security/React/test/docs review; review it and changed feature contracts with docs-guard against actual final source/config. Keep production company mail/destinations/HTTPS/proxy/diagnostics and one-admin/no-2FA/host risk as launch gates; do not describe test acknowledgement as mailbox receipt or local acceptance as deployment approval (depends on T063).
- [x] T065 Verify the final scoped diff and checklist/task state in `specs/003-auth-account-frontend/tasks.md`, `.specify/feature.json` and `specs/003-auth-account-frontend/checklists/` against `specs/003-auth-account-frontend/plan.md`: preserve pointer/approval artifacts/unrelated work/applied migrations, justify only the planned Playwright lockfile addition and C1-C3 changes, and check owned formatting/`git diff --check`. Mark only implemented and verified selected tasks, report batch versus whole P03 gates via `specs/003-auth-account-frontend/quickstart.md`, and stop without another workflow stage/phase/commit/push/deployment (depends on T064).

## Dependencies and execution order

```text
T001 -> T002
T003 -> T004
T005 -> T007; T006 + T007 -> T008 -> T009 -> T010 -> T011 -> T012 -> T013
T014 || T015 -> T016; T017 is independently scoped
T003-T017 -> T018 (shared boundary acceptance)
T019 || T020 -> T021 -> T022 -> T023 -> T024 (US1)
T025 -> T026 -> T027 -> T028 -> T029 (US2)
T030 || T031 -> T032 -> T033 -> T034 -> T035 (US3 entry)
T029 + T035 -> T036 || T037 -> T038 -> T039 -> T040 -> T041 -> T042 -> T043 (US4; US3 recovery)
T043 -> T044 -> T045 -> T046 -> T047 (US5)
T048 || T049; T048 -> T050 -> T051 -> T052
T049 + T052 -> T053 -> T054 -> T055 -> T056 -> T057 -> T058 -> T059 (US6)
All story checks -> T060 -> T061 -> T062 -> T063 -> T064 -> T065
```

Every edge also requires prerequisites stated on its task. `||` permits independent authoring/ownership, not running tests against incomplete implementations and claiming passes.

| Story | Required preceding slice                  | Acceptance boundary                                                   |
| ----- | ----------------------------------------- | --------------------------------------------------------------------- |
| US1   | T001-T018                                 | Employee entry/guards/role navigation; shared race evidence also T043 |
| US2   | T024; shared transient links              | Pending registration/explicit activation; no financial entitlement    |
| US3   | T024; entry T030-T035                     | Dedicated entry/header/logout; full shared recovery requires T043     |
| US4   | T029/T035 and shared lifecycle            | Both-role recovery/password/device/tab/uncertainty/privacy            |
| US5   | T043                                      | Current read-only account basics with C3 unavailable regions          |
| US6   | T047 and shared public/lifecycle boundary | Bounded management plus explicit acceptance and current authority     |

US2 and the US3 entry tests can be scheduled from T024 with independent owners, but their shared auth/access production owners must remain sequential. Default delivery follows the numbered order. US4 depends on US3 entry, not on completion of US3 recovery, so this is not a dependency cycle. Shared component/E2E files are extended sequentially throughout the stories.

### Parallel examples per story

| Story | Safe opportunity after prerequisites                                              | Files requiring one owner                                               |
| ----- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| US1   | T019 guard/navigation test authoring alongside T020 employee-login test authoring | Guard/navigation files within T019; employee-auth test belongs to T020  |
| US2   | No independent pair inside this story; T025 may accompany US3 T030 after T024     | T025-T027 employee/verification owners; T028 auth-account browser suite |
| US3   | T030 login/header tests alongside T031 layout/guard tests                         | T032-T033 layout/entry production work remains sequential               |
| US4   | T036 runtime/hook tests alongside T037 recovery/modal interaction tests           | T040-T042 shared browser suites remain sequential                       |
| US5   | No independent pair inside this story; execute T044-T047 sequentially after T043  | Account wiring and auth-account browser file remain sequential          |
| US6   | T048 admin adapter tests alongside T049 management/acceptance/confirmation tests  | T053-T055 management screen/confirmation work; T057-T058 browser suites |

Foundational independent pairs are T005/T006 and T014/T015. T017 configuration work is disjoint but unmarked to keep the default batch conservative. Never edit package lockfiles, shared source/tests or the same browser file concurrently.

### Suggested dependency-safe batches

| Batch                | Exact IDs | Observable result                                                     |
| -------------------- | --------- | --------------------------------------------------------------------- |
| First                | T001-T002 | Effective gates, baseline and infrastructure status; no screen wiring |
| Contracts            | T003-T004 | Current small replies have strict shared runtime schemas/tests        |
| Transport            | T005-T009 | Safe errors, one refresh and tested generation/cookie sequencing      |
| Adapters/lifecycle   | T010-T013 | Parsed DTOs and transient/scoped credential/session hooks             |
| Browser support      | T014-T018 | Explicit isolated harness/support typing and shared acceptance        |
| Employee entry MVP   | T019-T024 | Real sign-in/direct-load/reload/access slice                          |
| Registration         | T025-T029 | Pending registration and explicit verification                        |
| Admin entry          | T030-T035 | Dedicated protected entry/header/logout slice                         |
| Recovery/isolation   | T036-T043 | Shared recovery/password/device/tab/privacy acceptance                |
| Account basics       | T044-T047 | Authoritative identity and unavailable later-domain values            |
| Admin boundary/hooks | T048-T052 | Parsed bounded admin DTOs and safe lifecycle queries/commands         |
| Admin controls       | T053-T059 | Real reasoned/versioned invitation/status/acceptance journeys         |
| Whole P03 acceptance | T060-T065 | Complete reviews/regressions/browser evidence and truthful handoff    |

Within a selected range, honor each edge; a range containing a dependency does not mean every item may run at once. Any missing prerequisite is reported without implementing another roadmap phase.

## Verification commands and services

Run from repository root. Existing commands were verified in manifests during TASKS; proposed scripts/files below become executable only after their owning tasks. This list is future verification, not a claim that commands ran now.

Existing focused baseline/batch examples:

```sh
pnpm --filter @template/contracts test src/auth/auth.schema.test.ts src/identity/identity.schema.test.ts src/admin/admin.schema.test.ts src/http/http.schema.test.ts
pnpm --filter @template/web test src/services/api/api-client.test.ts src/shared/query/query-client.test.ts src/features/auth/hooks/auth.hooks.test.tsx src/features/users/hooks/users.hooks.test.tsx src/components/auth/routes.test.tsx src/components/auth/route-state.test.ts src/features/auth/utils/safe-return-path.test.ts
```

Append the task's new/changed package-relative test paths to its existing package `test` command. Web `.integration.test.tsx` files remain in the existing jsdom Vitest discovery; browser `.spec.ts` files are discovered only by T015's explicit Playwright configuration. Unit/component checks need current dependency outputs, not live email or Docker. Build contracts/database once when required by the existing runtime/export setup, using their existing `build` scripts; never use a developer database to fill a missing test prerequisite.

Final P03 owning checks:

```sh
pnpm --filter @template/contracts test
pnpm --filter @template/contracts lint
pnpm --filter @template/contracts check-types
pnpm --filter @template/web test
pnpm --filter @template/web lint
pnpm --filter @template/web check-types
pnpm --filter @template/api lint
pnpm --filter @template/api check-types
pnpm --filter @template/api test:integration src/modules/auth/oscar-auth.integration.test.ts src/modules/auth/session-revocation.integration.test.ts src/modules/admins/admin-invites.integration.test.ts src/app.integration.test.ts
pnpm build
pnpm verify:build-output
git diff --check
```

Producer regressions above verify compatibility with changed shared response consumers; production API changes are not assumed. For an evidenced authorized backend integration correction, also run its owning unit/integration files and affected shared regressions. Reuse unchanged predecessor exact-expiry/replay/concurrency evidence honestly, naming any fresh reruns separately.

New scripts registered by T014-T015, then required explicitly:

```sh
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web test:e2e
```

After registration a selected browser file can be run as `pnpm --filter @template/web test:e2e e2e/identity-and-admin-access.spec.ts`; implement static `US1` through `US6` scenario identifiers so story checks can use the registered runner's `--grep USn` without leaking credentials in test titles. The final run covers all three suites. Verify discovery/type coverage rather than relying on existing production tsconfigs/Turbo to include support/E2E work.

Real browser acceptance requires Docker/image access for disposable `postgres:18.4`, actual deployed migrations/API/Next production build, installed Chromium, controlled email/network outcomes, free loopback ports 3103/4103 and build resources. No Redis/TRON/testnet/funding is needed for P03. Missing Docker/browser/services prevents real acceptance; component doubles/historical screenshots cannot replace it. Fail on inherited database/occupied ports/live mail configuration and clean only harness-owned resources. Capture no secrets in reporters/stdout/network/HAR/storage snapshots; explicit screenshots follow URL cleanup and control masking.

Use installed Prettier on owned changed files only. P03 is not a full-roadmap regression checkpoint; P05/P09/P12/P14/P15 and release retain that requirement. Do not run root `pnpm verify` merely as task/documentation validation: it includes schema-writing `db:format` and broader suites.

## Requirement coverage and completion

| Requirement group | Owning tasks                                                | Evidence                                                                                                                              |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001/033-FR-035 | T001-T002, T014-T018, all story validations, T060-T065      | Scope/checklist/analysis gates, actual tests/reviews, real isolated browser and preserved C1-C3 rendering                             |
| FR-002-FR-006/018 | T009-T013, T019-T024, T031-T035, T036/T041/T043             | Parsed sign-in, safe role paths, current authority, blocked mounting/reads and non-revival                                            |
| FR-003/007-FR-011 | T003-T004/T010-T013, T025-T029, T037-T043, T056-T058        | Shared input semantics, fixed sponsor/pending identity, explicit single-use link actions and neutral resend                           |
| FR-012-FR-015     | T030-T035, T038/T040/T043, T056/T058                        | Admin-only entry, exact public boundaries, real identity/nonimpersonating preview and shared recovery                                 |
| FR-016-FR-019     | T006/T008-T013, T033, T036-T043, T045-T047                  | Ordinary/account-wide teardown, uncertain cookie ordering, private scope and transient credential cleanup                             |
| FR-020-FR-023     | T003-T013, T019-T020, T025/T030/T036-T037, T048-T059        | Strict unknown-response parsing, safe errors/CSRF/rate limits, pending guards and no uncertain replay                                 |
| FR-024-FR-025     | T044-T047, T060-T061                                        | Current read-only identity and unavailable preserved financial/destination regions                                                    |
| FR-026-FR-031     | T048-T059                                                   | Bounded lists/totals, reasons/confirmation/versions, invitation disposition/delivery/acceptance and disabled unsupported capabilities |
| FR-032            | T006/T012-T013/T036, T051-T055/T058                         | Scope/epoch/version reconciliation and preserved unrelated dirty safe input                                                           |
| SC-001-SC-008     | T023-T024/T028-T029/T034-T035/T040-T043/T046-T047/T057-T065 | Six journeys plus integrated UI/privacy/authority evidence; pending results are never passes                                          |

## Implementation strategy

1. After a separately selected ANALYZE and authorized requirements preflight, start with **T001-T002**. Preserve existing artifacts/approvals and resolve required owning-artifact findings before application work.
2. Deliver the shared foundation and **US1 T019-T024** as the suggested MVP slice. It establishes real employee sign-in/protected access and includes the required harness; it is not whole P03 or release readiness. US4 later supplies complete multi-device/uncertainty acceptance.
3. Add US2, US3 entry, US4, US5 and US6 in the dependency order above. Validate each declared boundary without redesigning screens or starting later financial/admin domains. US3 recovery closes with US4 rather than being claimed early.
4. Complete T060-T065 before claiming the P03 implementation gate. Record exact changed test files, fresh/cached/reused/unrun commands, six-story acceptance and missing services in the existing quickstart; keep one concise handoff rather than creating duplicate reports.
5. Stop at the owner's selected implementation batch. Separate CONVERGE is omitted by the recorded owner decision; do not automatically start another workflow stage, P04, deployment or real-money operation.

## Generation validation

Generated 65 sequential unchecked tasks: 2 prerequisite, 16 foundational, US1 6, US2 5, US3 6, US4 8, US5 4, US6 12 and 6 final acceptance/handoff tasks. Twelve tasks carry `[P]` in six independent pairs: T005/T006, T014/T015, T019/T020, T030/T031, T036/T037 and T048/T049. Every task has a checkbox, unique ID, story label exactly in its story group and concrete repository-relative paths. Test creation/extension is planned only; no test files were changed by this command.

`.specify/extensions.yml` is absent; pre/post task hooks are skipped. This artifact is ready for the selected ANALYZE, not approval to execute its tasks. Checklist review, analysis findings, implementation/review/test/browser results and external launch gates remain distinct.

## IMPLEMENT Phase 1 Execution Evidence - 2026-10-03

Completed selected **T001-T002 only**. The owner-authorized checklist preflight reviewed custom auth-account 38/38 and reused/reassessed built-in requirements 16/16; zero incomplete. Approval markers became read-only after that review. P03 selection, resolved C1-C3, constitution 1.0.0 and recorded P01/P02 backend acceptance pass the selected gate. No saved analysis report was found; recorded U1/U2 corrections were inspected and no unresolved mandatory predecessor/artifact blocker identified. The pointer and all T003-T065 task lines are preserved.

[Phase 1 quickstart evidence](quickstart.md#phase-1-execution-evidence---2026-10-03) records the exact manifest-backed baseline commands: **29 contract tests / 4 files and 81 web tests / 7 files passed fresh**. Node 24.18.1/pnpm 11.17.0 and existing dependency outputs are available. Docker 29.1.3 responds, postgres:18.4 is local, ports 3103/4103 have no observed listeners and RAM/disk observations are recorded; no container/migration/server/build execution is claimed. Required project Playwright/Chromium/harness is absent and remains an acceptance gate for later tasks. No baseline failures, production/test edits, browser installation or UI changes occurred.

Existing actual-artifact ignores suffice. docs-guard checked the changed technical notes against current manifests/config/source and observed command results. Before/after hooks are absent. **Batch complete; P03 incomplete: T003-T065 remain unchecked.** No other workflow stage, roadmap phase, live mail, funds, deployment, commit or push ran.

## IMPLEMENT Phase 9 Execution Evidence - 2026-10-04

Completed selected **T060-T065**. The requirement audit added unchanged-limit/process-isolation and invalid-link cases, and corrected two transient registration-status assertions to verify committed 201 responses and settled verification navigation. All persisted identity/sponsor/credential assertions remain. Cross-story UI checks cover 320/390/430/1280, long mixed Arabic/English identities, privacy and keyboard/pending behavior; the evidenced shared confirmation focus defect was fixed without presentation changes.

[Final quickstart handoff](quickstart.md#phase-9-cross-story-acceptance-and-handoff---2026-10-04) records fresh **139 contract tests / 7 files, 280 web tests / 37 files, 108 actual producer integration tests / 4 files and 48 complete browser scenarios** passed, plus owning lint/types, both support type projects and uncached root build/output checks. Failed/interrupted attempts are distinguished from final passes. Applied reviews found no unresolved in-scope finding after corrections.

The pointer, approved checklists, all T001-T059 task lines, migrations and unrelated work were preserved. A concurrent roadmap regrouping preserves P01-P03; later work uses its current IDs, without rewriting this feature's historical evidence. Owned formatting/global diff checks and post-run listener cleanup passed. Extension hooks are absent. **Batch complete; whole P03 local implementation acceptance complete: 65/65 tasks.** Production company mail/destinations/HTTPS/proxy/diagnostics, independent launch review and approved single-admin/no-2FA/host risks remain launch gates. Stop without another workflow stage, roadmap phase, deployment, funds, commit or push.
