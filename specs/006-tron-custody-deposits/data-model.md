# P06 Data Model

**Status**: proposed design, not migrated schema. Existing account/wallet/ledger/audit models and financial history are retained. Ownership: `packages/database/prisma/schema.prisma` and proposed forward migration `20261006000000_p06_tron_custody_deposits/migration.sql`. See [plan](plan.md), [research](research.md) and [runtime contract](contracts/custody-runtime.md).

## Shared representations

- IDs are UUIDs unless a canonical chain identity is specified. UTC instants are PostgreSQL timestamps/Prisma DateTime; public instants are ISO strings. P06 deposit credit has no Baghdad workday restriction.
- Network is explicit (`TRON_MAINNET`, `TRON_SHASTA` or `TRON_NILE`) and pinned to configured genesis identity/provider/token. An address never supplies network authority. Controlled tests reject MAINNET.
- Store addresses as normalized TRON addresses with validated Base58Check/hex equivalence at private boundaries; do not compare unvalidated case-folded Base58 values. TxID is canonical 64-character lowercase hexadecimal; raw logIndex is nonnegative integer.
- Amounts use existing bounded bigint micro-USDT: positive receipt/grant/sweep units up to 9223372036854775807; every wallet component and total must remain representable. Contract uint256 is decoded without Number conversion; unsupported precision/overflow is unresolved without partial credit. Public USDT uses existing canonical strings, e.g. `1.000001`.
- Company network-cost units are exact integer SUN/TRX with separately named fields; they never enter the employee USDT wallet. Immutable records keep canonical payload/evidence hashes and server actor/time. Private encrypted envelope paths/bytes are never wire fields.

## Existing models reused

`User`, auth-session records, `Wallet`, `FinancialOperation`, `RequestIdentity`, `LedgerPosting`, `AuditRecord` and reservation/source projections remain their current owners. Ledger methods receive the same transaction client for domain writes. Account lifecycle does not cascade deletion of financial/address history. P06 does not alter subscription/referral/task or withdrawal policies.

Keep financial kind CREDIT and origin DEPOSIT for verified inbound credits. New grants use CREDIT and existing ADMIN_ADJUSTMENT origin, fixed NON_REFERRAL. Existing CORRECTION remains a distinct same-wallet-reference/source-specific operation. No shared financial enum value or historic snapshot rewrite is needed.

## DepositAddressAssignment (FR-007-011)

| Field/group                                                                            | Meaning                                                                                                                                |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `employeeId`, `walletId`, `network`                                              | Stable provisioning/ownership identity; employee wallet linkage must agree.                                                            |
| `state`, `version`, `createdAt`, `readyAt`                                             | REQUESTED / KEY_STORED / RECOVERY_ACKED / READY; readiness is independent of on-chain activation.                                      |
| `address` (nullable until generated), `keyRecordId`, `keyEnvelopeDigest`, `keyVersion` | Public binding and protected-record metadata; no key/ciphertext here.                                                                  |
| `recoveryAckId`, `recoveryDigest`, `recoveryAcknowledgedAt`                            | Matching acknowledged durable off-host record required for READY.                                                                      |
| `leaseOwner`, `leaseUntil`, `nextAttemptAt`, `lastErrorCode`                           | Conditional bounded coordination/retry; a lease never authorizes key replacement.                                                      |
| `activationState`, `resourceCheckedAt`                                                 | Separately observed UNKNOWN / INACTIVE / ACTIVE and freshness, not publication/credit permission.                                      |
| `scanBoundaryBlockNumber`, `scanBoundaryBlockId`, `scanBoundaryTimestamp`              | Conservative solidified chain boundary captured before key generation, retained for inclusive replay independently of host-clock skew. |

Constraints: unique `(employeeId,network)` and `(network,address)` when address is present; valid USER/wallet ownership checked transactionally and linked by FK/composite consistency. Recovery/key binding and address are set once, then immutable; key-version metadata advances only after acknowledged rotation to the same public address. READY requires exact acknowledgement/digest/address agreement. No hard deletion/reassignment; no employee-lifecycle cascade. Index provisioning state/retry/lease and READY scan selection.

Provisioning transitions use current state/version. Resuming REQUESTED first looks for the stable local/off-host record ID. Resume KEY_STORED/RECOVERY_ACKED by validating the same envelope and binding. Tamper/missing record yields safe error/retry/fence, never another published key. Different employees never share an address. A recovery import can reconstruct an assignment from authenticated archived binding only while fenced and after matching financial/account history.

## Protected recovery objects (FR-006-007/011/029/033)

These are encrypted signer/recovery-host files, **not** API-readable tables. Immutable object types are KEY_ASSIGNMENT, SIGNED_ATTEMPT and BROADCAST_INTENT. Envelope fields: format/key version, stable object ID, random nonce, authenticated context, ciphertext and tag; digest covers the complete serialized envelope. KEY_ASSIGNMENT encrypts the key and complete immutable assignment/employee/wallet/network/address/chain-scan-boundary record. SIGNED_ATTEMPT encrypts the actual returned signed object plus complete immutable sweep intent/policy snapshot/operator identity/reason/source claim/timestamps and attempt metadata, not merely a hash/IDs. BROADCAST_INTENT retains its admission/control/observation-boundary record. Context binds these contents to the stable identities. Decryption rederives/validates address/TxID and permits post-snapshot metadata/claim recovery only after corresponding original account/financial history is recovered.

The helper publishes without replacement and acknowledges file+directory durability/readback. Same ID/digest returns its prior acknowledgement; changed bytes conflict. GET/LIST are bounded and allow recovery of objects missing from a stale database. Rotated envelopes have new immutable versioned IDs; retain required old versions/decryption authority until verified migration/recovery completes. No nightly-backup gap is accepted for published addresses or broadcast attempts.

## DepositCandidate (FR-012-020)

| Field/group                                                                  | Meaning                                                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`, `network`, `transactionId`                                             | Unique `(network,transactionId)` discovery work; verifier enumerates all raw logs/owned recipients.         |
| `firstObservedAt`, `lastObservedAt`, `observedBlockTime`                     | Hints; do not establish finality or amount.                                                                 |
| `state`, `version`                                                           | PENDING / VERIFYING / UNRESOLVED / ACCOUNTED / INELIGIBLE / CONFLICT.                                       |
| `leaseOwner`, `leaseUntil`, `nextAttemptAt`, `attemptCount`, `lastErrorCode` | Bounded claims/retry/recovery; count is not proof of finality.                                              |
| `canonicalEvidenceDigest`, `verifiedAt`, `accountedAt`                       | Verified receipt digest/outcome; ACCOUNTED only when each eligible raw log has its valid receipt/operation. |

Unique identity, status/nextAttempt/lease index, minimal bounded provider projections; never retain secret-bearing URLs/raw responses. INELIGIBLE needs canonical evidence of no eligible transfer; missing receipt or disappearing observations stay UNRESOLVED. Conflicting evidence is CONFLICT and preserves committed receipts. Expired worker leases resume checking persisted receipts. Already credited logs are immutable; uncredited logs can complete later after controlled financial failure.

## DepositScanProgress (FR-019-020)

One progress row per assignment and mode (HOT / HISTORICAL), with `id`, `assignmentId`, `mode`, `cycle`, `windowFrom`, `windowTo`, `historyBoundary`, `nextWindowFrom`, `fingerprint`, `queryPolicyHash`, `version`, `leaseOwner/Until`, `nextAttemptAt`, `lastCompletedAt`, `lastErrorCode`. Timestamp bounds are fixed while paginating; fingerprint is a bounded opaque string, not a next-page URL.

Constraints/indexes: unique `(assignmentId,mode)`, noninverted nonnegative window bounds, bounded fingerprint, state/version conditional updates, due/lease scan index. Historical boundary is the retained conservative chain timestamp captured before generating the address, not host provisioning time; every complete historical cycle starts another. Hot scan does not retire old history. Inserting/upserting candidates and advancing the page checkpoint are one transaction; processing receipts is another. Expired/invalid fingerprint restarts the same bounds. Inclusive overlap deduplicates equal-time/boundary events. Pending candidates are never deleted on cursor advancement. Provider retention coverage is an acceptance prerequisite.

## DepositReceipt (FR-012-018)

| Field/group                                                                                                     | Meaning                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`, `network`, `transactionId`, `logIndex`                                                                    | Immutable unique canonical event identity. logIndex is position in original complete raw `log[]`.   |
| `assignmentId`, `walletId`, `tokenContract`, `sender`, `recipient`, `amountUnits`                               | Verified ownership/token/movement. Assignment recipient/network/wallet must agree.                  |
| `blockNumber`, `blockId`, `blockTimestamp`, `executionResult`, `finalityPolicy`, `verifiedAt`, `evidenceDigest` | Solidified successful canonical evidence; not an elapsed confirmation counter.                      |
| `financialOperationId`, `recordedAt`                                                                            | Unique one-to-one existing CREDIT/DEPOSIT operation; employee history uses committed recorded time. |

Constraints: unique `(network,transactionId,logIndex)` and operation link; positive representable amount, nonnegative raw index/block height, consistent assignment/token/wallet. Linked operation must be matching CREDIT/DEPOSIT and its NON_REFERRAL posting/amount/audit must agree. Immutability prevents update/delete of consequential receipt evidence. Deferred relationship checks where necessary permit all dependent rows in one transaction and reject partial committed state. Receipt/operation/source/audit are committed together, without external I/O.

`blockTimestamp` is canonical block inclusion time. `verifiedAt` is the server instant of successful canonical-final verification whose evidence created the committed receipt, and is the exact source for public `confirmedAt`; it does not measure when the network first finalized the block. `recordedAt` equals the linked `FinancialOperation.createdAt`, the server-assigned financial recording instant committed with the receipt, not the database's actual commit timestamp. Verification may precede recording. The winning committed receipt retains both instants; concurrent repeats/replay use its stored values. History filters/sort use `recordedAt`. ManualCredit retains the same financial-recording meaning without a finality timestamp.

Replay compares identity and consequential canonical evidence before returning prior ledger result. Missing matching receipt or changed evidence yields unresolved/conflict; never fabricate/overwrite history. History index `(walletId,recordedAt DESC,id DESC)` and administrative `(recordedAt DESC,id DESC)`; add token/network/filter indexes only when actual query plans justify them.

## ManualCredit (FR-023-025; C1)

Fields: `id` (durable actionId), `walletId`, `employeeId`, `actorUserId`, `amountUnits`, fixed `source=NON_REFERRAL`, `confirmed=true`, `reason`, `referenceKind`, `externalReference` or `referenceOperationId`, `payloadHash`, unique `financialOperationId`, `recordedAt`. A request alias uses the existing actor/operation/key mechanism; no separate idempotency platform is added.

Constraints: global unique actionId; exactly one reference alternative; positive amount; nonblank bounded reason/external reference; operation/owner/source/actor linkage; CREDIT/ADMIN_ADJUSTMENT with a single positive available NON_REFERRAL effect; immutable result/reference/actor. LEDGER_OPERATION reference must exist on the same wallet. EXTERNAL reference requires no historic operation, allowing the first wallet credit. It is administrative evidence, never chain proof and not implicitly globally unique. Current ADMIN/session is checked at commit under existing sorted authority locks. Required audit reason/actor/time commits atomically.

Business identity is `p06.manual-credit` + actionId, independent of the request key. Replays bind original actor and every consequential field; new key cannot repeat the effect. Changed action under an existing key or changed actor/payload under actionId conflicts. Different explicit actionIds are different grants, so P07 must retain the ID while recovering a lost reply. Failure rolls back the row and all financial effects. Existing CORRECTION reference/source/audit checks remain unchanged; reserved/referral sources are untouched.

Forward SQL extends existing origin/posting/audit guards for grant CREDIT/ADMIN_ADJUSTMENT and permits null audit operation-reference only with valid external ManualCredit evidence. Ledger inserts AuditRecord before its domain callback creates ManualCredit: defer cross-row grant/audit/ManualCredit consistency constraints to transaction end, while keeping immediate actor/action/basic-shape checks and unchanged correction protection. A valid initial grant commits; a missing/mismatched domain record cannot commit. Existing strict accepted terms/hashes remain valid; only new grants add required grant metadata. Public finance still maps CREDIT/ADMIN_ADJUSTMENT with `correction=null`.

## TreasurySweep (FR-026-032)

Fields: `id` (operator operationId), `assignmentId`, configured `network/tokenContract/source/treasury`, exact `amountUnits`, immutable `policySnapshot`, `operatorIdentity`, `reason`, `payloadHash`, `state/version`, created/claimed/final times, `currentAttemptId`, safe resource/shortfall/outcome code. States: REQUESTED / WAITING_RESOURCES / SIGNING / SIGNED / SUBMITTED / UNKNOWN / CONFIRMED / CHAIN_FAILED / SAFE_FAILED / EXPIRED_PROVEN_UNSENT.

At most one active source/network/token intent, enforced by named partial unique index across REQUESTED, WAITING_RESOURCES, SIGNING, SIGNED, SUBMITTED, UNKNOWN. A lease does not remove this claim. Fixed treasury cannot be any employee assignment and source must have recovered custody. Intent fields/policy snapshot are immutable. Current configured limits are independently rechecked before dispatch; changed policy cannot redirect an existing intent. Named checks/conditional transitions reject arbitrary updates. Index due/reconciliation status with unique tie-breaker.

CONFIRMED requires successful solidified exact intended transfer. CHAIN_FAILED requires canonical solidified failed execution (e.g. REVERT/OUT_OF_ENERGY), verified absence of successful intended movement and recorded actual company costs. SAFE_FAILED requires no broadcast admission/possibly executable attempt. Expiration alone does not establish EXPIRED_PROVEN_UNSENT; authoritative nonexecution/complete solidified coverage and protected audited resolution are required. Otherwise UNKNOWN remains active. No automatic replacement signing or employee wallet effect occurs.

## TransferAttempt (FR-029-030/033)

Fields: `id`, unique `sweepId` for P06's single attempt, immutable intent hash, configured network/token/source/treasury/units, signed `transactionId`, actual `expiration`, signing time, protected envelope ID/digest, matching off-host acknowledgement, `broadcastIntentId`, earliest observation block/time, broadcast admission time, state/version, safe outcome/retry fields, canonical final receipt/block/movement evidence and company energy/bandwidth/fee units.

Reserve stable attempt ID before signing. On every resume, inspect local/off-host SIGNED_ATTEMPT under that ID before rebuilding/signing, especially when DB TxID/digest fields are still null. Recover existing bytes/complete intent snapshot and fill metadata once; a stable ID alone is insufficient. Signed core fields are then immutable. TxID/bytes must validate against intent. BROADCAST_INTENT is acknowledged off-host before any send. Broadcast observations do not rewrite signed core. Unique network/TxID and retained sweep link prevent duplicate identity. Encrypted bytes/paths never enter public projections.

Lost local/remote/DB acknowledgement restores the same object/TxID. Valid bounded retry broadcasts identical bytes; changing TAPOS, expiration, calldata or signature is a new attempt and is not allowed automatically. Reconciliation observes original receipt; final company-cost evidence is append-only. Partial attempt generation cannot release an already possible submission. P08 may extend these primitives through its own approved design for payout policy, without adding payout records now.

## FinancialRuntimeControl (FR-032-033)

Singleton fields: `id`, `generation`, `financialWritesFenced` (safe initial true), `newDispatchPaused` (safe initial true), `version`, reason/actor/time, recovered DB/history/assignment/attempt evidence reference and last completed reconciliation cutoff. No secret/settings UI is added. Only protected recovery/treasury authority changes admission; public ADMIN grant authority cannot open the fence or change signing policy.

Mutations acquire a shared advisory transaction lock and locked row read before financial authority/wallet locks. Restore acquires its exclusive counterpart, drains active work and sets the fence. Serializable locked reads force conflict/retry against a changed fence. Observations/reconciliation stay permitted; their repair writes are limited to protected recovery metadata until financial admission is explicitly reopened. Dispatch additionally checks pause at immutable broadcast-intent admission. Already admitted attempts remain possibly sent/reconcilable.

RequestIdentity insertion is a financial mutation covered by admission, including alias-binding replay through `execute`/`runInTransaction`. P06 changes `recoverOperation` to read-only: validate existing authority/business/alias/outcome evidence and return the stored result or null without binding a fresh key, writing a financial/domain row or invoking a domain-write callback. This applies both while fenced/boot-closed and after admission. The current source's recovery alias side effect must be removed by T012; missing aliases are created only through an admitted mutation. Authorized recovery reads do not use restored OPEN/boot acknowledgements to obtain write authority.

Cold/restore startup holds financial admission locally closed through the fresh boot handshake below; an older OPEN row is not authority. Recovery requires current off-host inventory, every published key/binding, immutable attempts and trustworthy financial DB history. Missing off-chain commits remain a gate, not a reconstructed ledger. P06 tests actual startup/isolated recovery; P11 owns deployed WAL/PITR/full-system verification.

## FinancialRuntimeAdmission (FR-033 startup enforcement)

This narrow record binds financial-runtime startup to recovery approval; it is not a generic worker registry/heartbeat. Fields: fresh `bootId` UUID, allowed `processKind` (API/DEPOSIT_WORKER/SIGNER), `requestedAt`, nullable `acknowledgedGeneration`, `acknowledgedAt`, protected actor/evidence reference. Startup generates/holds bootId only in memory and injects it into all owning financial service instances; LedgerContext/client/job/env/restored state cannot select it. Runtime DB roles may insert only unacknowledged requests for their own role-bound kind and cannot acknowledge/change generation. Protected tooling acknowledges after current recovery validation. Ledger/signer mutation admission checks exact boot/generation under shared control lock, plus fence/pause. Restore increments generation, invalidating old boots. New API against stale OPEN without tooling cannot mutate money; reads/auth may remain available. Clean disposable fixtures explicitly admit their isolated boot without a production bypass.

## Migration and retained-data validation

Create one forward migration with deliberate SQL checks, indexes, immutable/relationship guards and compatible existing grant guard extensions. New domain tables start empty; do not infer real receipts/assignments from ledger fixtures or backfill fake references. Initialize runtime control fenced/paused; implementation acceptance explicitly opens its isolated environment after readiness.

Preserve existing auth/finance/subscription/task rows, enum semantics, correction guards and immutable outcomes. Update existing database inventories, prove fresh migration and populated P05 upgrade, repeat deploy without loss, and inject a late controlled failure to prove transactional rollback. Grant API/worker/signer nonowner permissions in isolated tests and supply protected role setup guidance for later deployment; type projections alone do not establish permission separation.
