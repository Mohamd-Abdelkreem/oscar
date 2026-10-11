# Implementation Plan: P09 - Withdrawal Frontend

**Branch**: `008-withdrawals-payout-recovery` (current checkout, unchanged) | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P09 - Withdrawal Frontend (legacy P12).

**Feature Directory**: `specs/009-withdrawal-frontend`. Pointer and spec match P09.
Spec Kit resolves identity `009-withdrawal-frontend`; Git has not switched branches.

**Input**: Clarified spec, [roadmap](../../PLAN.md), completed
[constitution](../../.specify/memory/constitution.md), all eight
[engineering guides](../../docs/engineering/README.md), repository instructions and
the selected PLAN prompt in [the operating contract](../../docs/workflow/speckit-prompts.txt).

## Summary

Connect the existing employee withdrawal/account address sections and admin table
to P08 through shared contracts, central Axios and scoped Query hooks. Preserve
presentation except the explicit OD-001 through OD-003 decisions. Complete a bounded
backend compatibility batch first: admitted new-request readiness, safe admin
identity/action availability and exact keyed admin-command observation. Reuse P08
money/source/calendar/scheduler/signer/recovery behavior.

This design does not implement or verify P09. PLAN owns this file,
[research](research.md), [data model](data-model.md),
[contract](contracts/withdrawals.md) and [quickstart](quickstart.md); no tasks or code.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node >=24 <25, pnpm 11.17.0.
Current [root](../../package.json), [web](../../apps/web/package.json),
[API](../../apps/api/package.json), [contracts](../../packages/contracts/package.json)
and [database](../../packages/database/package.json) manifests were inspected.

**Primary Dependencies**: Existing Next 16.3.6, React 19.2.8, Query 5.101.4,
Axios 1.19.0, RHF 7.84.0/resolvers 5.7.1, Zod 4.4.3, Tailwind 4.3.3, Cairo 5.3.0
and current Lucide/Radix controls. Express 5.2.1, Prisma 7.9.1 and server Luxon 3.7.2
stay unchanged. Installed Next/Query APIs and primary documentation were inspected
as recorded in research. No new dependency or lockfile change.

**Storage**: Existing PostgreSQL destination/quote/request/action/attempt,
reservation/ledger and runtime-admission records; Redis wakeups and protected
attempt/recovery storage are reused. No schema/migration or queue change.
Browser recovery storage contains only validated actor-scoped opaque operation
identity, never proof credentials, response data, raw reasons or money projections.

**Testing**: Existing Vitest 4.1.10, Testing Library 16.3.2, Supertest 7.1.4,
Testcontainers 12.1.0 and Playwright 1.63.0/Chromium. Real migrated PostgreSQL 18.4
for financial/admission claims; P08 tests own isolated Redis 7.4.11. Current browser
fixtures run real Next/API/PostgreSQL and private captured email, without a payout
worker/signer. Exact future paths/commands are in quickstart.

**Target Platform**: Arabic RTL/Cairo employee mobile web and responsive admin;
320/390/430px phone and representative desktop. Existing API/private signer/worker
boundaries stay intact. Deployment remains P11.

**Project Type**: Existing pnpm/Turbo monorepo: thin App Router -> feature API/hooks
-> central transport -> Express domain services -> PostgreSQL.

**Performance Goals**: Bounded server lists, employee 25/admin 10 rows, unique order,
cancellable reads and finite foreground observation. No per-second network countdown,
unbounded financial fetch, invented latency promise or new benchmarking platform.

**Constraints**: P08 and compatibility gates before dependent frontend wiring;
exact six-decimal USDT, current authority, immutable snapshots, one active request,
source-preserving release and server Baghdad time. OD-001 through OD-003 are the
only local presentation exceptions.

**Scale/Scope**: P09 only: `/employee/withdraw`, the destination section of
`/employee/account`, `/admin/withdrawals` and relevant existing wallet refresh.
Roadmap target: 1,000 registered employees over a year, not simultaneous load.
P10 administration/replacement/settings/final account and P11 deployment/WAL/full
restore/release are excluded.

## Constitution Check

Both reviews pass for **planning**. Implementation gates below remain incomplete.

| Principle                  | Before research / after design | Evidence and boundary                                                                                                                                                                                                          |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I - Scope/evidence         | PASS / PASS                    | Verified P09 pointer/spec, unchanged checkout, bounded outputs; current/proposed owners and reused evidence separated.                                                                                                         |
| II - Frontend preservation | PASS / PASS                    | OD-001-003 explicitly authorize the named sheet/inline/history/copy/action changes. P03 admin login exists and is accepted; the old missing-screen inventory is stale, not permission for new auth work or a policy amendment. |
| III - Ownership/design     | PASS / PASS                    | Existing contracts, services, feature adapters/hooks, Query and Axios; no new dependency/table/framework.                                                                                                                      |
| IV - Backend prerequisites | PASS / PASS                    | Latest P08 T079-T080 acceptance renews both gates. Proposed compatibility tests precede money wiring.                                                                                                                          |
| V - Financial/custody      | PASS / PASS                    | Existing transactional reservations/attempts retained; exact quotes, source-identical release, UNKNOWN active, immutable recipient, Baghdad display and read-only recovery accounted for.                                      |
| VI - Security              | PASS / PASS                    | Current authority/CSRF, private proof lifecycle, pre-navigation scrub and scope retirement; public capability grants no signing. Single-admin/no-2FA residual risk and P11 independent release review retained.                |
| VII - Verification         | PASS / PASS                    | Concrete future contract/API/component/E2E files and real DB/admission races, affected P08 regressions, full P09 checkpoint; no planned test claimed run.                                                                      |

Current [P08 acceptance](../008-withdrawals-payout-recovery/quickstart.md#final-t079-t080-acceptance)
records both groups, including isolated financial/queue/Linux recovery and reused
separately authorized Nile proof. These records were inspected, not rerun. They do
not prove current payout startup or P11 WAL/full-system restore.

The skill setup copied the core plan template; no prior plan suite existed.
Extension hooks are absent. Constitution, roadmap, spec, checklist and pointer stay
unchanged during PLAN.

## Project Structure

### Documentation (this feature)

```text
specs/009-withdrawal-frontend/
  spec.md                         # Existing, unchanged
  checklists/requirements.md      # Existing, unchanged
  plan.md                         # PLAN
  research.md
  data-model.md
  contracts/withdrawals.md
  quickstart.md
```

### Source owners

All paths are repository-relative. Files marked proposed do not yet exist.

| Existing owner                                                                                   | Proposed P09 work                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/withdrawals/withdrawal.schema.ts`, `wallet/wallet.schema.ts`, `index.ts` | Boolean readiness, nullable configured status network for first-address review, separate admin projection and strict keyed outcome schemas/exports. Preserve existing request and command-result shapes.                     |
| `apps/api/src/core/config/tron.config.ts`, `server.ts`, `app.ts`, `router.ts`                    | Public-only optional payout UUID/network/token capability parser and injection. Update `.env.example` explanation during implementation; no signer credentials/provider imports.                                             |
| `apps/api/src/modules/custody/runtime-control.ts`                                                | Small read-only admission projection sharing current boot/generation/fence/pause checks and locks; no heartbeat.                                                                                                             |
| `apps/api/src/modules/withdrawals/`                                                              | Proposed `withdrawal-readiness.ts`; owning service/mapper/quote/reservation correction; admin projection, availability and keyed outcome in existing routes/controller/service.                                              |
| `apps/api/src/modules/wallets/wallets.service.ts`, `wallets.mapper.ts`                           | Read the same capability/admission in the transaction and pass readiness into employee/admin wallet mapping.                                                                                                                 |
| `apps/api/src/infrastructure/openapi/openapi.ts`                                                 | Align existing schema construction and new observation route; no copied parallel DTO definitions.                                                                                                                            |
| `apps/web/src/services/api/api-client.ts`, `safe-error.ts`, `shared/query/financial-query.ts`    | Withdrawal private-read matcher, safe code/field allowlists, small P09 key/read/list/retirement and bounded observation additions. Preserve automatic command-replay exclusions.                                             |
| `apps/web/src/features/employee/api/`, `hooks/`, `utils/`                                        | Proposed `api/withdrawals.api.ts`, `hooks/withdrawals.hooks.ts`, `hooks/withdrawal-command.hooks.ts`, `utils/withdrawal-command-runtime.ts`, `hooks/use-withdrawal-destination-link.ts`, `utils/withdrawal-presentation.ts`. |
| `apps/web/src/features/employee/components/withdraw/`, `components/account/account-screen.tsx`   | Wire existing form/address/status/screen and address-only account section. Proposed nonvisual `components/withdraw/withdrawal-destination-boundary.tsx`; reuse existing sheet/buttons/feedback.                              |
| `apps/web/src/app/employee/(app)/layout.tsx`                                                     | Invisible boundary outside existing ProtectedRoute for fragment cleanup before redirect; preserve rendered shell/navigation/auth behavior. Route pages remain thin.                                                          |
| `apps/web/src/features/admin/api/`, `hooks/`, `utils/`                                           | Proposed `api/withdrawals.api.ts`, `hooks/withdrawals.hooks.ts`, `hooks/use-withdrawal-action.ts`, `utils/withdrawal-command-runtime.ts`, `utils/withdrawal-presentation.ts`.                                                |
| `apps/web/src/features/admin/components/withdrawals/`                                            | Wire current table/row/extension/rejection; retire manual/held/unsafe actions and replace elapsed previews with truthful reviewed intent/server countdown.                                                                   |
| Existing fixture/context consumers                                                               | Remove withdrawal screen dependence. Delete orphaned withdrawal-only handlers after caller inspection; preserve global providers and unrelated P10 employee-detail consumers.                                                |
| Existing API/web E2E owners                                                                      | Proposed `apps/api/tests/e2e/p09-withdrawals.ts`, web support peer and `apps/web/e2e/withdrawals.spec.ts`; bounded private test setup, excluded from production build.                                                       |

**Structure Decision**: Keep existing package owners and genuine shared primitives.
Extract only focused presentation, private-link or command-recovery responsibilities.
Shared reader additions preserve P04-P07 behavior. No server truth in a new context
store, universal financial form, generic command platform or repository layer.

## Backend Compatibility and Gate

[The contract](contracts/withdrawals.md) owns exact interfaces. Complete all three
corrections and their real backend checks before dependent frontend wiring:

1. **Readiness**: validated public payout UUID/network/token, current registered and
   acknowledged API boot, matching generation, no financial fence, no dispatch pause.
   Missing capability/admission means false; malformed configured input fails startup;
   unexpected DB errors remain read failures. New quote/first acceptance use the same
   predicate/admission locks. A quote cannot reserve after pause. Committed outcome,
   status/history/wallet reads remain available under current authorization.
   Status also exposes nullable configured network for first-address review, without
   provisioning or coupling to deposit reads. Preserve saved pending/confirmed networks;
   absent/incompatible configuration disables issuance.
2. **Admin projection**: current employee safe identity and server canExtend/canReject,
   separate from employee DTOs. SCHEDULED/no attempt/current mutation admission/
   supported counters enables safe actions. A null TxID does not prove no attempt.
   Dispatch pause alone permits safe admin changes; write/version/ledger checks decide races.
3. **Keyed admin outcome**: exact current-admin operation/key/target/version lookup,
   independent of the latest-100 history. COMMITTED identifies the saved action;
   NOT_OBSERVED stays blocked; SUPERSEDED proves only that the old first write can
   no longer apply, then requires fresh review.

Readiness means admitted **new-request capability**, not signer liveness/immediate
payment. Funds/destination/restrictions/active state remain separate. Protected
key/policy/inventory and configured isolated payout startup must be verified through
existing backend boundaries before enabling controls. No task-completion flag,
historical SIGNER row, treasury read grant or new health feed substitutes for that gate.

Required evidence: shared schemas, real role/admission/HTTP/transaction/pause races,
projection privacy, keyed observation, OpenAPI consistency and affected P08 regressions.
Recheck both P08 gates against changed source. Missing infrastructure/evidence leaves
controls disabled; no new live transfer is authorized by this compatibility work.

## Frontend Design

### Scoped reads and freshness

Reuse `apiClient`, `parseApiResponse`, `financialInput`, `financialRead`,
`financialPage`, `useFinancialScope` and current session checks. Query keys include
non-secret account/role/epoch/check, domain, resource and normalized filter/page/limit.
Forward AbortSignal. P09 retirement removes private queries and transient command/link
state. Previous-page placeholders cannot become another resource's actionable detail.
Denial hides protected data/disables handlers; transient errors preserve dirty drafts.

Reuse the existing P07 observation policy in `financial-query.ts`: at most 20 completed
observation/refetch cycles per actor/role/epoch, domain and normalized resource/filter/
page selection. The first eligible read is immediate; after each completed cycle wait
5, 10, 20, 30, then 60 seconds, capped at 60 seconds thereafter. Success and transient
failure both consume a cycle. Use `retry:false` for these queries, disable automatic
mount/focus/reconnect fetches outside this budget and coalesce overlapping reads.

Continue only while active requests/proofs/command outcomes need observation; stop on
resolution, denial, contract failure, departure or budget exhaustion. Pause scheduling
while hidden, unfocused or offline. Focus/reconnect resumes the same unexhausted window;
an explicit authorized user refresh or one-shot refresh after a newly confirmed command/
newly observed persisted transition may reset its budget through the same observation
owner. Deduplicate transition refresh by persisted identity/version; unchanged polling
responses, countdown changes and rerenders never reset it. Count/backoff survives ordinary
session checks, remounts and query-entry garbage collection/recreation within the same
QueryClient; actor/resource retirement removes obsolete state. Exhaustion preserves
unknown/last-known facts, drafts, recovery handles and refresh, never failure or permission
to dispatch again. Display returned counted-time snapshots; no local calendar scheduler
or per-second network polling.

Confirmed or observed reservation/release/settlement invalidates scoped P09 status/
history/detail and relevant P04 wallet/ledger/membership facts. Destination confirmation
also refreshes eligibility. Compare server versions/states to detect external changes.
Affected disabled P09 readers need the explicit bounded refresh alongside invalidation;
invalidation alone does not fetch them. No optimistic money edit or whole-cache clearing.

### Initial destination

Keep entry in the withdrawal card, with shared validation/RHF and exact address/network
review in the reused employee sheet before issuance. Current destination reads drive
inline UNSET/PENDING/CONFIRMED, expiry/cooldown/delivery and readonly copy.
Touch only the account address section.

A nonvisual boundary immediately outside ProtectedRoute captures only the recognized
`#withdrawal-confirmation=<token>` on the account route into a private ref and scrubs
it in a client layout effect before passive protected navigation. Preserve native
history state and safe path; never route the secret. Handle same-route hashchange and
clear on departure/pagehide/session retirement/actual anonymous or wrong-role result.
The initial session check performs no consume; transient proof cannot cross login
or an identity switch. Wrong-employee proof is rejected by existing server binding
and discarded with matching-account/reopen guidance.

Only explicit inline confirmation consumes. Keep proof outside Query keys, mutation
variables/context/meta, storage, retained props/navigation and diagnostics. Use a
cache-free private async owner and clear on settlement/teardown. Lost consumption
reply observes current destination, never automatically replays the credential.
Issuance/resend uncertainty observes saved version/pending state. Provider acceptance
is not mailbox delivery. Reopen the latest email after matching authentication;
no credential bridge/new auth route is needed.

### Quote, lifecycle and history

Keep amount text and normalize harmless form zeros to shared canonical decimals,
without Number/parseFloat/exponent/grouping acceptance. No local fee/funding/deadline
authority. Request a quote; the existing sheet shows exact server gross/rate/fee/net,
eligible sources, fixed recipient/network and timing. Stale/expired material facts
require a fresh quote and explicit review.

Before acceptance persist only its validated actor-scoped opaque quote ID/request
key recovery handle, following existing runtime patterns. The command owner survives
dialog dismissal/remount and checks online/current authority immediately before
dispatch. Mutations use retry:false/networkMode:always and never replay automatically.
Retire the provisional handle/guard if dispatch is locally proven not to have started.
After the original first dispatch, the only supported definite noncommitting replies
are validated, matching-scope/attempt errors `WITHDRAWAL_QUOTE_STALE` (409),
`WITHDRAWAL_ACTIVE` (409) or `WITHDRAWAL_BLOCKED` (403), with no earlier unresolved or
in-flight dispatch. These existing acceptance branches follow committed-request replay
detection and precede reservation. Retire that attempt's handle/guard, preserve drafts
and refresh eligibility: stale terms require a newly reviewed quote if permitted;
active/restricted accounts remain blocked and observe the current request/status.

Every other post-dispatch error, lost/malformed/obsolete reply or earlier unresolved
dispatch retains original-quote recovery. HTTP status alone, generic validation/
admission/ledger errors and 5xx/unavailability do not qualify for the exception.
Matching-actor restoration with only the opaque handle also observes the original
quote: COMMITTED restores the request; live NOT_OBSERVED remains blocked; only
EXPIRED_UNCOMMITTED permits abandoning that uncertain attempt for a new quote.
Storage/coordination or handle-retirement failure blocks a new dispatch rather than
creating untracked uncertainty. No new outcome variant or persisted rejection is needed.

T013 must include real PostgreSQL original-quote observation racing acceptance across
expiry. An observer waiting on acceptance must not combine an older request-absent
snapshot with a later clock and label a committed winner EXPIRED_UNCOMMITTED. This
source-inferred overlap risk needs real-connection/barrier evidence in T012; missing
or failing proof blocks dependent recovery and requires correction in the existing
outcome owner before the gate can pass.

Render all nine contract states; all five active states disable and guard creation.
Snapshots continue through expiry; UNKNOWN remains reserved. Inline details show
original/current due, earliest dispatch, counted remaining time, recipient/network,
accepted fee and actual settlement/release/audit. Zero countdown never means paid.
Completion shows confirmed net plus fee; safe terminal release shows original gross/
sources and zero charged fee. Revalidate current eligibility without a 24-hour cooldown.

Employee history uses 25 rows with approved Previous/Next/page/count. Admin keeps
10-row server search/filter/paging. Reset page on filters; clamp only settled
same-scope authoritative out-of-range responses. Existing status count slots must
describe returned matching/page scope; do not infer global counts or add an aggregate API.

### Admin scheduled actions

Require current enriched detail, server safe flags, exact expectedVersion, trimmed
reason (max500), explicit confirmation and guarded handlers. Keep supported fractional
counted hours as text through `positiveCountedHoursSchema`; retain presets. The
existing extension popup reviews exact added hours/current and original deadline.
Relabel obsolete elapsed/cumulative preview slots under OD-002 to explain that the
new counted deadline returns after confirmation; add no preview endpoint.

Bind each key permanently to original actor/target/kind/version/body. Closing/remounting
does not unlock pending work. Use exact keyed outcome reads after uncertain replies,
with minimal opaque reload recovery identity and no stored raw reason/body.
Explicit manual retry requires reproducing the original reviewed body/key and matching
a retained non-secret intent fingerprint; edited drafts cannot become retries.
Server payload binding remains authoritative. If original intent cannot be reproduced,
observe while blocked. SUPERSEDED permits newer-version refetch/re-review without
claiming own success. COMMITTED shows its saved action plus current request.
A similar reason/version or truncated history never proves the original command.

Retire manual Complete, held Release, fictional held filtering and processing Reject,
including their screen/row/dialog/handler wiring. Only safe SCHEDULED offers existing
extension/rejection; all other states are readonly. Destination replacement stays P10.

## Delivery Order and Validation Gates

These are internal dependencies for later tasks, not new roadmap phases or permission
to implement now.

| Order | Bounded work                                                                        | Gate before dependants                                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A     | Backend compatibility/contracts                                                     | Current P08 evidence, real schema/HTTP/admission/race tests, privacy and protected configured startup/admission evidence.                                                                        |
| B     | Shared P09 transport/query/recovery; employee destination/request/lifecycle/history | Adapter/hook/component checks for exact strings, secret privacy, scope retirement, unknown recovery and wallet refresh. A precedes money wiring.                                                 |
| C     | Admin bounded inspection/commands                                                   | Current detail/version/reason, exact outcome recovery, retired unsafe controls, stale/claim conflicts, dirty drafts. A/shared owners precede wiring; independent UI files may later parallelize. |
| D     | Browser journeys and full P09 checkpoint                                            | Real reservation/release/concurrent/lost-reply persistence, counted time/RTL/focus/privacy, full package/integration/browser evidence.                                                           |

Quickstart maps every FR group to concrete future test owners. Component mocks prove
presentation only; financial claims require real PostgreSQL/current admission. Reuse
unchanged P08 signer/queue/testnet evidence and run affected regressions after changes.
Seeded browser lifecycle cases are explicitly presentation evidence.

## Remaining Implementation Gates

- Implement/test compatibility before enabling request controls; verify isolated
  configured payout startup/inventory/admission without secret API imports.
- Add actual P09 test files/private browser support and full checkpoint evidence.
  Missing Docker/Redis/protected Linux infrastructure stays an unmet gate.
- P11 production WAL/full restore, launch configuration/UAT/independent money-security
  review and deployment/real-money owner approval remain separate. Compromised
  admin/host risk remains despite the approved single-admin/no-2FA model.

No product clarification or new visual-surface decision remains after OD-001-003.
Stop after PLAN; the next appropriate owner command is CHECKLIST.

## Complexity Tracking

No constitution violation. The shared readiness helper and one keyed observation
read are necessary to consume backend truth. A new health service, preview API,
database model or universal command engine would add no required value.
