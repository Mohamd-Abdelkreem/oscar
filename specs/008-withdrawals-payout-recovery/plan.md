# Implementation Plan: P08 Withdrawal Reservation, Automatic Payout, and Recovery Backend

**Branch**: `008-withdrawals-payout-recovery` (verified final checkout) | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P08 - Withdrawal Reservation, Automatic Payout, and Recovery Backend

**Feature Directory**: `specs/008-withdrawals-payout-recovery`. The pointer/spec match P08. Final Git inspection confirms the same P08 branch; the spec's `007-deposit-frontend` records its earlier creation context. Reflog records checkout to P08 at 2026-10-08 05:17:48 +0300, preserving HEAD c45f1a1. PLAN issued no checkout/commit command, and setup-plan.sh changes no Git branch.

**Input**: Clarified P08 specification, including C1 safe-failure release/new request and C2 sole pending first-address proof; owner requested PLAN only. Apply constitution 1.0.0, `PLAN.md` and `docs/workflow/speckit-prompts.txt`. Research/design steps are internal to this one feature.

**Status**: PLAN complete. Technical design and post-design constitution checks pass with the explicit single-label owner exception recorded below. No implementation, tasks, migration execution, dependency installation, application tests, transfers or deployment occurred. Both acceptance gates remain unexecuted.

## Summary

Group A adds first destination email proof, strict quotes/acceptance, exact gross reservation, one active request, the existing Baghdad clock, repairable PostgreSQL/Redis scheduling, positive extensions and safe unsent cancellation. **Gate A must pass before Group B payout/recovery implementation.** Group B extends the protected signer with fixed treasury net payouts, one original immutable transaction attempt, one unresolved outgoing treasury lane, canonical-final settlement/safe failure, UNKNOWN reconciliation, independent recovery admission and bounded operator alerts. Both backend gates must pass before P09.

Reuse current ledger/auth/subscription/calendar/custody foundations. PostgreSQL owns snapshots, deadlines, reservations, attempts and outcomes; Redis carries replaceable wakeups. Reuse concrete TRC-20/storage primitives without treating a withdrawal as a sweep or creating a generic transfer engine. C1 closes conclusively failed requests with original-source release and zero fee; later payment requires a new quote/current terms/new 72-hour schedule. No replacement payment or 24-hour cooldown exists. C2 commits replacement proof authority before email I/O and never revives old tokens.

### Approved compatibility decision

The truthful `WITHDRAWAL_SETTLEMENT` origin extends the shared ledger enum. `apps/web/src/features/employee/utils/ledger-presentation.ts` exhaustively maps `LedgerRow["origin"]`; employee row/detail and administrator finance screens consume it. The new origin breaks workspace typechecking and lacks a rendered label. P08 excludes frontend/static-copy edits.

On 2026-10-08 the owner explicitly answered “Approve the single label entry (recommended)” to the concrete proposal `WITHDRAWAL_SETTLEMENT: "سحب مكتمل"` in the existing map. This authorizes planning that one compatibility entry during later P08 implementation, preserving every existing label, route, control and style. No web source is changed during PLAN. Group B must add and verify that entry with the shared enum/export; Group A can retain RESERVE/RELEASE. Casts, blank labels, disguised origins and hidden settlement history are forbidden. This is a bounded phase exception, not permission for P09 integration or a project-wide policy amendment.

P09 separately owns first-address pending/result handling and obsolete held/manual-completion/processing-rejection fixtures. The current admin extension dialog exists. Admin sign-in is implemented; stale missing-login warnings do not create a new P08 blocker or authorize a screen.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node >=24 <25, pnpm 11.17.0, verified manifests.

**Primary Dependencies**: Existing Express 5.2.1, Prisma 7.9.1, Zod 4.4.3, Luxon 3.7.2, TronWeb 6.5.1, Resend 6.20.0, Vitest 4.1.10 and Supertest 7.1.4. Proposed exact additions: BullMQ 5.81.5/direct ioredis 5.11.1 for required wakeups; direct dev testcontainers 12.1.0 when importing GenericContainer for Redis. Primary metadata compatibility verified; install/build remains future evidence. No framework/SDK upgrade.

**Storage**: Existing PostgreSQL 18.4, Prisma and append-only ledger; proposed withdrawal rows/guards and reserved-gross settlement. Proposed Redis 7.4.11-alpine with no eviction and isolated integration container. Existing owner-only encrypted local/off-host custody files and independent escrow extended with distinct payout/key record types. Queue/leases are not financial truth.

**Testing**: Current Vitest unit/integration, migrated real PostgreSQL database tests, shared schema tests, Linux protected runtime/archive fixtures, plus actual Redis lifecycle. Extend the existing opt-in `test:testnet` profile with payout-specific admission/context and explicit ordering; its current setup is P06 deposit/sweep-specific. No new runner.

**Target Platform**: Existing API, worker, signer and independent recovery/operator CLI. Scheduling joins the existing worker; signer has no Redis dependency. P08 isolated withdrawal recovery does not replace P11 deployed WAL/PITR/full-system recovery.

**Project Type**: Existing TypeScript monorepo; API/protected infrastructure, shared browser-safe contracts and database are affected owners. No new application/service.

**Performance Goals**: Bounded scans, queue retention, pagination, timeouts/backoff, rates and alerts. No invented throughput/SLA. One unresolved outgoing treasury lane conservatively prevents physical liquidity/resource oversubscription; other accepted requests remain scheduled. UNKNOWN holds that lane while observations continue.

**Constraints**: Initial gross 16–500 inclusive, fee 2100 bps, exact gross=fee+net; company pays network/resources separately. Shared Asia/Baghdad 72 all weekday hours excludes Saturday/Sunday; counted dueAt and normalized dispatchAt remain distinct. Current authority at acceptance/claim; accepted recipient/fees/eligibility/source terms stay immutable. No UI wiring, subsequent employee address edit, hold, employee cancellation product, admin payout approval, replacement, arbitrary signing, new asset, 2FA/dual approval or automatic top-up.

**Scale/Scope**: P08 only, combining legacy P10/P11. Capacity/deployment/release stays P11. One spec/plan and later task set; no new formal phase per backend group.

**Design References**: [Research](research.md) resolves technical choices; [data model](data-model.md) owns persistence/constraints/lock order; [HTTP contracts](contracts/withdrawals.md) and [protected runtime contract](contracts/payout-runtime.md) own interfaces; [quickstart](quickstart.md) owns future validation. The approved single-entry compatibility decision is recorded.

## Constitution Check

_Pre-research assessment passed for backend-only planning. Post-design inspection found the settlement enum/label conflict; the owner explicitly approved its exact one-entry compatibility exception on 2026-10-08. Post-design checks now PASS for design, with implementation and acceptance evidence pending._

| Principle                  | Before research | After design                         | Evidence/gate                                                                                                                                                                 |
| -------------------------- | --------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Scope/evidence         | PASS            | PASS                                 | P08 pointer/spec; actual branch distinguished; only PLAN artifacts; source/proposals/execution separated                                                                      |
| II — Frontend preservation | PASS            | PASS with explicit owner decision    | No web edits in PLAN; exact single-map-entry exception approved 2026-10-08, all other frozen presentation preserved; P09 remains separate                                     |
| III — Ownership/design     | PASS            | PASS                                 | Existing API/contracts/database owners; metadata-backed dependency purpose; no platform/outbox/DI/transfer framework                                                          |
| IV — Backend prerequisites | PASS            | PASS for design                      | Recorded P06/P07 evidence; Gate A before Group B, both before P09; bounded batches; prior owner removes separate CONVERGE prerequisite                                        |
| V — Financial/custody      | PASS            | PASS for design                      | Exact money/provenance/snapshots/clock; atomic gross reservation/settlement/release; one active request/attempt/lane; UNKNOWN; archive before broadcast; independent recovery |
| VI — Security              | PASS            | PASS for design                      | Current USER/ADMIN authority/session/CSRF/rates; strict protected intent, private files/roles; confirmation/reasons/audit; accepted one-admin/no-2FA risks preserved          |
| VII — Verification         | PASS            | PASS for coverage; execution pending | Concrete tests/commands, actual PostgreSQL/Redis/Linux/archive and payout testnet; no planned check counted as passed                                                         |

All eight engineering guides were read at P08 start; relevant source/config/transaction/test boundaries revisited in PLAN. Apply docs-guard to these artifacts. Implementation must apply production/test/security skills when affected. The recorded owner exception is limited to one existing label entry; no constitutional amendment or broader frontend authority is granted. No security/release guarantee is claimed.

### Prerequisites and reused evidence

- Reuse accepted P01–P05 financial/identity/subscription/task foundations.
- P06 tasks record T001–T079 complete. Its quickstart records Nile provisioning/deposit/sweep 3/3 and later local/Linux recovery remediation. This is predecessor evidence, not fresh payout proof.
- P07 tasks record all 50 complete. Latest quickstart T050 Final Acceptance, 2026-10-08, records full verification exit 0; API integration 445/445, database 66/66, web units 564/564, browser 91/91, independent QR 16/16. No rerun during PLAN.
- The owner decision in `specs/003-auth-account-frontend/plan.md`, Input, removes separate CONVERGE as a prerequisite for later phases. Mandatory tests/reviews/backend acceptance remain; do not reinstate superseded procedural wording.
- Future execution requires actual Docker PostgreSQL/Redis, protected Linux/archive/escrow, a designated test-only treasury/recipient/network/token/provider and company resources, verified alert sink and independent current-generation admission. None is assumed freshly provisioned. Missing evidence keeps its gate incomplete; no mainnet fallback or spending is authorized here.

## Project Structure

### Documentation (this feature)

```text
specs/008-withdrawals-payout-recovery/
  spec.md                         # Existing clarified input, unchanged
  checklists/requirements.md      # Existing quality review, unchanged
  plan.md                         # PLAN output
  research.md                     # PLAN output
  data-model.md                   # PLAN output
  quickstart.md                   # PLAN validation guide
  contracts/withdrawals.md         # Proposed HTTP/wire contract
  contracts/payout-runtime.md      # Proposed protected runtime contract
```

No tasks.md is created by PLAN. Pointer, constitution, roadmap, guides and other-phase artifacts remain unchanged.

### Source ownership and target paths

Every new path below is **proposed future work**. Existing targets are narrow extension owners, not current withdrawal functionality. Paths in the API rows are relative to `apps/api/src/` unless otherwise stated.

| Responsibility               | Existing targets                                                                                                                                                                                                                                            | Proposed targets/effects                                                                                                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence                  | `packages/database/prisma/schema.prisma`, migrations and integration tests                                                                                                                                                                                  | Destination/destination-audit/policy/quote/request/action; Group A guards; Group B committed enum-only migration before settlement/key/attempt/lane/domain/role constraints; forward upgrade tests                                                                  |
| Shared wire contracts        | `packages/contracts/src/index.ts`, financial/financial.schema.ts, wallet/wallet.schema.ts                                                                                                                                                                   | `packages/contracts/src/withdrawals/withdrawal.schema.ts` and test; strict inputs/output allowlists; additive withdrawal terms and settlement kinds/origin with the approved compatibility entry                                                                    |
| HTTP/domain                  | router.ts, existing auth/validation/ResponseHelper                                                                                                                                                                                                          | `modules/withdrawals/{withdrawals.routes,withdrawals.controller,withdrawals.mapper,withdrawals.errors,withdrawals.service}.ts`; thin composition, authorized reads/commands                                                                                         |
| Destination/quote/reserve    | modules/subscriptions quote/eligibility precedents; email infrastructure                                                                                                                                                                                    | Module `withdrawal-destination.service.ts`, `withdrawal-quote.service.ts`, `withdrawal-reservation.service.ts`; C2 proof with same-transaction `WithdrawalDestinationAudit`, immutable quotes, exact atomic reservation and same-transaction cancellation primitive |
| Financial/history            | modules/ledger ledger.types/effects/service/mapper and reconciliation/evidence; modules/wallets; current admin finance readers                                                                                                                              | SETTLE consumes original reserved gross; compatible historic outcomes; additive terms/search/aggregates; no separate balance writer                                                                                                                                 |
| Restrictions/calendar        | modules/users/employee-restrictions.service.ts; core/business-calendar/business-clock.ts                                                                                                                                                                    | Withdrawal-aware outer financial transaction, current identity/session audit preserved; remaining counted-duration helper only if needed, no second clock                                                                                                           |
| Scheduler/config             | worker.ts, email config, compose/manifests/environment examples                                                                                                                                                                                             | `core/config/withdrawal.config.ts`, `infrastructure/queue/withdrawal-wakeups.ts`, module `withdrawal-scheduler.ts`; bounded scan, postcommit wakeups and owned lifecycle; only justified phase config/dependencies                                                  |
| Protected payout             | signer.ts, current treasury/custody primitives                                                                                                                                                                                                              | Module `withdrawal-payout.intent.ts`, `withdrawal-attempts.ts`, `withdrawal-reconciliation.ts`, `withdrawal-settlement.service.ts`, `withdrawal-recovery.ts`; fixed unique attempt/lane and canonical admitted outcomes                                             |
| Provider/signature           | infrastructure/tron/tron-provider.ts and tron-signer.ts                                                                                                                                                                                                     | Share concrete supplied-source/recipient TRC-20 primitives; independently validate payout intent/caps; preserve sweep callers                                                                                                                                       |
| Custody/recovery/alerts      | infrastructure/custody/encrypted-envelope.ts, key-storage.ts, recovery-store.protocol.ts; modules/custody/runtime-control.ts, recovery.cli.ts, recovery-history.ts; core/config/tron.config.ts, custody.config.ts; infrastructure/logger/runtime-signals.ts | Distinct TREASURY_KEY/PAYOUT_SIGNED_ATTEMPT/PAYOUT_BROADCAST_INTENT, narrow grants/guards, complete inventory/digest/admission and bounded alerts; protected provisioning under existing modules/treasury/treasury.cli.ts owner                                     |
| Real-boundary fixtures/build | Existing integration/testnet/Linux fixtures; apps/api/tsconfig.build.json; scripts/assert-build-output.mjs                                                                                                                                                  | Module testing/redis-harness.ts, testing/linux-payout-program.ts; build exclusions/built runtime checks; apps/api/testnet/payouts.testnet.test.ts and payout-specific admission/setup/sequencer                                                                     |
| Frozen web compatibility     | apps/web/src/features/employee/utils/ledger-presentation.ts and callers                                                                                                                                                                                     | Approved single settlement label in later P08 implementation; preserve all other rendered output. No P09 hooks/screens/UI behavior                                                                                                                                  |

**Structure Decision:** Extend existing authority boundaries and add only withdrawal domain responsibilities and one queue adapter. Split files for independently owned address/reservation/scheduling/attempt/finality/recovery behavior. Routes/controllers contain neither financial rules nor provider policy. No speculative repositories, services, generic event buses or new runtime app.

## Ordered Delivery and Acceptance

These are dependency-safe planning batches, not task IDs or implementation authorization. Later TASKS assigns exact IDs to this one feature.

### Group A — reservation and scheduling

1. Strict reserve/release-compatible contracts, destination/destination-audit/policy/quote/request/action persistence/guards and initial seed; actual schema/upgrade tests. Do not export Group B settlement origin yet.
2. Dedicated latest proof/current session/CSRF/rates with same-transaction issuance/consumption audit, truthful email delivery, quote/revalidation, source/fee snapshots, permanent quote identity, atomic reservation/request/audit and bounded authorized reads. Email and best-effort enqueue follow commit.
3. Versioned positive extensions/rejection with confirmation/reason; same-transaction restriction/safe release and future destination cancellation primitive. Preserve ledger lock order and existing identity/session effects.
4. Existing worker lifecycle plus DB scan/one Redis adapter, stale jobs, weekday normalization, admission/pause and restart/repair. A tested conditional Group A boundary proves races with admitted protected test identity and no signing/broadcasting. Scheduler discovery alone cannot move a request to SIGNING or create a private attempt/lane.

**Gate A (FR-003–028, SC-001–006):** Actual contract/unit/migrated PostgreSQL/Redis evidence proves C2 proof races and atomic destination-audit event counts/rollback; 16/500±micro boundaries; exact fees/net; paid/Free/exclusive expiry; 70/30→70/10 sources; replay/new keys/no partial writes/concurrent purchase; all active-state uniqueness; Friday→Wednesday/weekend cutoff; positive existing-deadline extensions; stale work/repeated release/claim-cancel-restriction races; durable restart/queue-loss repair. Affected shared ledger/identity/subscription/task/deposit regressions and review pass. Record this gate before any Group B implementation; it alone completes neither P08 nor frontend readiness.

### Group B — payout and recovery, after Gate A

1. Apply and verify the owner-approved single ledger label together with enum/export; commit enum-only forward migration before settlement/attempt/key/lane/role guards. Protected operator provisions an acknowledged recoverable key matching configured treasury; no public import/fake deposit assignment.
2. Protected fixed claim, coherent solidified balance floor/latest resources/permissions, independent company caps, immutable unsigned/signed identity, off-host readback and broadcast intent before I/O. Lost replies recover original bytes/TxID.
3. Canonical-final original body/block/receipt/transfer verification; one gross SETTLE or proved failed RELEASE/zero fee. UNKNOWN stays reserved/active and holds source lane; no timeout refund/replacement. Later request has fresh current terms/new 72-hour schedule.
4. Complete post-snapshot off-chain/history/destination-audit/key/attempt inventory and independent fenced recovery. Observe on weekends/pause; admitted financial mutation only. Bounded blocker alerts/emergency new-dispatch pause reuse existing owners.
5. Actual built Linux worker/signer/private archive/escrow crash/restart checks, then payout-specific controlled opt-in testnet context within current profile. Explicit sequencing prevents accidental replay of P06 live setup.

**Gate B (FR-029–042, SC-007–009):** Automated and controlled payout testnet evidence proves fixed intent/caps/role/private-file isolation, durable archive-before-send, lost sign/broadcast replies, one attempt/lane, canonical success/failure/concurrent finality/rollback, exact source settlement/no network deduction, UNKNOWN withholding, coherent source floor, liquidity/resource alerts, pause/weekend observations, restart/post-snapshot recovery and missing-history fencing. The approved single-entry compatibility change and affected workspace checks pass. Both gates precede P09; credentials/services/testnet absence keeps acceptance pending.

## Test Strategy

Proposed API test paths are under `apps/api/src/modules/withdrawals/` unless stated. Test risk boundaries rather than implementation steps. Pure invalid evidence/time cases may use deterministic doubles; money/SQL/roles require actual PostgreSQL, queue lifecycle actual Redis, custody actual protected process/archive, chain payout actual opt-in testnet.

| Boundary                | Concrete files                                                                                                                                                | Required scenarios                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared money/time/input | packages/contracts/src/withdrawals/withdrawal.schema.test.ts; withdrawal-clock.test.ts; changed existing money/clock tests                                    | Strict canonical decimals, unsupported authority, exact fee/net, fractional counted duration, weekend/cutoff/host independence                                                                                |
| First destination       | withdrawal-destination.integration.test.ts                                                                                                                    | Supersession before I/O, atomic matching issuance/consumption audits and rollback, late/failed delivery, invalid issuance unchanged, expiry/replay/mismatch/concurrent save, session/CSRF/ownership/redaction |
| Reserve/HTTP/races      | withdrawal-reservation.integration.test.ts; withdrawals-concurrency.integration.test.ts; withdrawals-http.integration.test.ts                                 | Quote staleness/zero-net/limits/70+10/exclusive expiry, replay/new keys/concurrent purchase/devices, all active states, output privacy and dependent-write rollback                                           |
| Queue/cancel            | withdrawal-scheduler.integration.test.ts; withdrawal-cancellation.integration.test.ts                                                                         | Redis loss/restart/repair, stale versions, positive extensions, cancellation/claim/pause/ban/block/address primitive, task-only block, original release once                                                  |
| Schema/upgrade          | Proposed packages/database/tests/integration/p08-withdrawals-constraints.integration.test.ts and p08-withdrawals-upgrade.integration.test.ts, existing suites | Direct SQL cannot bypass source/snapshot/one-active/protected evidence/live-attempt release; populated predecessor forward upgrade preserves historic IDs/outcomes                                            |
| Signer/source           | Existing apps/api/src/infrastructure/tron/signer-security.test.ts and provider/custody security tests; withdrawal-payout.integration.test.ts                  | Fixed call/TxID/intent/caps, arbitrary signing denial, independent workers/lane/source floor, resource failures, no secret API/job authority                                                                  |
| Final outcome           | withdrawal-settlement.integration.test.ts                                                                                                                     | One original-gross consumption/net+fee, zero employee network costs, C1 failed release/new request, wrong/nonfinal/failed evidence, repeated/concurrent observation/rollback                                  |
| Recovery/restart        | payout-recovery.integration.test.ts; worker-restart.integration.test.ts; testing/linux-payout-program.ts                                                      | Actual built Linux/private archive/escrow, every durable crash boundary/same bytes, independent boot approval, post-snapshot history/missing authority fence, UNKNOWN holds lane                              |
| Public chain            | apps/api/testnet/payouts.testnet.test.ts; existing admission/setup/sequencer                                                                                  | Payout-only opt-in before imports, mainnet/missing config rejection, exact net finality and crash/lost-ack original TxID recovery, fresh public outcomes                                                      |

Extend existing ledger service/concurrency/reconciliation, wallet/finance, subscription purchase/expiry, restrictions/sessions, custody/runtime and migration regressions proportionately. Redis fixture owns a disposable mapped-port container and closes workers/queues/clients/container on every outcome, with no developer fallback. Exclude new testing helpers from build and preserve built runtime assertions.

Manifest-backed future commands/scenarios are in [quickstart](quickstart.md). Each implementation batch runs focused owners and affected shared regressions. Finish P08 with required package/workspace lint/types/build/build-output and actual financial/integration/testnet evidence. Full regression checkpoint is P09; do not repeat full verify after every P08 change. Root verify formats/generates DB artifacts and is not a read-only planning check. Use clean-code-guard/test-guard/security guidance on affected actual implementation, docs-guard on docs, and proportionate React/Playwright gates for the approved one-entry compatibility change.

### Queue-to-signer handoff

Acceptance/extension leaves a SCHEDULED request's `nextCheckAt` discovery hint null. A due current-revision queue job, or worker repair scan, may conditionally set only a previously unhinted safely scheduled row to server time under worker mutation admission. It cannot create SIGNING, an attempt or a treasury lane, and cannot pull future retry backoff earlier. The existing signer loop uses a fast bounded hinted scan and a slower authoritative scan of unhinted due rows (initial repair interval 30 seconds); every protected claim rereads full timing/restrictions/admission. Thus queue wakeups accelerate discovery, while loss of Redis/worker still leaves durable signer fallback. Extensions reset the hint with their new revision; stale jobs do nothing. Treat the hint as operational metadata outside restored financial authority. Real Redis tests prove hint delivery, missing-worker fallback, stale versions, unchanged future backoff and one protected claim.

### Readiness and configuration

Current wallet readiness is literal false. Extend schema/mapper truthfully as needed; keep its current endpoint false until both backend gates and configured admitted execution are ready. New withdrawal status distinguishes capability/destination readiness/active request/blockers. A flag cannot enable a money control prematurely or convert UNKNOWN to eligibility. No P08 frontend adapters/hooks are added.

Proposed typed settings in withdrawal.config.ts cover explicit WITHDRAWAL_REDIS_URL/prefix, bounded scan interval/batch, quote/proof TTL/cooldown and pending-alert timing. Existing email config gains a same-origin HTTPS-in-production `/employee/account` target with token fragment; P09 consumes it by authenticated POST. Protected TRON/custody config owns payout key record identity and independent net/resource/fee caps. Redis loss uses bounded DB repair/alerts; company liquidity/resource/provider shortage retains reservation. Verify alert delivery in the actual environment, not merely logger existence. See contracts for defaults/ranges; no real credentials in docs or logs.

## Complexity Tracking

The owner approved exactly one existing settlement label entry. No broader policy exception is granted.

| Complexity/conflict                                  | Why needed                                                                          | Simpler alternative/boundary                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| One Redis adapter plus DB scan                       | Required queue loss/restart safety with durable financial authority                 | Queue-only loses truth; outbox/event platform is unnecessary                                                    |
| Separate payout attempt/envelope and one source lane | Sweep ownership differs; original attempt/physical concurrency must survive restart | Sweep reuse breaks archive parsing; memory mutex is insufficient                                                |
| Reserved-gross SETTLE and SQL guards                 | Consume original source/net+fee once with canonical evidence                        | Second debits/correction violate conservation; no new financial service                                         |
| Approved settlement frontend label                   | Truthful origin extends an exhaustive current consumer                              | Owner approved exact one-entry exception on 2026-10-08; verify callers and preserve all other copy/presentation |

PLAN stops here. No checklist/tasks, implementation, convergence, frontend phase, transfer, spending or deployment follows automatically.
