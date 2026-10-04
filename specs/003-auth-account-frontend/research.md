# P03 Research Decisions

**Date**: 2026-10-03. Research/design only: no application tests, services, live email or dependency install. Initial research used three read-only agents for session isolation, contracts/UI and browser infrastructure; the targeted U1/U2 amendment adds one read-only cookie-recovery research agent and source review of limiter ownership. Decisions use clarified spec, constitution 1.0.0, whole roadmap and all eight engineering guides.

## R1 - Predecessors and latest owner instruction

- **Decision**: Use P02's recorded T001-T067/628-test real-persistence acceptance and its recorded P01 closure. Omit separate CONVERGE for P02 and subsequent phases per latest owner instruction; preserve implementation review, tests and release gates.
- **Rationale**: Current explicit owner instructions govern stage cadence. This resolves the procedural blocker without claiming convergence ran. The accompanying specification/checklist corrections now record these effective gates and resolved C1-C3 without changing approval markers.
- **Alternatives considered**: Run convergence automatically, rewrite governance/predecessor/approval artifacts or remain blocked on the removed stage. These exceed PLAN scope or contradict the owner.
- **Evidence**: [P02 tasks](../002-identity-admin-backend/tasks.md), [P02 handoff](../002-identity-admin-backend/quickstart.md), [P03 spec](spec.md).

## R2 - Response contracts

- **Decision**: Parse unknown envelope/endpoint data before accepting credentials. Reuse identitySessionDataSchema, identityUserDataSchema and existing admin/invitation schemas. Add only strict shared validity `{valid:true}`, neutral `{message:string}` and empty-object data schemas for already implemented replies.
- **Rationale**: Web AuthSessionData/AuthUserData are legacy; Axios generics do not validate P02's extended identity. Preview supplies no role/email/expiry; token decoding cannot create trusted display facts. Strict allowed fields/roles/statuses reject stale/private output.
- **Alternatives considered**: Duplicate frontend business schemas, new public subject/expiry APIs, accept tokens first or default identities/lists. These duplicate ownership, expand scope or fabricate authority.
- **Evidence**: `packages/contracts/src/identity/identity.schema.ts`, `admin/admin.schema.ts`, `account/account.schema.ts`, `http/http.schema.ts`; P02 auth/admin controllers; web auth/users adapters. [Exact HTTP contract](contracts/http.md).

## R3 - Current authority and single refresh

- **Decision**: Retain Axios/memory-token/cookie/CSRF owners; consolidate proactive/interceptor refresh. Proposed browser-only services/api/session-runtime.ts coordinates non-secret identity epoch, authority-check generation, cookie writes and obsolete completions. Gate protected mount/private reads on fresh account checks, including protected navigation/focus/reconnect.
- **Rationale**: Current session has 60s freshness/ignored AbortSignal and two refresh paths. Persistent layouts and late results require generation checks as well as cancel/clear. Server User/AuthSession remain permission authority. Partial restrictions do not prohibit sign-in; a policy/CSRF 403 alone does not establish session revocation.
- **Alternatives considered**: Cache clear only, stale session trust, another auth framework/store or mutable SSR account globals. These fail authority isolation or replace existing owners.
- **Evidence**: Web services/api/api-client.ts contains the current memory-token functions and refresh; browser-location.ts owns reload-based redirects. Also auth.hooks.ts, protected-route.tsx/guest-only-route.tsx and their pure state resolvers, and API modules/auth/session-authority.ts. Installed Next use-router guidance and relevant Vercel no-shared-SSR-state rule consulted.

## R4 - Cookie sequencing and transient credentials

- **Decision**: Serialize login/refresh/logout/logout-all/reset/change-password with native same-origin Web Locks and R8's persistent nonsecret barrier; BroadcastChannel carries non-secret invalidation hints only. Quarantine unknown outcomes before replacement identity. Credential preview/commands use transient imperative hooks outside retained Query/Mutation options/variables; safe in-flight state outlives dialog remount.
- **Rationale**: Ignoring JS results cannot undo Set-Cookie; one tab's promise cannot order tabs. Installed Query 5.101.4 mutation state retains variables after success/error; observer reset detaches and MutationCache clear does not cancel effects. Live correction input may remain in its active form after denial; settled payloads/torn-down flows release secrets.
- **Alternatives considered**: gcTime/reset alone, token hashes in keys, credentials in storage/messages, blind retry or a generic command platform. These leak, misstate outcomes or exceed need.
- **Evidence**: Installed TanStack mutation/observer/cache source; [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API). Detailed [session contract](contracts/ui-session.md).

## R5 - Public/protected layout boundaries

- **Decision**: Keep dashboard files/URLs. Existing admin layout retains CSS/metadata/RTL wrapper and composes an exact-allowlist boundary for only the two C1 public routes; all others guard ADMIN before shell/children. Protect employee (app) as USER. Generic auth layout's blanket guest gate moves to login/register only. Shared action links remain reachable for an unrelated signed-in account.
- **Rationale**: C1 permits this bounded split. Generic login accepts either role; dedicated admin endpoint enforces ADMIN. Navigate by validated role and safe return path; admin preview never impersonates an employee.
- **Alternatives considered**: Move routes to groups, broad admin/auth prefix exemptions, multiple root layouts, browser reload navigation or another login service. These add freeze churn or weaken boundaries.
- **Evidence**: Existing admin/auth/employee layouts, guards/navigation, P02 auth routes; installed Next route-groups/use-router/use-search-params guidance.

## R6 - Truthful UI and action links

- **Decision**: C3 management consumes independent bounded admin/invitation lists and entered reason/confirmation/version commands. Unsupported editing/global search/status filters remain disabled; activity/status aggregates unavailable; real totals use server metadata. Account exposes current identity/password/logout and unavailable later-domain values.
- **Rationale**: P02 supplies these services, not search/activity/email editing or financial projections. Invitation disposition differs from delivery. Unknown issuance without ID has limited bounded-list reconciliation; absence on one page cannot prove failure.
- **Alternatives considered**: Page-only global counts/filtering, fixture admin creation/reasons, optimistic status, zero/Free/address defaults or unbounded fetch. These violate C3/server authority.
- **Evidence**: Existing management/account surfaces, common confirmation/pagination, API admin invitation service/mapper and shared schemas.

- **Decision**: Capture credential transiently, clean history, preview without consumption and consume only by explicit action. No-referrer headers/development credential-route logging suppression prevent incidental leakage. Omit numeric lifetimes without authoritative configuration evidence. Configure existing ADMIN_INVITATION_ACCEPT_URL; no email rewrite/lifetime change.
- **Rationale**: Generic verification currently consumes in an effect; display-state/demo success cannot prove commitment. Existing mail already targets approved shared verify/reset routes. Clean reload without token must use recovery, not storage.
- **Alternatives considered**: Store token for reload, Query/SSR token props, forged success query, guaranteed mail receipt or automatic action. These leak/misuse authority.
- **Evidence**: API email.service.ts and auth/email config; existing auth panels; installed Next logging.md documents incomingRequests suppression. Actual route headers require implementation verification.

## R7 - Browser harness and private evidence

- **Decision**: Pin web dev @playwright/test 1.63.0, configured Chromium discovery under apps/web/e2e/, explicit web test:e2e and support type checks. Keep Vitest/app versions. Run production Next with a real createApp API, migrated disposable PostgreSQL 18.4 and controlled email/fixture/fault memory via private Node IPC. R9 specifies test-scoped API processes so independent scenarios also isolate limiter state.
- **Rationale**: FR-034 requires the absent browser gate. createApp({database,logger,emailDelivery?}) supports controlled email; API tests/ is excluded from production. Fixed loopback web 127.0.0.1:3103/API 127.0.0.1:4103 exercises credentialed CORS and host cookies without adding a proxy. Set NEXT_PUBLIC_API_URL before building Next; fail on occupied ports or inherited database use.
- **Alternatives considered**: jsdom/screenshots as browser evidence, public test endpoints, live mail, developer servers/databases or a new production proxy solely for tests. These miss boundaries or add unrelated scope.
- **Compatibility evidence**: [Playwright 1.63.0 release](https://github.com/microsoft/playwright/releases/tag/v1.63.0), [tagged metadata](https://raw.githubusercontent.com/microsoft/playwright/v1.63.0/packages/playwright-test/package.json), [requirements including Node 24](https://playwright.dev/docs/intro). No browser installation/runtime is claimed.
- **Source evidence**: Web/API manifests/tsconfigs, createApp, API/database integration global setups, installed Next production-testing/public-env guidance. Web/API support paths are proposed in plan; tooling gets explicit discovery/type checking.

- **Decision**: Automatic trace/video/screenshots and HTML/raw-error reporting stay off for secret-bearing journeys. Safe reporter emits static scenario IDs/status/codes only; explicit screenshots occur after URL cleanup with secret controls masked. No saved storage state/HAR/mail/cookies/network dumps. Expire disposable rows for browser expiry-after-preview; reuse controlled-Date real-Postgres exact-boundary tests.
- **Rationale**: [Playwright traces](https://playwright.dev/docs/best-practices) retain network/DOM, and reporter arguments can expose credential URLs. createApp has no clock injection; a public clock API or browser sleep is unnecessary. Privacy claims cover retained/incidental data, not legitimate credential transport.
- **Alternatives considered**: Record everything then scrub, raw stdout on failure, new production clock endpoints or sleep-based expiry. These expose secrets or increase scope/flakiness.
- **Evidence**: Existing API request sanitizer/redaction and oscar-auth/session-revocation integration tests; [quickstart](quickstart.md) defines safe harness lifecycle.

## R8 - Cookie-write owner loss and release evidence (U1)

- **Decision**: Before each cookie-writing HTTP dispatch, under the existing Web Lock, synchronously write/read back one strict nonsecret localStorage barrier containing only version, opaque operation ID and pending/uncertain state. Only its matching live request owner holding the lock removes it after a complete terminal HTTP response. Inherited/invalid/unreadable records block private restoration and further cookie writes. A UI deadline keeps the original observer alive; owner loss leaves the context unavailable across reloads/tabs. C2 feedback permits recovery through a wholly isolated browser profile/private session and explicit validated sign-in, without claiming the abandoned action's result or revocation.
- **Rationale**: Web Locks releases locks during document unload; exclusivity after reacquisition cannot establish prior request settlement. Fetch cookie handling can occur even when JavaScript observes a CORS failure. `/users/me` establishes current authority, not absence of a future old Set-Cookie. This is a conservative design inference from those boundaries, not automatic recovery or a new server fence.
- **Alternatives considered**: TTL/heartbeat expiry, abort plus reacquisition, a same-context authority read, cookie-only clearing or a normal new tab cannot supply the missing evidence. A shared worker/new backend status or fencing protocol would expand P03 beyond the existing API. Persisting credentials or a generic request journal is unnecessary; one nonsecret barrier is sufficient for the bounded blocked state.
- **Evidence**: Existing auth controller cookie writers and route inventory; [Web Locks termination](https://www.w3.org/TR/web-locks/#termination-of-locks), [Fetch CORS credentials/cookie processing](https://fetch.spec.whatwg.org/#cors-protocol-and-credentials), [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html#introduction), [Playwright context isolation](https://playwright.dev/docs/browser-contexts). [Exact protocol and limits](contracts/ui-session.md#cookie-write-barrier-and-owner-loss-u1).
- **Limits**: Supported intact storage and one canonical frontend origin are assumptions, not crash-durability guarantees. Storage deletion/eviction, alternate origins sharing cookies or host compromise are outside the proof. An independently isolated context has a new cookie jar/storage; another private window may share its existing private session and is insufficient.

## R9 - Independent scenario rate-limit state (U2)

- **Decision**: Give each independent Playwright test scenario its own new API OS process, migrated disposable database, controlled mail/fault state and fresh browser contexts. Build Next once with the fixed public URL; start owned Next/API servers per scenario. Close browsers/servers/database before the next scenario binds the same ports. Related concurrent/replay/rate-limit steps share that process and its counters. Preserve default limiter values, IP keying and middleware. Clear inherited limiter overrides and set child-only `RAILWAY_ENVIRONMENT=p03-e2e` before API imports to use env.ts's existing dotenv bypass; supply required test configuration explicitly. Deletion alone is insufficient because workspace dotenv could restore overrides. No environment file or production configuration changes.
- **Rationale**: `auth.rate-limiters.ts` and `rate-limit.middleware.ts` create module-level limiters whose default store is MemoryStore. Independent real browser requests use the same loopback source IP. Reconstructing createApp, changing test accounts or resetting mail/faults in one process cannot reset all source/actor/token counters. A fresh process naturally isolates them without modifying production behavior.
- **Alternatives considered**: Increasing test limits, forging forwarded IPs, resetting exported stores during a scenario, public reset endpoints or waiting for windows to expire would weaken acceptance or add flaky/unsafe controls. Split independent cases into separate scenarios, seed initial identities through test setup and budget actual calls against unchanged limits; never restart within a rate-limit/race case to evade its behavior.
- **Evidence**: `apps/api/src/modules/auth/auth.rate-limiters.ts`, `apps/api/src/modules/admins/admins.routes.ts`, `apps/api/src/middlewares/rate-limit.middleware.ts`, `apps/api/src/core/config/auth-rate-limit.config.ts`, `apps/api/src/core/config/rate-limit.config.ts`, `apps/api/src/core/config/env.ts`, installed express-rate-limit default-store source, and existing disposable-database integration setup. [Harness lifecycle and acceptance](quickstart.md#isolated-harness-lifecycle).

## Research Closure

All technical questions resolved from current source, installed framework/library guidance and cited primary references. Applicable security references for React/general frontend/Next/Express, Vercel React rules and docs-guard informed design. No separate audit report or application fix is produced. Implementation, infrastructure execution and launch evidence remain pending.
