# P01 Proposed Financial Data Model

**Status**: Design only; these financial models and guards do not exist yet.

The existing schema contains User and RefreshToken. Preserve both, their current
checks and refresh-token cascade. Implement the six models below through a new
forward migration owned by `packages/database`, following [plan.md](plan.md) and
[research.md](research.md). This document does not authorize schema/code changes.

## Storage and relationship rules

- Monetary fields use Prisma BigInt/PostgreSQL bigint in integer micro-USDT.
  Nonnegative values range from `0` to `9223372036854775807`; signed posting deltas
  use that maximum magnitude in either direction. Commands have positive amounts.
- All four wallet components and their derived sum must fit the nonnegative bound.
  SQL checks cast components to numeric before addition; percentage calculations
  and cumulative reconciliation sums may exceed bigint transiently.
- IDs are UUIDs; stored instants use the existing Timestamptz(6) convention.
  Currency is USDT only, without a multi-currency table or configurable currency.
- Financial owner/operation/posting/allocation/audit relationships use restrictive
  delete/update behavior. No account or parent deletion may erase financial history.
  Actor user references also remain restrictive; process actors use an explicit
  bounded process identity, never an invented user or anonymous fallback.
- One FinancialOperation belongs to one wallet. Declare and lock all participant
  wallets in sorted order within one outer transaction for a multi-wallet domain
  action, then create distinct per-wallet operations/business identities. The later
  domain owns its compound result/request identity; no participants JSON/table or
  financial batch framework is added.
- Operation `(id, walletId)` is additionally unique. Posting/opening/release links
  use composite references including walletId, preventing cross-wallet references.
  Named migration guards validate linked operation kinds and posting shapes where
  cross-table rules cannot be expressed as an ordinary CHECK.

## Wallet -> wallets

| Field                     | Proposed meaning and constraint                                    |
| ------------------------- | ------------------------------------------------------------------ |
| id                        | UUID primary key.                                                  |
| ownerUserId               | Required User FK; unique, at most one wallet per existing account. |
| availableNonReferralUnits | Nonnegative bigint, initially zero.                                |
| reservedNonReferralUnits  | Nonnegative bigint, initially zero.                                |
| availableReferralUnits    | Nonnegative bigint, initially zero.                                |
| reservedReferralUnits     | Nonnegative bigint, initially zero.                                |
| createdAt / updatedAt     | Server-derived creation/projection modification instants.          |

Total ownership is derived from the four components, without a redundant total
column. Creating these tables does not provision wallets or legacy balances.
P02 owns registration provisioning; P01 tests create controlled existing owners.

## FinancialOperation -> financial_operations

| Field                                    | Proposed meaning and constraint                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| id / walletId                            | UUID primary key and restrictive Wallet FK; unique composite pair.                                                            |
| kind                                     | CREDIT, PURCHASE_DEBIT, RESERVE, RELEASE or CORRECTION.                                                                       |
| businessNamespace / businessKey          | Bounded trusted source namespace/key; unique `(kind, businessNamespace, businessKey)`.                                        |
| intentHash                               | SHA-256 of explicit canonical consequential intent, stored as 64 hexadecimal characters.                                      |
| magnitudeUnits                           | Positive bounded bigint command magnitude; gross for reservation/release.                                                     |
| origin                                   | DEPOSIT, TASK_REWARD, REFERRAL_COMMISSION, PACKAGE_PURCHASE, WITHDRAWAL_RESERVATION, RESERVATION_RELEASE or ADMIN_ADJUSTMENT. |
| actorType / actorUserId / actorProcessId | USER or PROCESS; exactly its matching nonempty identity is present. User identity is a restrictive FK.                        |
| acceptedTerms / outcome                  | Explicit validated JSON snapshots, canonical decimal strings for money; no raw bigint, secrets or arbitrary provider payload. |
| createdAt                                | Server-derived accepted-operation instant.                                                                                    |

Insert a complete immutable operation/outcome after calculation under locks and
before its dependent writes, all inside the same transaction. There is no durable
pending/success-status update. Only committed operations become observable.
Outcome retains original source allocations and wallet snapshot; replay never
replaces it with current balances. Origin distinguishes events within each source
class. Corrections use ADMIN_ADJUSTMENT and a reference, never a fabricated receipt.
The recorded operation timestamp is exposed only after successful commit; it does
not measure PostgreSQL's actual commit instant.

The existing acceptedTerms JSON has a strict kind-specific reconciliation shape:
every operation records walletBefore (four canonical source/state amounts and
their exact derived total) after locks and before its effect. CREDIT also records
source; CORRECTION records source, CREDIT/DEBIT direction, reason and same-wallet
referenceOperationId; RESERVE records reservationId and its accepted eligibleSources
grant (a unique set of supported sources); RELEASE records that original reservationId.
Existing outcome retains walletAfter and the RESERVE/RELEASE original allocation/result state. These are
typed fields within existing JSON, not new columns/models or public outputs.
Server-observed walletBefore and eligibility grants are excluded from consequential
intent hashing and retained unchanged on replay; declared source, correction
direction/reason/reference and release reservation identity remain hashed intent.
Local acceptance snapshots permit consistency checks, not independent proof of
external events or past authority. Detailed checks are owned by
[ledger-service.md](contracts/ledger-service.md#reconciliation-errors-and-diagnostics).

## RequestIdentity -> financial_request_identities

| Field             | Proposed meaning and constraint                                                      |
| ----------------- | ------------------------------------------------------------------------------------ |
| id / operationId  | UUID primary key and restrictive FinancialOperation FK.                              |
| actorScope        | Canonical trusted USER UUID or PROCESS identity scope.                               |
| kind / requestKey | Operation kind and bounded supplied key; unique `(actorScope, kind, requestKey)`.    |
| intentHash        | Consequential-intent binding; must equal the referenced operation's accepted intent. |
| createdAt         | Server-derived alias creation instant.                                               |

Many aliases may reference one operation. Matching a business identity under a new
supplied key binds that alias without a new posting/domain effect/mutation audit.
A missing key needs no alias. The service checks current visibility before lookup
results are disclosed, and validates referenced kind/hash. A changed payload or
scope never retrieves another owner's private result. Alias bindings are immutable.
One compound domain key cannot alias several per-wallet operations.
Request-key syntax/bounds follow [financial-boundary.md](contracts/financial-boundary.md).

## LedgerPosting -> ledger_postings

| Field                                    | Proposed meaning and constraint                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| id                                       | UUID primary key.                                                                 |
| operationId / walletId                   | Composite restrictive FinancialOperation reference; wallet matches the operation. |
| source                                   | NON_REFERRAL or REFERRAL.                                                         |
| availableDeltaUnits / reservedDeltaUnits | Bounded signed bigint deltas; at least one is nonzero.                            |
| createdAt                                | Server-derived posting instant.                                                   |

Unique `(operationId, source)` permits at most one posting per affected source.
Kind/origin/business identity/actor are retained by the immutable operation link.
P01 CREDIT permits DEPOSIT/TASK_REWARD with NON_REFERRAL or REFERRAL_COMMISSION
with REFERRAL; ADMIN_ADJUSTMENT is reserved for CORRECTION in this phase.
Credits have positive available-only deltas; purchase debits negative available-only
deltas. Reserve pairs equal negative available/positive reserved; release is their
exact inverse. Corrections change available funds in one explicit source only.
Named insert guards reject wrong linked kinds/shapes; operation aggregate amounts,
source order and complete posting sets are enforced by the transactional service
and checked read-only against recorded acceptance evidence during reconciliation.
An individually valid row or matching wallet aggregate is not proof that every
operation has its complete postings or the correct magnitude.

## ReservationAllocation -> reservation_allocations

| Field                                         | Proposed meaning and constraint                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| id / walletId                                 | UUID primary key and restrictive Wallet identity.                                                                      |
| openingOperationId                            | Unique composite same-wallet reference to a RESERVE operation.                                                         |
| grossUnits / nonReferralUnits / referralUnits | Immutable original positive gross and nonnegative source allocation; numeric-cast source sum equals gross.             |
| state                                         | ACTIVE or RELEASED; initially ACTIVE.                                                                                  |
| releaseOperationId / releasedAt               | Both absent for ACTIVE, both present for RELEASED; release operation unique, restrictive and same-wallet RELEASE kind. |
| createdAt                                     | Server-derived reservation instant.                                                                                    |

The only P01 transition is conditional ACTIVE -> RELEASED. Identity, original
amounts and creation time never change; state cannot reopen and release fields
cannot be replaced. Release restores exactly these amounts under the owning
domain's safe-state authorization in the same transaction. Changed eligibility
does not rewrite sources; uncertainty cannot authorize release. P10/P11 extend
their own workflow and eventual consumption/settlement, outside this model's P01
implementation. ACTIVE allocation source sums equal wallet reserved components.

## AuditRecord -> financial_audit_records

| Field                                    | Proposed meaning and constraint                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| id / operationId                         | UUID primary key; unique restrictive operation FK for its required successful mutation audit.                                         |
| actorType / actorUserId / actorProcessId | Trusted actor/process identity with the same identity-shape/FK rules as the operation.                                                |
| action / createdAt                       | Known operation action and server-derived instant.                                                                                    |
| reason / referenceOperationId            | Bounded reason and restrictive original-operation reference required for CORRECTION; same-wallet reference verified by a named guard. |

Audit actor/action must match the accepted operation. Audit has no unrestricted
metadata blob. Mutation audit commits with financial/domain effects; denied calls
and retries do not create another successful mutation audit.

## SQL guards, reconciliation and upgrade evidence

Named SQL checks enforce monetary/total/allocation bounds and actor/state shape;
FKs/unique indexes enforce ownership, identities, source posting cardinality and
single release. Guards reject UPDATE/DELETE of postings, operations, aliases and
audit; allocation guards reject DELETE and allow only its documented release transition. Separate
statement-level TRUNCATE guards protect all retained financial history. Guards
cannot prevent a database superuser disabling them; deployment privileges remain
later work. Tests retain records until their isolated database/container is dropped.

Read-only RepeatableRead reconciliation starts with the fixed SET TRANSACTION READ
ONLY statement before authority/data reads, then uses one authorized wallet snapshot.
It compares exact source/state posting sums with the wallet and ACTIVE allocations;
numeric/text aggregates and BigInt parsing retain cumulative precision. It also
starts from every FinancialOperation (LEFT JOIN postings, including zero-row sets)
and checks the complete per-kind source/delta set and magnitude, recorded source and
origin, correction direction/reference/reason, original reserve/release allocation
and opening/release links/state, required matching audit and immutable outcome.
Applying postings to walletBefore must reproduce the saved walletAfter exactly;
the locally recorded before-balances/eligibleSources permit source-order checks
without inventing timestamp-based commit ordering or current historical eligibility.
Original RESERVE outcomes retain ACTIVE even after a later valid RELEASED allocation.
The [internal contract](contracts/ledger-service.md#reconciliation-errors-and-diagnostics)
defines exact per-kind checks and safe discrepancy fields. Report every operation
discrepancy even when aggregate components agree; never repair history/projections.
Canonical decimal diagnostic values preserve exact cumulative aggregates/differences
beyond the single-movement bound without applying the bounded posting-delta schema;
individual stored components and movements retain their original bounds.
No business-calendar table, generic accounting engine or P11 settlement is added.

Fault evidence uses new fixture-owned INSERTs that retain row bounds, actor/origin,
FKs, uniqueness and posting shapes, but deliberately omit postings/audit or mismatch
operation magnitude/saved outcome where those complete-set checks belong to the
service. Examples include no-posting CREDIT history with unchanged zero projection,
10 USDT declared versus 9 USDT posted/projected, and offsetting 9/11 postings for
two declared 10 USDT credits. Do not UPDATE/DELETE retained history or disable any
guard. If an insert guard rejects a proposed fault, verify its rejection rather than
weaken it; other admissible faults must still be detected without reconciliation writes.

Verify fresh migration, populated legacy-account/refresh upgrade, repeated deploy,
auth checks/cascade, real constraint/FK failures, forbidden history changes and
independent-connection transaction/release races. Extend exact inventories rather
than remove auth assertions. No such migration or test execution is claimed here.
