# P09 Research Decisions

**Date**: 2026-10-09. **Scope**: PLAN only for [the clarified P09 spec](spec.md).
All changes described below are proposed. Source inspection and existing acceptance
records resolve the design questions; no application tests or live transfers ran.

## 1. Reuse the completed foundations

**Decision**: Reuse P03 authentication, P04 wallet/ledger, P07 deposit integration
and both accepted P08 backend groups. Retain the existing App Router and installed
stack; add no dependency, database table, migration, worker or signer implementation.

**Rationale**: Current source contains the dedicated
[admin login](../../apps/web/src/app/admin/auth/login/page.tsx), real wallet adapters,
withdrawal routes, durable reservations and protected payout/recovery. The October 2
engineering/constitution inventory predates these implementations. The latest
[P08 acceptance](../008-withdrawals-payout-recovery/quickstart.md#final-t079-t080-acceptance)
renews both gates, including isolated financial/Redis/Linux recovery checks and
reused separately authorized Nile payout evidence. It does not establish production
WAL/full-system restore or a currently running configured payout service.

**Alternatives considered**: Recreating authentication, test infrastructure or P08
would duplicate accepted work. Treating historical inventory statements as current
facts would invent blockers. P10 administration and P11 deployment remain excluded.

## 2. Define readiness as admitted new-request capability

**Decision**: Replace the two literal-false fields with booleans produced by one
bounded server predicate: validated public payout-key UUID and explicit network/token
metadata are configured; this registered API boot is acknowledged for the current
control generation; financial writes are unfenced; new dispatch is unpaused.
Missing capability/admission produces false. Malformed configured input fails
configuration; unexpected database errors remain read failures.

Status additionally returns nullable configured network for initial UNSET address
review. Current UNSET destination/status exposes no network. Existing deposit metadata
reads could supply it without provisioning but would couple this flow to deposit
availability. Pass the already configured public network to withdrawal status;
preserve saved pending/confirmed networks and disable absent/incompatible-network
issuance instead of guessing mainnet.

**Rationale**: Existing
[runtime admission](../../apps/api/src/modules/custody/runtime-control.ts) owns
boot registration, generation, financial fencing and dispatch pause. A proposed
read-only admission projection can share those checks without making authorized
history reads throw the mutation-fence error. Inject the safe configuration at the
process boundary, using the existing `TRON_PAYOUT_KEY_ID` UUID reference without
loading signer credential files, provider clients or protected payout configuration
into the API. The proposed public-only parser belongs in
[tron.config.ts](../../apps/api/src/core/config/tron.config.ts); do not import the
filesystem-bearing custody configuration merely to parse a UUID.

Apply the same predicate to status, wallet views, new quotes and first reservation
acceptance in their owning transactions. Observe committed requests/outcomes even
after pause/fence. Admin safe scheduled changes depend on mutation admission, not
the new-creation pause. Shortages retain accepted obligations and their blockers.

**Alternatives considered**: A browser override, task-completion flag, historical
SIGNER admission row or boolean claiming live provider/signer health cannot establish
this capability. A heartbeat/health service or treasury-table read grant is unnecessary.
The predicate deliberately makes no liveness/immediate-payment promise. Protected
key/policy/inventory and configured signer startup remain a separate integration gate.

## 3. Complete only the admin projections and keyed observation needed by P09

**Decision**: Add an admin-only request/history projection with current employee
`{ id, fullName, email }`, reusing `employeeFinancialIdentitySchema`, and server
`canExtend`/`canReject` facts. Keep employee DTOs and existing command-result bodies
unchanged. Add one bounded read-only admin command-outcome endpoint, detailed in
[the integration contract](contracts/withdrawals.md#proposed-admin-command-observation).

**Rationale**: Current
[admin history/detail](../../apps/api/src/modules/withdrawals/withdrawals.service.ts)
uses the employee withdrawal DTO, despite searching current employee name/email.
The existing table needs the same safe identity. Current action history returns at
most 100 entries and omits request keys; comparing reason/version cannot identify
an uncertain command. Exact lookup by the existing actor/operation/key uniqueness
can observe the original action without resending it or adding persistence.

Safe action availability requires SCHEDULED, no attempt, current mutation admission
and supported version counters. A null transaction ID is insufficient: a preparing
attempt can lack a transaction ID. Existing P08 binding constraints forbid attempts
on SCHEDULED records; a fenced restored snapshot must still be read-only.

**Alternatives considered**: Fixtures, P10 employee-directory calls, inferred actors,
matching only visible action text, or unbounded action history are insufficient.
An arbitrary status-patch or manual payout API remains forbidden.

## 4. Use existing scoped reads and explicit command recovery

**Decision**: Add small P09 wrappers/cleanup/observation to
[financial-query.ts](../../apps/web/src/shared/query/financial-query.ts), and feature
API/hooks beside existing wallet/deposit/manual-credit owners. Reuse central
`apiClient`, `parseApiResponse`, `financialInput`, `financialRead`, `financialPage`,
`useFinancialScope` and current session checks. Extend only the private read matcher
and safe withdrawal error/field allowlists.

**Rationale**: Shared helpers already cover authorization, cancelled/obsolete reads,
denial quarantine and authoritative pagination. Installed TanStack Query 5.101.4
supports passing the read signal to installed Axios 1.19.0; use that path rather than
inventing cancellation. Financial mutations use `retry: false`,
`networkMode: "always"`, an explicit online precheck and scope guards, preventing
offline parking/replay. The installed mutation implementation retains variables;
proof credentials therefore need cache-free handling.
See [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
and [mutation behavior](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).

Reuse P07's concrete read budget: 20 completed observation cycles including the immediate
first read, followed by 5/10/20/30/60-second delays capped at 60 seconds. Disable automatic
query retries/fetches outside that budget and coalesce concurrent observations. Focus/
reconnect resumes the same window; explicit authorized user refresh or one-shot refresh
after a newly confirmed command/newly observed persisted transition may reset it through
the same observation owner. Deduplicate transition refresh by persisted identity/version;
unchanged polls/countdowns/rerenders never reset it. Explicit bounded refresh accompanies
invalidation of disabled readers. Preserve count/
backoff across ordinary checks/remounts/query-entry garbage collection and recreation
within the same QueryClient. Exhaustion retains last-known uncertainty and command
guards; it never authorizes financial replay.

Retain an actor-scoped opaque acceptance handle before dispatch. Locally proven no-send
may retire it. A validated matching first-dispatch `WITHDRAWAL_QUOTE_STALE`,
`WITHDRAWAL_ACTIVE` or `WITHDRAWAL_BLOCKED` business rejection may retire that attempt's
handle/guard only with no earlier unresolved dispatch;
refresh eligibility and require explicit fresh-quote review if permitted. These existing
branches follow committed replay detection and precede reservation; generic errors and
5xx/unavailability stay conservatively uncertain. For any uncertain attempt or opaque
reload recovery, observe the same quote until COMMITTED or EXPIRED_UNCOMMITTED.
NOT_OBSERVED is still uncertain; a later rejection cannot resolve a prior lost dispatch.
Admin commands retain their actor/target/kind/key/version recovery identity and use
the proposed outcome read. Dialog dismissal cannot release a pending guard.

**Alternatives considered**: Another QueryClient/Axios/context store, optimistic
money updates, generic command frameworks or automatic POST replay are unnecessary.
Existing purchase/manual-credit runtimes are precedents, not withdrawal schemas.

## 5. Scrub the destination fragment before protected navigation

**Decision**: A feature-local nonvisual destination boundary sits immediately outside
the existing employee `ProtectedRoute`. A client layout effect scrubs the recognized
account-route fragment before the guard's passive redirect. Account UI receives only
safe flow state/actions, never the credential. Consumption is explicit and cache-free.

**Rationale**: Unauthorized account children never mount, so an account-screen-only
effect cannot scrub signed-out links in time. Use native `history.replaceState`,
preserving router history state and the safe current path, without a reload or secret
router destination. Watch same-route `hashchange`; clear private refs on departure,
pagehide, session retirement or an actual anonymous/wrong-role result. Matching
user/address/proof is enforced by the existing consume service. No public proof
preview is added. Signed-out/wrong-account users reopen the latest email after login.

The installed Next 16.3.6 guides were inspected: server/client components,
`useRouter`, `usePathname`, and linking/navigation's native History API section.
Keep thin server route pages and client lifecycle in the feature boundary. A fragment
requires no `useSearchParams` or extra search-param Suspense boundary.
See [Next navigation](https://nextjs.org/docs/app/api-reference/functions/use-router).

**Alternatives considered**: The query-token auth `useLinkCredential` does not fit
this fragment protocol. Storage, returnTo, mutation variables/context/meta, diagnostic
URLs or a token bridge through authentication violate OD-001.

## 6. Present server counted time and reviewed extension intent

**Decision**: Display the server's remaining counted hours/milliseconds snapshot,
original/current due instants and earliest dispatch, refreshed by bounded observation.
In the existing extension popup, preserve the slots but show exact proposed added
counted hours, saved current/original deadline and that the resulting deadline returns
after confirmation. Reuse `positiveCountedHoursSchema` with string input.

**Rationale**: Current elapsed `dueAt - Date.now()` and `parseInt` extension previews
are wrong across weekends and discard supported fractional hours. The backend already
uses `BusinessClock.extendDeadline` and dispatch normalization. No preview endpoint,
browser calendar dependency or smooth countdown is required. The last 100 action
entries cannot prove a cumulative extension-hour total; use saved deadline facts.

**Alternatives considered**: Elapsed-time addition, integer-only hours, fictional
cumulative totals or duplicating financial calendar logic in the browser misstate
the schedule. OD-002 permits the narrow truthful wording change; OD-003 permits
the necessary inline lifecycle/detail/history facts without another route/popup.

## 7. Extend the existing validation boundary

**Decision**: Use existing Vitest/Testing Library, real migrated PostgreSQL, P08's
isolated Redis/protected recovery tests and current Playwright Chromium harness.
Add one P09 browser group plus bounded private fixture support; no runner installation.

**Rationale**: The browser harness already starts real API/Next/PostgreSQL and captures
Resend transport privately. It has no payout worker/signer and its P04 clock controls
only the injected financial clock. P08 synchronized SQL-clock/admission fixtures are
restricted to a different disposable database family and some import Vitest; do not
reuse them unchanged in the E2E child or widen their guards. Browser lifecycle seeds
prove presentation only. Real P08 service/queue tests prove unchanged payout behavior;
P09 real HTTP/browser tests must prove reservation, extension/rejection, persistence,
concurrency and reply-loss recovery. [Quickstart](quickstart.md) owns exact validation.

**Alternatives considered**: Mocked Prisma, browser-only timer advancement for signer
claims, seeded COMPLETED rows called real payouts, or `pnpm verify` alone cannot prove
the required boundaries. No new live testnet transfer is authorized by PLAN.
