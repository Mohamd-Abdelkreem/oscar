# Implementation Plan: P03 - Authentication and Account Frontend

**Branch**: `002-identity-admin-backend` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P03 - Authentication and Account Frontend

**Feature Directory**: `specs/003-auth-account-frontend`

**Status**: Research/design complete; implementation and acceptance have not run.

**Input**: Clarified P03 spec and subsequent owner instruction: “ignore converge for p02 we will not make converge in following phases”. Apply this removal of the separate CONVERGE stage to P02 and later phases. Backend acceptance, implementation review, automated tests, financial controls and release gates remain mandatory. The 2026-10-03 targeted PLAN amendment resolves U1/U2; the accompanying authorized specification/checklist corrections and task refinements belong to their respective workflows. Governance, predecessor artifacts, feature selection and approval/task markers are preserved.

Setup returned `BRANCH=003-auth-account-frontend`: installed `common.sh` uses the feature directory basename when no `SPECIFY_FEATURE` is set. This is the tool's feature identifier, not a Git checkout. The actual Git branch above was checked separately; no branch change is required.

## Summary

Wire five existing employee auth routes, account identity/password/logout, admin identity/logout and admin list/invitation/lifecycle controls to tested P02 services. Add only C1's authorized `/admin/auth/login` and `/admin/auth/accept-invitation` pages. Reuse shared contracts, Axios, QueryClient, forms and approved visual components; add strict response parsing, current role/session gates, transient credential ownership and truthful uncertainty.

Spec C1-C3 authorize bounded public-layout, authentication copy/control, invitation and unavailable-data adaptations. All other URLs, route placement, rendering, static copy, Cairo/RTL/light styling and navigation remain frozen. Account financial/subscription/address regions stay visible with approved Arabic unavailable values and disabled unsupported actions. Global fixture providers remain until later-phase consumers migrate.

Excluded from PLAN: P01/P02 reimplementation, new identity/profile/admin search APIs, first-admin bootstrap, financial/domain/dashboard/policy integration, public admin signup, 2FA/dual approval, live email, production credentials, deployment, real funds and task generation. The owner's combined amendment request separately selects narrative/task correction and read-only ANALYZE; it authorizes no application implementation.

## Technical Context

**Language/Version**: TypeScript 5.9.3. Root constraints Node `>=24 <25`, pnpm `>=11 <12`; fresh CLI checks returned Node 24.18.1/pnpm 11.17.0. Preserve Next 16.2.12, React 19.2.8, Express 5.2.1 and Prisma 7.9.1.

**Primary Dependencies**: Existing Query 5.101.4, Axios 1.19.0, React Hook Form 7.84.0, resolvers 5.7.1, Zod 4.4.3, Tailwind 4.3.3 and UI primitives. Only proposed addition: exact web dev dependency `@playwright/test@1.63.0`, required by FR-034; compatibility evidence is in [research.md](research.md#r7---browser-harness-and-private-evidence). Native Web Locks/BroadcastChannel coordinate same-origin tabs without token storage or another auth library. Vitest remains the existing test runner for current layers.

**Storage**: Existing PostgreSQL identity/sessions/invitations remain authoritative. No P03 model, migration, queue, worker, signer or financial service. Browser tokens/action credentials are transient memory; private DTO caches are scoped and cleared on teardown. A single bounded nonsecret localStorage cookie-write barrier survives page reload/close; it stores only schema version, opaque operation ID and pending/uncertain state, never identity or credentials. It can block work but cannot grant authority. See [data-model.md](data-model.md).

**Testing**: Existing Vitest 4.1.10/jsdom/Testing Library 16.3.2, shared contracts and API Supertest/real PostgreSQL integration. Add explicit Playwright Chromium coverage with real Next production build/start, real test API, migrated disposable PostgreSQL 18.4 and controlled email. Each independent test scenario owns a new API process/database and fresh browser contexts; module-level MemoryStore limiters therefore start empty without changing production limits. Related concurrency/replay/rate-limit steps share that scenario's process. Docker/image access, installed browser, free ports and build resources were not exercised during PLAN.

**Target Platform**: Existing Next App Router UI and Express API. Browser acceptance targets modern Chromium with Web Locks/BroadcastChannel and readable/writable localStorage on loopback or HTTPS. All coordinated callers use one canonical frontend origin and the same cookie context. Unsupported coordination/storage yields approved unavailable feedback; it must not silently weaken sequencing. Storage deletion/eviction, alternate frontend origins sharing cookies and host compromise are outside this frontend protocol's safety proof; supported topology/storage and production TLS/proxy verification remain launch gates.

**Project Type**: Frontend integration in the existing pnpm/Turborepo monorepo, with small shared response-schema additions and test-only API composition.

**Performance Goals**: Bounded page/limit reads (defaults 1/25, maximum limit 100), one shared refresh and scoped freshness. No unbounded list loading or invented latency/throughput guarantees. Roadmap target of 1000 registered employees/year is not simultaneous-user capacity.

**Constraints**: Current server role/status/session authority; preserved cookie/CSRF/rate limits; no secrets in retained cache identities/errors/diagnostics; no uncertain mutation replay; no protected mount/private reads before a fresh permitted check; no fabricated financial defaults.

**Scale/Scope**: Six P03 journeys and only approved surfaces/exceptions. Interfaces: [HTTP contract](contracts/http.md), [UI/session contract](contracts/ui-session.md). All research unknowns are resolved; no technical clarification remains.

## Constitution Check

Checked before research and after design against constitution 1.0.0, complete roadmap, all eight engineering guides and web AGENTS/CLAUDE instructions. PASS means the design may proceed, not that P03 acceptance ran.

| Principle                  | Before | After | Evidence/application                                                                                                                                                                                                                                              |
| -------------------------- | ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I - Scope/evidence         | PASS   | PASS  | Pointer/spec select P03; existing working-tree changes preserved; current versus proposed work and actual Git branch distinguished.                                                                                                                               |
| II - UI preservation       | PASS   | PASS  | Clarified C1-C3 authorize only bounded changes. Dashboard pages/URLs remain in place; no other presentation exception assumed.                                                                                                                                    |
| III - Ownership/design     | PASS   | PASS  | Existing contracts/transport/hooks reused; focused lifecycle helpers and required browser harness only; no parallel auth or speculative persistence.                                                                                                              |
| IV - Backend prerequisites | PASS   | PASS  | [P02 tasks](../002-identity-admin-backend/tasks.md) record P01 closure, T001-T067 complete and 628 passing real-persistence/backend tests. These are reused results. Latest owner instruction removes separate convergence closure, retaining backend acceptance. |
| V - Financial/custody      | PASS   | PASS  | No financial/custody transition; C3 prevents account fixtures/zero/Free/empty-address values becoming facts. Ledger/calendar/migrations remain unchanged.                                                                                                         |
| VI - Security              | PASS   | PASS  | Current authority, parsed contracts, CSRF, safe navigation, epoch/generation isolation, transient secrets, reasons/confirmation/versioning and uncertainty are designed and assigned tests. Approved one-admin/no-2FA risk retained.                              |
| VII - Verification         | PASS   | PASS  | Concrete future test files, scripts, real-service prerequisites and failure scenarios below; missing P03 execution remains an acceptance gate.                                                                                                                    |

The accompanying specification correction now records P02's P01 closure/backend acceptance and the omitted CONVERGE stage. The built-in requirements checklist notes now agree with its preserved 16/16 checked markers and resolved C1-C3. The custom checklist remains 38/38 unchecked for the authorized IMPLEMENT requirements-review preflight. No implementation approval, fresh backend test pass or governance change follows from these narrative corrections.

## Project Structure

### Documentation (this feature)

```text
specs/003-auth-account-frontend/
  spec.md                     # Clarified input; targeted narrative correction
  checklists/requirements.md  # Corrected notes; existing markers preserved
  checklists/auth-account.md  # Corrected narrative; 38 unchecked questions
  plan.md
  research.md
  data-model.md
  contracts/http.md
  contracts/ui-session.md
  quickstart.md
```

No tasks.md is generated by PLAN. The existing task list receives only the separately authorized U1/U2 refinements, preserving IDs, dependencies and markers.

### Source owners and proposed changes

All paths are repository-relative; proposed files do not exist yet.

| Owner                   | Target paths/responsibility                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts        | `packages/contracts/src/auth/auth.schema.ts`, proposed `auth/auth-response.schema.ts`, `src/index.ts`: retain requests/identity/admin outputs; add strict validity/message/empty data schemas for existing replies.                                                                                                                     |
| Browser transport       | Existing `apps/web/src/services/api/api-client.ts` and `browser-location.ts`, proposed `session-runtime.ts`: one refresh, current epoch/check generation, cookie-write sequencing and removal of reload-based internal redirects. The current memory-token functions live in api-client.ts; preserve one store/export surface.          |
| Query/error policy      | Existing `apps/web/src/shared/query/query-client.ts` and transport: safe errors before cache storage, compatible bounded read retries, no uncertain replay.                                                                                                                                                                             |
| Auth/account hooks      | Existing `apps/web/src/features/auth/api/auth.api.ts`, `hooks/auth.hooks.ts`, proposed `hooks/credential-commands.hooks.ts`; existing `features/users/api/users.api.ts`, `hooks/users.hooks.ts`: parsed P02 DTOs, abortable scoped reads, transient credential flows.                                                                   |
| Access/navigation       | Existing `apps/web/src/components/auth/protected-route.tsx`, `guest-only-route.tsx`, `features/auth/utils/safe-return-path.ts`, `session-navigation.ts`: current authority and safe role-aware App Router navigation. Pure route-state resolvers remain in the existing guard files.                                                    |
| Layouts                 | Existing `apps/web/src/app/employee/(app)/layout.tsx`, `app/admin/layout.tsx`, `app/auth/layout.tsx`, `app/auth/login/page.tsx`, `app/auth/register/page.tsx`: compose guards without moving dashboard/employee routes.                                                                                                                 |
| Employee auth/account   | Existing `apps/web/src/features/employee/components/auth/` five auth screens and `components/account/account-screen.tsx`, `change-password-modal.tsx`: real operations and C2-C3 feedback/unavailable regions.                                                                                                                          |
| Shared recovery         | Existing `apps/web/src/features/auth/components/verify-email-panel.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` and existing generic pages: explicit link actions, role-neutral copy/sign-in destinations.                                                                                                               |
| Admin public entry      | Proposed `apps/web/src/app/admin/auth/login/page.tsx`, `accept-invitation/page.tsx`; proposed `features/admin/components/auth/admin-login-screen.tsx`, `accept-invitation-screen.tsx`, `components/common/admin-route-boundary.tsx`; existing `admin-topbar.tsx`: two public routes, real identity/logout.                              |
| Admin management        | Existing `apps/web/src/features/admin/components/settings/admins-list-screen.tsx`, `add-admin-dialog.tsx`, `edit-admin-dialog.tsx`; proposed `features/admin/api/admins.api.ts`, `hooks/admins.hooks.ts`; existing common confirmation/pagination: paged lists and confirmed/reasoned/versioned commands, disabled unsupported editing. |
| Credential-page privacy | Existing `apps/web/next.config.ts`: scoped no-referrer headers and suppression of credential-route development request logs. Verify actual headers; production ingress diagnostics remain a launch gate.                                                                                                                                |

No production API service change is needed. Verification/reset mail already targets approved shared generic URLs; configure existing `ADMIN_INVITATION_ACCEPT_URL` for C1's acceptance route. Do not change lifetimes or add email URL fallbacks.

### Proposed browser infrastructure

```text
apps/web/playwright.config.ts
apps/web/e2e/tsconfig.json
apps/web/e2e/identity-and-admin-access.spec.ts
apps/web/e2e/auth-account.spec.ts
apps/web/e2e/ui-preservation.spec.ts
apps/web/e2e/support/fixtures.ts
apps/web/e2e/support/start-web.mjs
apps/web/e2e/support/safe-reporter.ts
apps/api/tests/e2e/tsconfig.json
apps/api/tests/e2e/server.ts
apps/api/tests/e2e/control.ts
```

Retain roadmap `apps/web/e2e/` ownership and explicit discovery. Current production tsconfigs do not type-check these paths/configuration; register dedicated support type-check scripts. API tests/ stays excluded from production build. Web manifest/lockfile changes only for the justified dependency and scripts; no root/Turbo change is needed merely to expose the web command.

## Architecture and Delivery Order

1. **Shared boundary before consumers**: missing response schemas; parsed auth/current-user/admin adapters; safe transport errors and compatible retry policy. Malformed success cannot install tokens or become a user/list/default balance.
2. **Lifecycle before protected UI**: consolidate refresh; implement non-secret epoch/check generation, abort/cancel/clear, cookie-write coordination and stale-result suppression; complete focused transport/hooks/guard tests.
3. **Public flows/access**: wire employee login/register/resend/recovery, nonconsuming preview plus explicit confirmation, C1 layout boundaries and safe role navigation. Generic login may return USER or ADMIN; dedicated admin login must return active verified ADMIN.
4. **Account/admin entry**: current read-only employee identity/password/logout and unavailable regions; admin login/invitation acceptance/current identity/logout. No profile editor or financial action.
5. **Admin management**: independently paged admin/invitation queries; issue/read/reissue/revoke/status with entered reasons, actual confirmation and current versions. Reconcile conflicts/unknown results without optimistic authority or invented attribution.
6. **Browser acceptance/review**: real isolated services and targeted faults; cookie/reload/history/tab/privacy/viewport evidence. Harness preparation may occur earlier; acceptance waits for complete integrated consumers. Apply engineering-backed code/security/test/docs reviews before completion.

Transient imperative credential hooks call existing adapters with safe status only; they do not put passwords/tokens in Query options/keys or retained Mutation variables. In-flight guards outlive dialog close/remount. Active recoverable form input may survive a correctable denial; completed request references are released and flow completion/dismissal/authority teardown clears live secrets.

Serialize all cookie-producing/clearing login, refresh, logout, logout-all, reset and change-password through the shared owner and same-origin Web Locks. Under the lock, read/validate the persistent nonsecret barrier, then write/read back its pending operation ID before HTTP dispatch. Only the matching live owner holding the lock may clear it after positively observing its complete terminal HTTP response. UI deadlines do not terminate that observer; abort/network failure/unload cannot clear it. A later tab or reload must block private restoration and further cookie writes when it inherits a barrier, even after lock reacquisition. BroadcastChannel/storage events carry retirement/revalidation hints only. Existing endpoints cannot prove an abandoned response will never apply cookies; keep that context unavailable and use C2 feedback for a wholly separate browser profile/isolated private session, followed by explicit sign-in/current authority validation. No timer, blind retry, cookie-only clearing or storage-reset control repairs it. This fallback does not revoke any server session possibly created by abandoned work. Exact release criteria and topology/storage limits are in [contracts/ui-session.md](contracts/ui-session.md#cookie-write-barrier-and-owner-loss-u1).

The browser fixture is test-scoped for API, disposable database, mail/fault state and browser contexts. Every independent scenario spawns a new API OS process before configuration/limiter modules load and destroys it afterwards; recreating createApp in one process or clearing mail/faults is insufficient. Clear inherited limiter overrides and set child-only `RAILWAY_ENVIRONMENT=p03-e2e` before API config imports: existing env.ts then skips workspace dotenv loading, which could otherwise restore those overrides. Supply all required configuration with test-only child values; this marker uses an existing environment-file bypass and makes no deployment claim. Preserve actual default limits and source-IP keying; never raise limits, forge proxy headers or add a reset endpoint. Prepare the immutable Next build once with the fixed test URL, but start owned Next/API servers per scenario without external server reuse. Keep related race/replay/abuse steps within one scenario and budget legitimate calls against unchanged limits. T014/T016 own this lifecycle; [quickstart](quickstart.md#isolated-harness-lifecycle) defines its validation.

Capture a link credential once into transient browser ownership and clean history without consumption. Do not serialize it into server props, caches, return targets or incidental requests. A clean reload without the credential selects missing-link/recovery state, never recreates it from storage. Explicit action alone may establish success; legitimate token HTTP transport is distinct from diagnostic leakage.

## Test Strategy and Acceptance Gates

Existing tests are extended; proposed tests are created only during authorized implementation. Brace notation denotes proposed/verified sibling names, not literal paths.

| Acceptance area         | Concrete test owners                                                                                                                                                                                                                                            | Required coverage                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared requests/replies | Existing `packages/contracts/src/auth/auth.schema.test.ts`, `identity/identity.schema.test.ts`, `admin/admin.schema.test.ts`, `http/http.schema.test.ts`; proposed `auth/auth-response.schema.test.ts`                                                          | Password/referral limits, strict output, validity/message/empty payloads, pagination agreement; FR-003/007/020/026-030.                                                                                                                                     |
| Session/transport       | Existing `apps/web/src/services/api/api-client.test.ts`; proposed `session-runtime.test.ts`; existing `features/auth/hooks/auth.hooks.test.tsx`, `shared/query/query-client.test.ts`; proposed `credential-commands.hooks.test.tsx`                             | One refresh, signals, safe errors/retries, malformed/denied authority, A-to-B/cookie/check races, terminal barrier release versus timeout/unload quarantine, storage failure/remount and retained-secret absence; FR-005/006/017-023/032.                   |
| Adapters/access         | Proposed `features/auth/api/auth.api.test.ts`, `features/users/api/users.api.test.ts`, `features/admin/api/admins.api.test.ts`; existing `components/auth/routes.test.tsx`, `route-state.test.ts`, `features/auth/utils/safe-return-path.test.ts` under web src | Exact paths/data/CSRF, no malformed token admission, roles/destinations, no private mounting while checking/error, public recovery reachability; FR-002/004-006/012-015/018/020/021.                                                                        |
| Employee flows          | Proposed `apps/web/src/features/employee/components/auth/employee-auth.integration.test.tsx`; proposed/extended account `account-screen.test.tsx`, `change-password-modal.test.tsx`; existing generic auth tests                                                | Real registration/activation/resend/reset/change/logout, explicit consumption, expiry-after-preview, identity/unavailable regions and feedback; FR-002/003/007-011/015-019/022-025/033.                                                                     |
| Admin controls          | Proposed `apps/web/src/features/admin/components/auth/admin-login-screen.test.tsx`, `accept-invitation-screen.test.tsx`; proposed/extended settings `admins-list-screen.test.tsx`; existing common `admin-confirm-dialog.test.tsx`                              | Entry/identity/logout, separate acceptance/sign-in, reasons/confirmation/versions, stale/self/last-admin/pending-target denials, disposition/delivery, totals and disabled unsupported controls; FR-012-014/017/023/026-033.                                |
| Real browser            | Proposed `apps/web/e2e/identity-and-admin-access.spec.ts`, `auth-account.spec.ts`, `ui-preservation.spec.ts`                                                                                                                                                    | Real isolated web/API/Postgres/mail, holder reload/close and surviving/new-tab quarantine despite lock reacquisition, fresh-context recovery, unchanged-limit 429 and cross-scenario limiter isolation, privacy/viewport/focus/RTL; all FRs and SC-001-008. |

Reuse P02's real-Postgres exact-expiry/replay/concurrency evidence for unchanged backend semantics; extend owning API tests only for an evidenced integration defect. Browser expiry-after-preview changes disposable expiry metadata through private harness control, not sleeps or a production endpoint.

Run focused new/changed tests, affected contracts/auth/transport/session regressions and the complete web suite because shared access owners change. Run owning lint/type/build/output checks and explicit browser command. P03 is not a full-roadmap regression checkpoint; P05/P09/P12/P14/P15 and release retain that requirement. [Quickstart](quickstart.md) specifies commands/lifecycle/scenarios. Missing browser/database/service evidence leaves implementation acceptance incomplete; a formatter, mocked session or checklist cannot pass it.

## Complexity Tracking

No constitution violation or unresolved product clarification is required.

| Necessary design                                    | Why needed                                                                              | Simpler alternative rejected                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Identity/check generations and cookie-write barrier | Persistent layouts, late writes and unloaded lock holders must not revive A or enter B. | Cache clear/lock reacquisition does not prove cookie effects ended; a transient guard disappears on reload. |
| Transient credential commands                       | Retained Query/Mutation variables/closures may expose settled credentials.              | Reset/gcTime alone cannot release all references or guard remount.                                          |
| Real Playwright harness                             | FR-034 and cookie/history/mobile/focus/privacy boundaries require it.                   | jsdom and historical screenshots cannot prove these behaviors.                                              |

## Evidence and Remaining Gates

- Fresh PLAN amendment checks: selected P03 artifacts, effective gates, auth cookie routes, module-level rate limiter/default store ownership and setup-plan --json inspected; targeted U1/U2 research/design and documentation verification performed. No application tests/services started.
- Reused evidence: P01 closure and P02 T001-T067/628-test backend acceptance. No fresh backend regression is claimed.
- Owner decisions: C1-C3 resolved; separate CONVERGE removed by latest explicit instruction. Additional UI surfaces/changes still require an owner decision.
- Pending implementation gates: production changes, actual changed tests/reviews, harness/dependency installation, real-service/browser execution and all P03 acceptance. Required infrastructure was not exercised here.
- Pending launch gates: Resend company/domain/sender/support/deliverability, approved production destinations, HTTPS/proxy/cookie/header/diagnostic runtime, deployment and independent review. Acknowledgement is not mailbox receipt. Approved one-admin/no-2FA and host-compromise risks remain; no security guarantee.
- Hooks: `.specify/extensions.yml` absent; no hook dispatched. This combined request ends with read-only ANALYZE after the separately owned narrative/task corrections. Application implementation and another phase remain unselected.
