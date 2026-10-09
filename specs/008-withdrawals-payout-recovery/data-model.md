# P08 Data Model

This describes proposed PostgreSQL/Prisma changes, not existing schema or executable migrations. Existing ownership remains `packages/database/`; API domain ownership is `apps/api/src/modules/withdrawals/`. See [research](research.md) for decisions and the explicitly approved single-label shared-ledger compatibility exception. All financial writes use the existing admitted ledger transaction boundary.

## Representation and relationships

Money is bounded signed PostgreSQL bigint micro-USDT, positive for gross/net and nonnegative for fee/source magnitudes. JSON money is canonical decimal text through existing shared schemas. Fee is `floor(grossUnits * feeBps / 10000)` and gross equals fee plus net; no floating point. Times are UTC instants representing the shared Asia/Baghdad calendar; versions are positive integers. Foreign keys use RESTRICT for immutable financial/custody relationships.

The request binds employee (`User.role = USER`), wallet, unique quote, unique original `ReservationAllocation`, destination version and unique payout attempt. Composite foreign keys/unique keys and deferred constraints must prevent a request, quote, allocation, attempt or operation from belonging to different employees/wallets. Public DTOs deliberately omit hashes, signatures, archive payloads and protected recovery inputs. Read countdowns expose exact bounded nonnegative `remainingCountedMilliseconds` integer text and `remainingCountedHours` display text truncated toward zero to at most six fractional digits; both derive from the same shared server duration and clamp at zero. Display hours are not dispatch authority and cannot use the positive command-duration schema.

## WithdrawalDestination

One UUID row per employee (`employeeId` unique), created on first accepted proof issuance. Fields:

- Confirmed `network`, canonical TRON `address`, positive `addressVersion`, `confirmedAt`, all nullable together before the first confirmation. Confirmed address/version cannot be changed by the employee. Future P10 replacement must use the P08 same-transaction safe cancellation boundary and an audited authorized version change.
- One pending `proofId`, `proofHash`, `pendingAddress`, `proofGeneration`, `issuedAt`, `expiresAt`, and `nextIssuanceAt`; proof authority fields are populated/cleared together. Hash is unique; no raw token is retained. The pending exact address and generation belong to this employee and action.
- Delivery fact tied to proof ID/generation: NOT_ATTEMPTED, UNKNOWN, ACKNOWLEDGED or REJECTED, plus bounded timestamps/error category. Late delivery results update only the matching generation. Delivery is not proof consumption or confirmation.
- Row concurrency `version` and `updatedAt`. Positive generations never regress. `WithdrawalDestinationAudit` retains committed issuance/consumption identities and safe results without bearer tokens, hashes or full email URLs.

At accepted issuance, compute and persist `expiresAt` and `nextIssuanceAt` from validated proof TTL and resend-cooldown settings, initially 1800 and 60 seconds. Later configuration changes do not rewrite these saved instants.

Accepted issuance locks the employee/destination, verifies no confirmed address, enforces current authority, validation and persisted cooldown, commits replacement pending authority, then performs email I/O outside the transaction. Rejected issuance changes no authority. Successful consume checks current session plus exact latest hash/generation/expiry, saves the first address/version and clears every pending-authority field atomically. Concurrent issuance/consume has one committed winner. Lost consume response is resolved by reading saved state. A consumed token does not become a second save command.

## WithdrawalDestinationAudit

Small withdrawal-owned append-only UUID row for committed `PROOF_ISSUED` (including resend) or `PROOF_CONSUMED` events before any request exists. Fields are `id`, `destinationId`, authenticated `actorUserId`, event kind, `proofId`, positive `proofGeneration`, exact `network/address`, server `occurredAt` and `committedDestinationVersion`. The actor must equal the destination employee. No request foreign key, bearer token, proof hash, full email URL or arbitrary payload belongs here.

Enforce destination ownership, unique `(destinationId, proofGeneration, kind)` and unique `(destinationId, committedDestinationVersion)`, with consumption matching the committed issuance's proof ID/generation/address. Append the issuance event in the same transaction that replaces pending authority; append consumption in the same transaction that saves the first address and clears pending authority. Audit-write failure rolls back that whole transition. Rejected commands, replay and losing races create no additional event. Delivery results remain generation-bound destination facts and never create consumption authority or rewrite these events.

`WithdrawalDestination` remains the sole current proof authority. Retain these audit rows with RESTRICT relationships and append-only SQL protection; include them in trusted post-snapshot history and the explicit UUID recovery inventory/digest. They require no public audit endpoint or generic audit framework, and do not extend the existing administrator identity-audit matrix.

## WithdrawalPolicy

One small versioned singleton (`id = 1`) with `minimumGrossUnits`, `maximumGrossUnits`, `freeFeeBps`, `version`, `updatedAt` and audited updater identity where changed. Seed 16000000/500000000/2100. Bounds satisfy `0 < min <= max <= bigint bound`; fee bps is 0–10000, with payable net separately required by quotes. Fixed P08 scheduling policy remains 72 counted hours, Asia/Baghdad, excluded weekdays 6/7; it is saved in accepted terms rather than made into a settings engine.

Paid-active fee authority is the existing subscription's saved `withdrawalFeeBps`; Free/expired uses this policy. There is no Free package persistence row today. P08 introduces no settings endpoint/UI; P10 must use this same authority for future Free fee/bounds changes. Initial seed is idempotent and does not overwrite existing configured values on upgrade. Policy history/configuration audit joins restore authority; do not append its integer ID to the UUID-only recovery digest table list.

## WithdrawalQuote

UUID; `employeeId`, `walletId`, `destinationId/addressVersion`, `policyVersion`, `createdAt`, immutable `expiresAt` (creation plus the validated configured quote TTL, initially 600 seconds), `grossUnits`, `feeBps`, `feeUnits`, `netUnits`, `termsHash`, immutable `quotedTerms` and eligibility snapshot. Store effective membership, subscription ID/version/saved fee where paid, exclusive expiry, unreserved available source components and candidate NON_REFERRAL/REFERRAL funded allocation; accepting allocation totals gross, while a nonaccepting preview may be partially funded as described below. Save preview counted deadline/normalized dispatch time with calendar policy.

Quotes are persisted previews, not reservations. Later TTL configuration changes do not rewrite a persisted quote expiry. A nonaccepting insufficient-funds preview uses the existing funded-allocation shape with components summing to the available funded total (at most gross), plus canAccept=false and requiredTopUp. It must not misuse the exact-gross source-allocation schema. An accepting quote/accepted request has source allocation exactly gross. At acceptance, reread authority and material facts under locks; a blocked quote requires a fresh accepting quote. Reject expired/materially stale quote rather than silently change money, recipient, fee or source allocation. Passage of time within an unchanged membership is expected; exclusive expiry crossing changes eligibility and invalidates a paid quote. Actual acceptance time establishes the saved original deadline. UUID quote identity remains permanent even after its request reaches a safely closed state; another/missing HTTP key cannot reuse it for a second request.

## WithdrawalRequest

UUID; `quoteId` unique, `employeeId`, `walletId`, `reservationId` unique, `destinationId`, immutable `recipient/network/addressVersion`, `grossUnits/feeBps/feeUnits/netUnits`, `acceptedTerms`, `termsHash`, original eligibility and original source allocation, `acceptedAt`, `originalDueAt`, original schedule policy. Mutable fields are `state`, optimistic `version`, `dueAt`, normalized `dispatchAt`, `scheduleVersion`, optional current attempt identity, bounded `nextCheckAt/blocker`, final operation references and `finalizedAt`.

States: SCHEDULED, SIGNING, SIGNED, SUBMITTED, UNKNOWN, COMPLETED, REJECTED, CANCELLED, FAILED. A partial unique index on employee ID includes every active state (all nonterminal states), including UNKNOWN. Resource/provider retry is a blocker on an active request, not a terminal or guard-escaping state. Index `(state, dispatchAt, nextCheckAt)` for bounded repair scans and `(employeeId, acceptedAt DESC, id DESC)` for history; admin uses bounded state/employee filters.

Initial acceptance commits request, original gross RESERVE operation, allocation, source projections and audit in one transaction. Original terms/recipient/source allocation remain immutable. Extension increments request and schedule versions and appends an action, adding exact positive counted duration to current dueAt, then recomputes dispatchAt; it does not reset originalDueAt. SCHEDULED with no attempt is the only employee-restriction/admin safe-unsent transition boundary.

`nextCheckAt` is nullable operational discovery/retry metadata, not a financial deadline: acceptance/extension sets it null; due current-version wakeup/worker scan may hint null to now while SCHEDULED/no attempt, never shorten a future backoff. Only protected SIGNER creates SIGNING/attempt/lane. Its fast hinted scan and periodic authoritative unhinted scan make Redis/worker loss repairable. Exclude this hint and discovery leases from financial authority digest/inventory fields; use an explicit withdrawal-owned digest projection rather than hashing queue noise. Original deadlines/state/terms/action identities remain recoverable authority.

## WithdrawalAction

Append-only UUID action ID, request ID, authenticated actor user or protected process identity, operation kind, payload fingerprint, expected/committed request version, occurredAt, before/after state/deadline/schedule version, confirmation/reason where required, and optional financial operation ID. Unique actor/operation/client-key aliases bind payload; action ID is the permanent transition identity for extension/rejection replay. Preserve safe bounded audit text in this domain row rather than adding a rejection reason to generic non-correction ledger audit.

Actions cover ACCEPT, EXTEND, REJECT, RESTRICTION_CANCEL, FUTURE_DESTINATION_CANCEL, CLAIM, BROADCAST_ADMISSION, COMPLETE and SAFE_FAIL. P08 implements the cancellation primitive, not a P10 address replacement endpoint. A same-key different payload conflicts; a new key with a stale expected version cannot repeat an extension. Restricted current employee status does not prevent an authorized protected process from finalizing an earlier accepted transfer.

## ReservationAllocation and financial history

Keep original employee/wallet, gross, nonReferralUnits/referralUnits and RESERVE identity unchanged. Group A reuses ACTIVE→RELEASED. Group B adds SETTLED with unique nullable `settlementOperationId`, `settledAt` and matching operation/wallet foreign key. State-dependent checks require:

| State    | Required terminal relation                        | Financial effect                                                                                      |
| -------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ACTIVE   | No release or settlement relation                 | Original gross remains reserved                                                                       |
| RELEASED | Exactly one matching RELEASE; release timestamp   | Available rises and reserved falls by identical original source components                            |
| SETTLED  | Exactly one matching SETTLE; settlement timestamp | Available unchanged; reserved falls by identical original source components; ownership falls by gross |

A successful SETTLE has one gross-magnitude operation with origin WITHDRAWAL_SETTLEMENT, saved withdrawal terms, net/fee components, request/attempt/TxID and canonical evidence identity. It is one debit, with no second net/fee debit and no network-cost employee posting. Source-specific reserved deltas sum to `-gross`. Existing ownership-delta history totals therefore show one gross debit. Old RESERVE outcome/reconciliation remains valid after its allocation becomes SETTLED. Extend current read/detail schemas additively with nullable withdrawal facts, preserving package `savedTerms`.

Safe unsent rejection/cancellation and proved failed payout use original-source RELEASE exactly once. FAILED never records a platform fee. A duplicate observation or command returns the existing terminal outcome, not another operation. Request ID is the business key for SETTLE/RELEASE in distinct namespaces; quote ID is the RESERVE business key. API idempotency aliases are supplementary.

**Approved compatibility exception:** On 2026-10-08 the owner approved exactly `WITHDRAWAL_SETTLEMENT: "سحب مكتمل"` in the existing frontend ledger map. Add/verify that single entry with the Group B enum/export, preserving all other labels/presentation; no web source changes in PLAN. Never filter settlement out of wallet/finance history or mislabel it. Group A retains existing reserve/release contracts.

## TreasuryPayoutKey binding

Protected immutable UUID record binding configured network, token contract, treasury address, encrypted record identity/content hash, independent recovery acknowledgement, createdAt and protected operator audit. One active binding per configured source; payout attempts reference their fixed binding. No private plaintext key is stored in this public ORM model. Local/off-host encrypted envelope bytes and decryption escrow stay in existing protected private-file owners, outside repository/uploads/proofs.

Provisioning verifies the input key derives the exact configured treasury source and obtains acknowledged archive/readback before DB binding. API/scheduler cannot create this binding, export keys or load its file paths. No fabricated employee deposit assignment is used. A new distinct TREASURY_KEY envelope is included in key inventory and independent recovery authorization.

## WithdrawalAttempt and source lane

UUID; `withdrawalId` unique (one original attempt), composite request/employee/wallet binding; immutable intent kind, request/owner, network/token, treasury key/source, recipient/version, gross/fee/net, accepted terms hash and intent hash. Mutable stage/version/next reconciliation time and bounded blocker; protected immutable unsigned identity/TxID, protected signed record ID/hash/acknowledgement, broadcast intent ID/hash/acknowledgement, recorded initial solidified floor and timestamps. Public APIs expose only safe TxID/finality facts after durable identity is established.

Attempt stages: PREPARING, SIGNED, BROADCAST_INTENT, SUBMITTED, UNKNOWN, CONFIRMED_SUCCESS, CHAIN_FAILED. The request becomes SIGNING when the protected signer atomically claims its unique attempt/lane under current dispatch admission; scheduler discovery leases cannot create private attempts, take the lane or make that transition. A partial unique index `(network, tokenContract, treasurySource)` includes every unresolved attempt stage. That lane survives claim expiry and process restarts; it closes only in the same transaction as final settlement or proved failed release. There is no replacement attempt counter or second payment workflow.

Track the last completed source final block in durable payout-source state/key binding, monotonically, so a new lane requires a coherent solidified token-balance floor at least that recent. Last provider sample is evidence, never employee money. Resource sufficiency and independently configured company fee/cost caps are rechecked before signing or exact-byte rebroadcast. Requests may wait SCHEDULED behind the lane; UNKNOWN prevents new outgoing payouts, not observations/deposits/sweeps.

Protected preparation persists one validated unsigned transaction/TxID winner before local signing. Retain signed object locally and in acknowledged PAYOUT_SIGNED_ATTEMPT encrypted recovery record before marking signed authority. Broadcast admission commits before send; PAYOUT_BROADCAST_INTENT acknowledged exact bytes precede network I/O. Reuse immutable retained bytes and TxID after lost replies. Claim leases and queue retries never replace transaction identity. If committed preparation identity survives but its original bytes cannot be recovered before signed archive acknowledgement, retain UNKNOWN/reservation/source lane and RECOVERY_UNAVAILABLE, with restore still fenced; only matching original retained/signed bytes resolve that gap, never a fresh body/TxID.

Canonical outcome evidence records original call/body/signature identity, network/token/source/recipient/exact net, solidified block ID/height/membership, execution status, required transfer log identity for success, observation identity, final receipt costs, verifier and observedAt. Success requires matching successful exact transfer. CHAIN_FAILED requires matching original failed solidified execution and no transfer logs; contradictory/missing evidence stays UNKNOWN. Empty provider result or local expiry is not a stored conclusive proof. This version supports that canonical-failure proof; any future complete-noninclusion proof must have a separately tested explicit verifier and historical coverage before it is admissible. Company-incurred receipt costs remain separate from employee fee/net.

## State transitions and atomic guards

| From                       | Trigger                                         | To                   | Guard/effect                                                                                                                  |
| -------------------------- | ----------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| No request                 | Accept current quote                            | SCHEDULED            | Current authority/eligibility; one active request; atomic gross RESERVE/snapshots/audit                                       |
| SCHEDULED                  | Admin extension                                 | SCHEDULED            | No attempt; expected version; positive exact counted hours; confirmation/reason; schedule revision                            |
| SCHEDULED                  | Admin rejection                                 | REJECTED             | Safe unsent; confirmation/reason; atomic original RELEASE                                                                     |
| SCHEDULED                  | Ban/withdrawal block/future address replacement | CANCELLED            | Same transaction with restriction/replacement command; safe unsent; atomic original RELEASE                                   |
| SCHEDULED                  | Due protected claim                             | SIGNING              | Current due/schedule, weekday, restrictions, dispatch admission, original destination version, unique attempt and source lane |
| SIGNING                    | Retained signed/archive identity                | SIGNED               | One unsigned/signed object; protected acknowledgement; no financial consumption                                               |
| SIGNED                     | Durable broadcast admission                     | UNKNOWN              | Current admission, original intent, matching archived broadcast intent before any send                                        |
| UNKNOWN/SUBMITTED          | Acknowledgement/observation                     | SUBMITTED or UNKNOWN | No terminal rights; original bytes/TxID unchanged; no release                                                                 |
| Any potentially live stage | Matching canonical-final success                | COMPLETED            | Admitted protected transaction; original allocation SETTLE, evidence and final state atomically                               |
| Any potentially live stage | Matching canonical-final failed execution       | FAILED               | No conflicting live attempt; original allocation RELEASE, zero fee, evidence/final state atomically                           |

Only terminal completed/safely released requests free the employee active-request guard. After FAILED a later request needs a fresh quote, current limits/eligibility/fee and a new 72-counted-hour schedule; there is no 24-hour cooldown. Unsupported evidence remains active and reserved. No in-flight admin rejection/employee cancellation/redirection/manual completion or hold state exists.

## Lock order and external I/O

Use existing ledger order: shared financial-admission/control/current boot lock → sorted users → sorted wallets → sorted allocations. Then consistently acquire affected sessions, singleton policy, destination, quote, request, payout source/key binding and attempt in deterministic order. Lock employee and any admin actor consistently; capture event time and reread current authority after locks. Due scans read IDs without retaining request locks, then claim one through that order. Do not lock request SKIP LOCKED before entering the ledger service.

Restriction updates currently enter `runIdentityTransaction`; do not nest a ledger transaction. Adapt the outer withdrawal-aware command to the financial boundary and reuse a same-transaction cancellation helper. Restriction flags/session revocation/audits and safe release commit together. If claim has already won, flags change but original in-flight money stays reserved. Public acceptance/rejection checks current actor authority; protected success/failure resolution checks process/request/attempt authority regardless of subsequent employee ban/expiry.

Network/provider/email/private-file processing runs outside PostgreSQL transactions. A short transaction records a conditional durable transition, external work processes that identity, and a short transaction acknowledges only its matching winner. No held DB lock spans broadcast, SSH archive, email or TRON queries.

## Migration and restore boundaries

Group A forward migration adds destination/destination-audit/policy/quote/request/action tables, source/terminal/immutability constraints and current reserve/release domain guards. Group B uses a committed enum-only migration first, then SETTLE/SETTLED allocation/evidence/attempt/key/lane and protected-role guards. Never edit applied P01/P06 migrations. Seed policy once; preserve historic rows/IDs and verify a populated predecessor upgrade in actual PostgreSQL. Add indexes, current SQL origin/posting/audit guard updates and append-only protection, with deferred domain checks triggered from each dependent write side. Direct SQL must not release a potentially live attempt or settle without verified outcome authority.

Reuse existing runtime admission fence and least-privilege roles. API owns first-address, quote, accept, scheduled administration and safe release only; scheduling worker owns bounded discovery/wakeup without key access; protected signer owns validated attempt/sign/broadcast and narrowly authorized settlement/safe failure; independent recovery operator restores inventory while fenced and acknowledges current generation only after full authority verification. Table/column grants must be explicit, with real role-denial tests.

Restore inventory includes policy/configuration history; destination/latest pending proof authority and `WithdrawalDestinationAudit` rows; immutable quotes/accepted requests/actions/deadlines/versions; original reservations and ledger settlement/release; payout-source key binding; original unsigned/signed/archive/broadcast identity and final evidence. Transient queue deliveries/leases are excluded from financial truth. Extend the existing history digest with explicit UUID tables and separate singleton policy handling. Recover required post-snapshot off-chain commits from trusted history and independent archive before admitting mutation; never invent accepted terms/reservations from chain transactions alone. Missing/conflicting inventory retains the fence. Observation continues while fenced; ordinary financial mutation does not bypass admission. P11 owns deployed WAL/full-system restore and release.
