# P08 Research: Withdrawals, Payouts, and Recovery

Date: 2026-10-08. This is PLAN design evidence, not implementation or executed acceptance. Authority is the clarified [spec](spec.md), `PLAN.md`, constitution 1.0.0, and all eight `docs/engineering/` guides. The active feature and final verified branch are `008-withdrawals-payout-recovery`. The spec's earlier `007-deposit-frontend` context is historical; PLAN does not change the branch.

## Research outcome and approved owner decision

The technical choices below are resolved. Source inspection found a concrete compatibility conflict: truthful `WITHDRAWAL_SETTLEMENT` extends the shared origin enum consumed by the exhaustive `Record<LedgerRow["origin"], string>` in `apps/web/src/features/employee/utils/ledger-presentation.ts`. Employee and admin callers require a rendered label, and workspace typechecking fails without it. P08 is backend-only and the frontend freeze requires an explicit owner exception for this static-copy addition.

On 2026-10-08 the owner explicitly approved the smallest proposed exception: one entry in that existing map, `WITHDRAWAL_SETTLEMENT: "سحب مكتمل"`, preserving all routes, controls, layout, styling and existing labels. The answer was “Approve the single label entry (recommended)”. This resolves the design gate and permits planning that exact entry for later P08 implementation; no source is changed in PLAN. Add and verify it with Group B shared enum/export. Do not cast away errors, render blanks, disguise origins or hide financial history. No broader UI integration or project-wide policy change is authorized.

## R1 — Extend the existing financial transaction service

**Decision:** Reuse exact micro-USDT helpers and `LedgerService`; add a reserved-gross `SETTLE` operation, `WITHDRAWAL_SETTLEMENT` origin and `SETTLED` allocation state in Group B. Successful payout consumes the identical original allocation once with available deltas zero and reserved deltas negative. Net and fee are immutable components of that one gross consumption. Safe failure uses the existing original-source `RELEASE`, with zero platform fee.

**Rationale:** `apps/api/src/core/financial/money.ts` already supplies bounded bigint, canonical decimal parsing/formatting and floor-based fee arithmetic. `ledger.effects.ts`, `ledger.service.ts`, `ledger.transaction.ts` and reconciliation own source-aware atomicity, business uniqueness and audit. Current operations support reserve/release, but no settlement. A separate balance writer would split financial authority. Subscription fees can currently reach 10000 bps; quote/acceptance must reject zero-net terms instead of silently reducing the saved rate.

**Alternatives considered:** A second debit for fee and payout double-charges the employee; `CORRECTION` alters available funds and means an administrator adjustment. Using a sweep attempt as a withdrawal conflates different ownership and evidence.

**Migration finding:** Read current applied SQL as well as Prisma. The original allocation guard permits only ACTIVE→RELEASED; P06 replaced posting/origin/audit constraints. Add enum labels in a committed enum-only forward migration before constraints reference them. Preserve old append-only history and outcome compatibility; add deferred cross-row domain guards and tests for direct SQL bypasses.

## R2 — Snapshot quotes and preserve business identity

**Decision:** Follow existing purchase quote/acceptance patterns. A quote's expiry is computed once from the validated configured TTL, initially 600 seconds (ten minutes), and remains immutable across later configuration changes; acceptance rechecks current session, account restrictions, exact exclusive subscription expiry, applicable policy, confirmed destination/version and unreserved source components under financial locks. Material change rejects the quote. Accepted time starts the actual 72 counted hours; quote timing is a preview. Store one permanent request per quote and one allocation per request. Optional validated HTTP idempotency aliases supplement these permanent business identities.

**Rationale:** `apps/api/src/modules/subscriptions/` already distinguishes current eligibility from immutable purchased terms. An active subscription's saved withdrawal fee remains authoritative; Free/expired uses a small current Free policy, initially 2100 bps with gross bounds 16–500. NON_REFERRAL precedes REFERRAL for withdrawal; purchase retains its separate reverse ordering. Expiry retains referral ownership and does not reinterpret accepted requests.

**Alternatives considered:** Recomputing accepted fees/recipient after expiry or policy changes violates snapshots. Client keys alone permit replay under a fresh key. A generic version registry or settings module is unnecessary; P10 owns settings administration.

## R3 — One first-address proof before delivery

**Decision:** Use a dedicated opaque 32-byte random proof, persist only its hash bound to employee/action/exact validated address/generation, and keep one pending proof per employee. Accepted issuance supersedes older authority before email I/O; confirmation is an authenticated CSRF-protected POST, never a GET. Proof TTL and resend cooldown use validated configuration with initial defaults of 1800 seconds (30 minutes) and 60 seconds. Accepted issuance persists the resulting expiry and next-issuance instants; later configuration changes do not rewrite them. Invalid/rejected issuance changes nothing. Saving the first destination clears pending authority and denies all later employee replacement.

**Rationale:** Existing `auth.service.ts` replaces verification authority before delivery; password reset supplies the 30-minute precedent. Reuse `EmailDelivery`, Resend, current sessions/CSRF/validation/redaction and existing limiter factories. Add bounded issuance/confirmation limits using those factories, accurately described as process-local, with database serialization/cooldown as cross-process protection. Delivery rejection/uncertainty cannot revive older proofs. Record bounded NOT_ATTEMPTED/UNKNOWN/ACKNOWLEDGED/REJECTED delivery facts keyed to proof generation so a late response cannot overwrite newer authority. A small withdrawal-owned append-only `WithdrawalDestinationAudit` records only committed issuance/resend and consumption identities in the same authority transaction, with no request dependency or token/hash/full URL. Consumption matches its issuance; rejected commands and losing races add no event. Keep this separate from request actions and the existing administrator identity-audit matrix.

**Alternatives considered:** Reusing auth verification JWT/purpose or the generic `/auth/verify-email` link grants the wrong operation. Multiple simultaneously valid proofs contradict clarification C2. A delivery outbox is unnecessary for this bounded resend flow.

**Frontend boundary:** Configure a same-origin link to the existing `/employee/account` route with the proof in the URL fragment, removing it before ordinary telemetry or retained client state during future integration. P08 supplies backend state and confirmation contracts. P09 must resolve and wire the missing pending/result surface; no page or popup is added in P08. A link opening alone saves nothing. No secrets or address-proof URLs appear in logs.

## R4 — PostgreSQL state; one repairable Redis wakeup queue

**Decision:** Add BullMQ 5.81.5 and direct ioredis 5.11.1 for one withdrawal wakeup queue. Use Redis 7.4.11-alpine with no eviction; a disposable real Redis integration container can use a direct testcontainers 12.1.0 dev dependency (already installed transitively). Add lifecycle/configuration owners rather than a queue framework. API enqueue is best-effort after commit. A bounded periodic PostgreSQL scan repairs missing/current-version wakeups. Jobs contain only request ID and schedule version.

**Rationale:** Redis/BullMQ is a roadmap requirement and currently absent from manifests/compose. Fresh primary package metadata verified Node compatibility with Node 24 and the chosen BullMQ v5 dependency on ioredis 5.11.1. Choose the maintained v5 line rather than introducing v6's additional backend/adapter surface. Metadata compatibility is not installation or acceptance evidence. Worker connections require `maxRetriesPerRequest: null`; HTTP producers fail within bounded retries. Redis errors and graceful shutdown must be handled explicitly. PostgreSQL deadline/state/version is authoritative under queue loss, duplicates and restarts.

**Alternatives considered:** Queue-only state loses financial authority; a generic outbox/event bus adds scope; database scans alone omit the required queue boundary. BullMQ retry counts or expired leases cannot authorize a new transaction.

**Primary sources:** [BullMQ connections](https://docs.bullmq.io/guide/connections), [production settings](https://docs.bullmq.io/guide/going-to-production), [BullMQ 5.81.5 metadata](https://registry.npmjs.org/bullmq/5.81.5), [ioredis 5.11.1 metadata](https://registry.npmjs.org/ioredis/5.11.1), [official Redis image tags](https://hub.docker.com/_/redis). Keep the chosen Redis digest in future container configuration after verifying it at installation; no dependency or image was installed during PLAN.

## R5 — Shared clock and compatible financial lock order

**Decision:** Reuse `BusinessClock.initialWithdrawalDeadline`, `extendDeadline` and `normalizeNewDispatch` in `core/business-calendar/business-clock.ts`. Store counted `dueAt` separately from normalized `dispatchAt`, original deadline and schedule version. Read exact nonnegative remaining counted milliseconds from the same calendar; expose bounded integer text plus nonnegative display hours truncated toward zero to six fractional digits, clamped at zero. Display countdowns are not positive command durations or dispatch authority. Scan candidate IDs without retaining request locks, then enter the financial transaction boundary to discover one candidate. The protected signer alone takes the financial SIGNING/attempt/source-lane claim using `assertDispatchAdmission`; scheduler leases/wakeups cannot grant that authority.

**Rationale:** Existing lock order is admission/control/boot, sorted users, sorted wallets, sorted reservation allocations; withdrawal operations then lock sessions, policy, destination/proof, quote, request and attempt consistently. Locking a due request first with SKIP LOCKED inverts that order. Capture current time after the necessary locks. Existing restriction updates use an identity transaction and cannot nest the guarded ledger transaction; adapt their outer command to financial admission and reuse a same-transaction safe cancellation function.

**Alternatives considered:** A second calendar drifts at weekends/exclusive expiry. Flag-only restrictions permit send/refund races. An elapsed claim proves neither unsent nor failed. Ban/expiry must not prevent protected reconciliation of a previously accepted transfer.

## R6 — One protected payout attempt and treasury lane

**Decision:** Leave sweep-bound `TreasurySweep`/`TransferAttempt` unchanged. Add one unique `WithdrawalAttempt` per request and payout-owned intent, attempts, reconciliation, settlement and recovery responsibilities. Reuse low-level TRC-20 construction/signature/finality and protected storage helpers. Enforce one unresolved outgoing lane per configured network/token/treasury source with a partial unique index. Other accepted requests remain SCHEDULED.

**Rationale:** Concurrent workers must not sign against the same physical treasury liquidity/resource sample. The lane limits execution concurrency, not user eligibility or acceptance. It stays held through SIGNING/SIGNED/SUBMITTED/UNKNOWN, and closes only with verified final settlement or conclusive safe failure. UNKNOWN blocks subsequent outgoing treasury sends while its own reconciliation, reads, deposits and inbound sweeps continue. Before signing and same-byte rebroadcast, independently enforce maximum payout units, company fee/resource caps, latest source permissions/resources and recipient-specific simulation. Sample solidified token balance at or after the last completed lane's final block so stale provider data cannot reuse spent funds.

**Alternatives considered:** An in-memory mutex cannot survive independent workers/restarts. A multi-lane treasury budgeting engine is unnecessary for the MVP. Automatic top-ups, admin payout approval and employee network-cost deductions are excluded.

**Evidence:** Current `TronProvider.buildSweep`, `estimateSweep` and `broadcastSweep` already take source/recipient parameters; share those concrete transfer primitives without introducing a universal workflow. Installed TronWeb 6.5.1 signs locally. `TreasuryAttempts` establishes durable signed/archive/broadcast ordering but its service/schema remain sweep-owned. [TRON simulation](https://developers.tron.network/reference/triggerconstantcontract) and [fee limits](https://developers.tron.network/docs/set-feelimit) govern preparations, not final settlement.

## R7 — Retain bytes before any possible broadcast

**Decision:** Persist one validated unsigned object/TxID identity privately before local signing; competing preparation uses the committed winner. Retain immutable signed bytes locally, acknowledge exact encrypted off-host archive readback, then commit DB signed identity. Persist broadcast admission and UNKNOWN before I/O; acknowledge a matching recoverable broadcast-intent record before sending. Lost replies recover/reconcile that same object. No P08 replacement payment exists.

**Rationale:** A DB lease cannot establish that an earlier process did not sign/send. One immutable object permits crash recovery without rebuilding a new TxID. Add distinct encrypted envelope types `TREASURY_KEY`, `PAYOUT_SIGNED_ATTEMPT` and `PAYOUT_BROADCAST_INTENT`: existing sweep recovery parses all current SIGNED_ATTEMPT/BROADCAST_INTENT records as sweeps, so sharing those types would corrupt recovery routing.

**Alternatives considered:** Archive-after-send leaves an unrecoverable irreversible gap. A new attempt after timeout/expiry creates duplicate-payment risk. Do not fabricate a deposit key assignment for treasury: provision one protected encrypted treasury key through an owner-only operator input, derive the configured address, obtain independent recovery acknowledgement, and bind immutable identity in PostgreSQL. P08 implementation needs a concrete protected provisioning entrypoint; public API and scheduler never import its credentials.

## R8 — Final success, safe failure, and uncertainty

**Decision:** Verify original signed body, TxID, configured network/token/source/recipient/net, solidified canonical block membership and complete execution receipt independently of broadcaster acknowledgement. Success requires exact successful TRC-20 transfer evidence before one atomic ledger settlement. Implement automatic safe failure initially for independently verified canonical-final CHAIN_FAILED with the original call identity, failed result and no transfer logs. Proven complete noninclusion may close under C1 only when a dedicated validated proof verifier establishes coverage; the current provider does not establish that capability, so it remains UNKNOWN instead of guessing.

**Rationale:** TRON distinguishes broadcast response, solidified inclusion and execution status. Timeout, empty provider result, local expiration, disappearing evidence and expired worker claims do not prove safe nonexecution. A verified failed request releases original gross/sources once with zero fee; later payment is a new request under current terms and its own 72-hour schedule, with no 24-hour cooldown.

**Alternatives considered:** Trusting an explorer/TxID or broadcaster creates false success. Treating absence as failure creates payment-plus-refund. Automatically rebuilding an expired transaction contradicts clarified C1.

**Primary sources:** [Confirmation semantics](https://developers.tron.network/docs/confirmation-semantics), [safe retry and noninclusion coverage](https://developers.tron.network/docs/broadcast-and-rpc-errors). This design deliberately chooses conservative UNKNOWN when complete proof is unavailable.

## R9 — Extend admission and recovery, preserve independent authority

**Decision:** Reuse protected SIGNER, withdrawal scheduling in the existing worker lifecycle, API financial admission, and `p06_recovery_operator`. Extend role guards/grants by forward migration for actual owned tables/columns. Ordinary processes cannot acknowledge their own recovery authority. Reconciliation observations continue while dispatch is paused or it is a weekend; settlement/release still require admitted financial mutation. Recovery restores off-chain authority before unfencing, rather than bypassing the ledger fence.

**Rationale:** `runtime-control.ts`, `recovery.cli.ts` and `recovery-history.ts` already fence fresh boots/restores. Extend inventory to saved destination/proof authority and `WithdrawalDestinationAudit` rows, accepted quote/request/actions/allocation/settlement and payout attempts/key bindings. The digest assumes UUID table IDs; hash a singleton integer policy separately instead of appending it blindly. Missing post-snapshot history, custody or ambiguous attempts retains the fence. P08 proves isolated withdrawal recovery; deployed WAL/PITR/full-system restore stays P11.

**Alternatives considered:** Chain rescans cannot reconstruct off-chain acceptance, fees or cancellation. Generic runtime broad grants are fixture conveniences, not a production permission design. A new recovery platform or P11 deployment work exceeds P08.

## R10 — Real boundaries and honest prerequisites

**Decision:** Extend current Vitest unit/integration, real PostgreSQL 18.4 database tests, protected Linux/archive tests, and existing opt-in API testnet profile. Add real Redis restart/loss/duplicate tests. Payout testnet needs its own explicit admission/context mode within that profile: current setup requires a fresh P06 deposit assignment and sweep evidence. Extend sequencer ordering explicitly; an unknown payout file currently sorts before all recognized files.

**Rationale:** P06/P07 recorded evidence supports reuse, not fresh payout acceptance. Build scripts exclude test fixtures explicitly, so exclude new withdrawal Linux/testing helpers and retain built-entrypoint checks. Required focused/shared checks and testnet outcomes remain gates; full checkpoint verification belongs to P09. No test, migration, build, installation or transfer was run in PLAN.

**Alternatives considered:** Mock finality, in-memory balances or P06 sweep TxIDs cannot prove P08. A separate testnet framework duplicates existing fail-closed boundaries. An automatic separate CONVERGE prerequisite contradicts the prior explicit owner decision recorded in `specs/003-auth-account-frontend/plan.md`; required tests/reviews remain mandatory.
