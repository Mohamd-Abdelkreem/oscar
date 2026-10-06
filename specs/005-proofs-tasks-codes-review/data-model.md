# P05 data model

**Status**: Proposed Phase 1 design for `specs/005-proofs-tasks-codes-review`. These records, SQL constraints and transitions are not implemented. The existing schema and migration history remain the evidence for current behavior. This file is scoped to [spec.md](spec.md); resolved research and resource limits are in [research.md](research.md), wire boundaries in [contracts/http-api.md](contracts/http-api.md), and validation in [quickstart.md](quickstart.md).

## Existing records retained

[The Prisma schema](../../packages/database/prisma/schema.prisma) already owns users, current sessions, employee restrictions, source-aware wallets, financial operations/request identities/postings/audits, package terms, purchases, subscriptions and referral decisions. P05 adds forward persistence; it does not replace these records or rewrite their accepted history.

- `User`: current role/status/verification, `tasksBlocked` and `withdrawalsBlocked` remain separate. New work requires a current USER session, ACTIVE verified account, no task block and an effective paid subscription. A withdrawal-only block does not deny work.
- `Subscription`: accepted price/reward/calendar/fee terms and owner are retained. Submission captures an effective CURRENT subscription using activation-inclusive/expiry-exclusive eligibility and its saved daily reward.
- `Wallet`, `FinancialOperation`, `LedgerPosting` and `AuditRecord`: only final approval uses the existing transactional ledger. It credits NON_REFERRAL, origin TASK_REWARD, business namespace `p05.task-reward`, business key the submission UUID. Pending work and rejection create no financial operation.
- `RequestIdentity` is financial-only and requires a financial operation. `IdentityAuditRecord` and `ConfigurationChange` have identity/configuration-specific contracts. They are not reused as arbitrary task-command/audit records.

## Proposed records

Entity identifiers below are server-generated UUIDs; command UUIDs are client-supplied request identities scoped by authenticated actor and operation. Store instants as UTC `timestamptz(6)`, Baghdad dates as PostgreSQL `date`, exact reward units as `bigint`, and nonwrapping versions as bounded positive integers. Browser output uses validated date/instant strings and canonical decimal USDT strings, never raw BigInt or persistence rows. Financial and retained history relationships use RESTRICT deletion/update.

### Task

One retained task per publication date provides the common opportunity without a draft registry, recurring schedule or alternate task occupying a paused date.

| Field                                                          | Meaning                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                           | Stable task identity.                                                                                                              |
| `publicationDate`                                              | Unique Monday-Friday Baghdad date.                                                                                                 |
| `publicationState`                                             | PUBLISHED, PAUSED or CLOSED.                                                                                                       |
| `revision`                                                     | Starts at 1; increments on every material edit without wrapping.                                                                   |
| `firstParticipationAt`                                         | Initially null; set once by the first successful unlock or accepted submission, under the task lock. Never cleared or changed.     |
| `title`, `description`, `targetUrl`, `platform`                | Bounded validated task content; description contains instructions. Target is an allowed web link and is not fetched by the server. |
| `illustrationAssetId`, `illustrationPurpose`                   | Optional ready TASK_ILLUSTRATION reference. A proof asset is never accepted here.                                                  |
| `isCodeRequired`                                               | Current publication's code gate.                                                                                                   |
| `createdAt`, `createdByUserId`, `updatedAt`, `updatedByUserId` | Server time and current authenticated admin attribution.                                                                           |

The current fixed calendar derives opening at 12:00 and cutoff at 18:00. Future PUBLISHED work appears scheduled; current open PUBLISHED work appears active; a passed window appears closed. These display states do not introduce a scheduler or editable task hours. PAUSED/CLOSED denies new unlock/submission; it does not erase an existing unlock, accepted claim or review entitlement.

Named uniqueness `tasks_publication_date_key` covers every retained state. Changing the date is permitted only while `firstParticipationAt` is null and the target date is unoccupied. The same locked-row update that accepts first participation makes later date changes impossible. A unique `(id, publicationDate)` permits composite date attribution from unlocks/submissions. `ck_tasks_publication_weekday`, `ck_tasks_state`, `ck_tasks_revision` and `ck_tasks_first_participation` constrain the stored shape; a mutation guard rejects date changes after participation and clearing/replacing its marker.

### TaskCode

| Field                                                          | Meaning                                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `taskId`                                                 | Stable code and immutable associated task.                                                                                                    |
| `normalizedText`                                               | Trim surrounding whitespace, then uppercase letters once at the validated boundary. Globally unique across retained enabled and paused codes. |
| `state`, `version`                                             | ENABLED or PAUSED and bounded positive optimistic version.                                                                                    |
| `description`                                                  | Optional bounded administrative description.                                                                                                  |
| `createdAt`, `createdByUserId`, `updatedAt`, `updatedByUserId` | Current admin/server attribution.                                                                                                             |

`task_codes_normalized_text_key` prevents sequential/concurrent normalized duplicates. Text and association are immutable; pause does not release the normalized identity. `task_codes_id_task_key` supports an unlock's composite code/task foreign key. `ck_task_codes_state`, `ck_task_codes_version` and `ck_task_codes_normalized_text` reject incompatible values. The shared normalization contract must agree with the implementation/database check for every accepted character; no locale-dependent second normalization can silently change code identity.

Code pause and new unlock share task-then-code locks. A previously accepted unlock does not consult the code's later enabled state when authorizing otherwise eligible work.

### TaskUnlock

| Field                                  | Meaning                                                |
| -------------------------------------- | ------------------------------------------------------ |
| `id`, `employeeId`, `taskId`, `codeId` | Accepted employee/task/code attribution.               |
| `businessDate`, `unlockedAt`           | Task's publication date and server acceptance instant. |

`task_unlocks_employee_task_date_key` uniquely identifies `(employeeId, taskId, businessDate)`. Another code or command identity cannot add a second successful usage. Composite `(taskId, businessDate)` references Task, and `(codeId, taskId)` references TaskCode; rejected attempts are not successful usages. This append-only record is not a daily claim, subscription entitlement or money event.

### ImageAsset

One purpose per asset separates private employee proofs from task illustrations. Safety numbers are fixed in [research.md](research.md); they apply to real multipart input, decoding and stored output.

| Field                                                                           | Meaning                                                                                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `ownerUserId`, `purpose`                                                  | Server identity, authenticated upload owner, PROOF or TASK_ILLUSTRATION. Purpose/owner are immutable.                                                                 |
| `uploadCommandId`, `uploadIntentHash`                                           | Durable upload identity and hash bound to owner, purpose and actual bounded file bytes; maintained even while STAGING.                                                |
| `state`                                                                         | STAGING, READY, FAILED, DELETING or DELETED. Only READY may be newly attached.                                                                                        |
| `uploadedAt`, `readyAt`                                                         | Server instant when the complete bounded input stream finished, and successful processing instant. Retention age is never reset by attachment, replacement or review. |
| `storageKey`                                                                    | Server-assigned opaque contained-file reference; never a client filename/path or API output.                                                                          |
| `inputByteCount`, `storedByteCount`, `format`, `width`, `height`, `contentHash` | Successfully validated file facts. READY requires complete finite allowed raster metadata and a durably stored processed file.                                        |
| `failureCode`, `failedAt`                                                       | Required for FAILED: bounded safe failure/cancellation code and server terminal instant; null otherwise. No decoder payloads, raw data or paths.                      |
| `deletionLeaseId`, `deletionLeaseExpiresAt`, `deletedAt`                        | Durable bounded cleanup claim/retry and truthful completion.                                                                                                          |

`image_assets_owner_purpose_upload_key` uniquely identifies `(ownerUserId, purpose, uploadCommandId)`. Within that upload operation, a different purpose is rejected and the same identity with different bytes conflicts. STAGING is a processing state, not an accepted proof or success reply; a lost reply reconciles that original upload rather than creating a phantom READY asset. READY completion rechecks current upload authority in a short transaction.

`image_assets_storage_key_key`, `image_assets_id_owner_purpose_key` and `image_assets_id_purpose_key` support nonoverwriting storage and purpose/ownership foreign keys. `ck_image_assets_purpose`, `ck_image_assets_state_metadata` and `ck_image_assets_deletion_lease` constrain compatible readiness/deletion fields.

STAGING also records `receivedAt`, `uploadedBySessionId`, `processingLeaseId` and `processingLeaseExpiresAt` for interrupted intake/processing ownership. The session reference is server-derived and retained so READY/restart completion can recheck that original session and owner/role/restrictions. `uploadedAt` and the full `uploadIntentHash` remain null until the bounded complete input has been received; READY requires both and they then remain immutable. A command UUID arriving after a file part may use only bounded unaccepted staging until its validated identity is known; canonical storage/processing state is recorded before decoding/publication. A concurrent same-identity in-progress upload observes/conflicts with the existing lease; different complete bytes never replace its identity. Startup accounts for unassociated parser temporaries as well as durable rows. Processing leases fence restart completion against the old process and expired STAGING ages out after one hour; no scanner may declare READY without verified stored facts and current original upload authority.

Allowed transitions: STAGING → READY or FAILED; READY → DELETING → DELETED. FAILED is terminal for its upload identity. An absent-request cancellation may insert a minimal FAILED marker with failureCode UPLOAD_CANCELLED, owner/purpose/uploadCommandId/server failedAt only; storageKey, receivedAt, original upload session, hash, uploadedAt and decoded/file facts are null. A named shape check permits null file facts only for uncompleted/failed intake, never READY. `image_assets_owner_purpose_upload_key` uniquely fences every retained upload identity, including cancellation markers. STAGING cancellation preserves any completed immutable upload/hash facts and revokes its processing lease. New registration and every READY/restart completion acquire the actor/session then asset locks and require STAGING, the exact original live authority/lease and no cancellation. Late work cannot revive FAILED. Cancellation returns unchanged accepted metadata for READY/DELETING/DELETED and never alters its retention or deletes accepted bytes. Parser/child/unaccepted-file cleanup occurs outside transactions, retaining capacity until completed. An expired deletion lease retries removal of the same already fenced asset; interrupted valid STAGING recovery still needs verified stored facts and current original authority.

A ready accepted PROOF retains its own file for at least 30 complete 24-hour periods from `uploadedAt`, even if unattached or superseded. Every evidence version belonging to a PENDING submission is additionally exempt from age cleanup. Illustration cleanup cannot remove a file still referenced by a retained task. Invalid/incomplete temporary data is separately bounded and is not accepted proof retention. The bounded filesystem reconciliation scan also handles renamed files without a READY commit and orphan leftovers: match server-assigned identity/record first, recover only verified eligible STAGING work, and otherwise remove invalid/unaccepted leftovers within the staging budget without deleting accepted files.

### TaskSubmission

| Field                                                        | Meaning                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `employeeId`, `taskId`, `businessDate`                 | The stable employee/date claim and accepted task attribution.                                                                                     |
| `capturedTaskRevision`, `capturedTaskContent`                | Current revision, title/instructions/link/platform accepted at first submission; bounded validated snapshot, not a live task relation projection. |
| `subscriptionId`, `capturedSubscriptionTerms`, `rewardUnits` | Effective owner-bound subscription, validated saved terms and exact positive submission-time reward.                                              |
| `executionDeclared`, `submittedAt`, `deadlineAt`             | Required true declaration, server acceptance time and the original same-date 18:00 exclusive cutoff.                                              |
| `status`                                                     | PENDING, APPROVED or REJECTED.                                                                                                                    |
| `version`, `currentEvidenceVersion`                          | Nonwrapping command/state version and the currently accepted immutable evidence version.                                                          |

`task_submissions_employee_date_key` uniquely identifies `(employeeId, businessDate)`, independently of task, code, subscription and command key. Rejection retains this claim. `task_submissions_id_employee_key` and `task_submissions_id_task_date_key` support evidence/review attribution. Composite task/date and subscription/owner foreign keys prevent changed-date or foreign-subscription association.

Named checks enforce declaration=true, positive bounded reward, valid status/versions, accepted Baghdad weekday/window, and fixed original deadline. A deferred participation guard rejects an accepted unlock/submission without the task's first-participation marker, so direct inserts cannot leave date movement enabled. Captured task/subscription/reward/date/declaration/deadline fields cannot change after acceptance. Submission checks the current task revision under its lock before inserting anything: stale work creates no claim. Effective subscription and account authority are read after compatible user locks, so upgrade/submission races capture one valid saved entitlement.

### SubmissionEvidence

| Field                                         | Meaning                                                 |
| --------------------------------------------- | ------------------------------------------------------- |
| `id`, `submissionId`, `employeeId`, `version` | Immutable evidence version and owner attribution.       |
| `assetId`, `assetPurpose`                     | Ready owned PROOF at attachment; purpose literal PROOF. |
| `acceptedAt`, `acceptedByUserId`              | Server attachment time and authenticated owner.         |

`submission_evidence_submission_version_key` makes `(submissionId, version)` unique. Composite submission/employee and asset/employee/purpose foreign keys preserve ownership. Reusing an otherwise permitted owned READY asset cannot create another same-date claim; no unapproved cross-date image-reuse rule is introduced. Evidence rows are append-only, including superseded screenshots. Retention considers every association with pending work.

The submission's `(id, currentEvidenceVersion)` references this unique evidence pair using a custom deferred composite SQL foreign key. This permits initial submission/evidence creation in one transaction and requires a complete current reference at commit. Replacement inserts the next version and advances the pending submission pointer/version atomically; it does not mutate the previous row.

Replacement requires current employee authority, effective paid membership, PENDING status, matching expected version and time before the original deadline. It retains the accepted entitlement/content/declaration; later task content edits or code pause do not reinterpret that entitlement. Final review and replacement share the submission lock; a review against an earlier evidence version conflicts.

### FinalReview

| Field                                              | Meaning                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`, `submissionId`, `employeeId`                 | One immutable final review per submission with retained owner attribution.                                               |
| `decision`, `submissionVersion`, `evidenceVersion` | APPROVED or REJECTED, bound to the pre-decision submission version and current evidence actually confirmed by the admin. |
| `actorUserId`, `decidedAt`, `reason`               | Current ADMIN actor, server instant and required validated reason.                                                       |
| `walletId`, `approvalOperationId`                  | Approved employee wallet and unique reward operation; both absent for rejection.                                         |

`final_reviews_submission_key` and `final_reviews_approval_operation_key` enforce one decision and at most one linked financial operation. Composite submission/employee and submission/evidence references keep the review attached to the correct claim/current evidence. For approval, a narrow additive unique `wallets_id_owner_key` on the existing Wallet permits a composite wallet/employee foreign key; operation/wallet uses the already available FinancialOperation composite identity.

`ck_final_reviews_decision_money` requires an operation only for approval. A deferred cross-record guard validates final submission status against the one review and, for approval, the matching CREDIT/TASK_REWARD/NON_REFERRAL operation, `p05.task-reward` submission business key, captured reward and employee wallet. PENDING has no final review/reward link. Approval/review/status/ledger/projection/audit commit together; rejection/review/status/audit commit together without money.

Review does not require the employee's current subscription/account to remain eligible. The current admin must remain authorized. Approval after an employee ban therefore retains the captured reward while the ban still prevents login/withdrawals. Final rows/status cannot be reversed, deleted, edited or converted to another decision.

### TaskCommandRecord

A focused append-only P05 terminal receipt has `terminalState: COMMITTED | CANCELLED`. COMMITTED owns the accepted command outcome and its administrative audit. CANCELLED fences only this unused actor/kind/key. This extends the existing P05 record rather than introduce a generic command platform. The field table describes COMMITTED; CANCELLED nullability is specified below.

| Field                                                     | Meaning                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `actorUserId`, `kind`, `commandId`                  | Server receipt and actor/operation-scoped validated request identity.                                                                                                                     |
| `intentHash`                                              | Hash of canonical validated consequential payload, including target, expected versions, normalized values, declaration or confirmation, and review reason/evidence version as applicable. |
| `taskId`, `codeId`, `submissionId`                        | Required typed domain references for the accepted operation.                                                                                                                              |
| `occurredAt`, `reason`, `beforeSnapshot`, `afterSnapshot` | Server time, applicable required admin reason and bounded safe audit facts.                                                                                                               |
| `safeOutcome`                                             | Validated operation outcome needed to reconcile the initiating actor; no file bytes, storage paths, raw request/provider payloads or secrets.                                             |

Kinds cover task create/edit/publication, code create/state, unlock, submission, replacement and final review. `task_commands_actor_kind_command_key` enforces `(actorUserId, kind, commandId)` across both terminal states. A named matrix check requires the table's hash/typed-target/outcome/snapshot/reason facts for COMMITTED; CANCELLED instead requires only server receipt ID, actor/kind/key/time and has null hash/targets/outcome/business snapshots/reason. Never invent unknown request facts. Both terminal variants are immutable; material task/code audit lists select COMMITTED, so cancellation cannot appear as a business mutation.

All executors and explicit cancellation share the existing sorted actor-user lock held through the domain transaction. After current actor/session authorization and before any effects, re-read the terminal identity. COMMITTED replays or rejects changed intent; CANCELLED rejects any execution with COMMAND_CANCELLED. Cancellation under the same lock either returns authorized COMMITTED or inserts/reuses CANCELLED when no accepted receipt exists. It changes no task, code, claim, review or money. A crash/rollback leaves no accepted receipt and a later cancellation can safely fence a delayed original. Recognized Serializable conflicts retry within the existing bounded policy.

An exact command replays its recorded outcome before stale-version evaluation. Same identity/different canonical payload conflicts. Another/absent identity cannot bypass date/unlock/final-reward business uniqueness. The full review hash covers action, submission, current evidence/version, reason and confirmation; the existing ledger intent fingerprint alone does not capture those fields.

Actor-scoped outcome reads recheck current authority. NOT_OBSERVED means no terminal receipt was observed; it never proves failure or releases an outstanding guard. OBSERVED exposes the permitted COMMITTED outcome; CANCELLED returns only kind/key/server cancellation time. Cancellation requires the current active verified role/session appropriate to that kind, without requiring paid/task eligibility merely to fence unused own work. Disclosure of COMMITTED/private outcomes still enforces resource access. Fresh intent after CANCELLED requires current resource/eligibility and deliberate reconfirmation/new identity. Uploads use their separate purpose-bound ImageAsset PENDING/READY/FAILED/NOT_OBSERVED observations and irreversible FAILED cancellation marker.

## Transaction and file boundaries

All domain state is authoritative in PostgreSQL. Commands use compatible deterministic ordering: sorted users → sorted wallets/reservations for approval only → session authority → task → code if needed → submission → sorted assets. Re-read current role/status/session/restrictions and sample the injected clock after consequential locks. Do not acquire a task/submission lock and then enter a fresh ledger transaction.

- Unlock/submission/replacement/admin edits use bounded transactions and conditional versions plus named uniqueness. Existing user/session helpers are reused; new-work participant locks serialize against upgrades and account controls. Current active owners may read their own accepted work after expiry or a task restriction; paid/task eligibility is checked for new work rather than used to erase history. Current ADMIN may review private evidence after an employee ban.
- Approval enters `LedgerService.runInTransaction`, which already acquires sorted user/wallet/reservation locks and bounded Serializable retries; the remaining locks and final review stay within that same transaction/client. Rejection uses compatible actor/employee/session/task/submission locks and no ledger effect.
- Cleanup locks a bounded sorted asset batch and reads pending-reference predicates without taking earlier task/submission locks. Serializable predicate/retry handling orders cleanup versus attachment/review. Its READY→DELETING commit fences later attachment; it never deletes pending evidence. File removal runs after commit and durable lease retry reconciles a crash.
- Multipart reading, hashing/decoding/re-encoding, private file writes and filesystem deletion remain outside long database transactions. Filesystem readiness precedes READY metadata; READY never promises a file that was not successfully processed/stored. Failures retain old accepted evidence and create no daily claim or reward.

Named checks/uniqueness/transition guards complement service authority. Retry only recognized serialization/deadlock conflicts within the existing bounded policy and original command identity; recheck time/state each attempt. No retry crosses external file I/O or creates a different reward.

## Indexes and forward migration acceptance

Plan indexes for demonstrated query owners: Task `(publicationDate, id)`; TaskCode `(taskId, state, id)`; TaskUnlock `(codeId, unlockedAt, id)` and `(employeeId, businessDate, id)`; TaskSubmission `(status, submittedAt, id)`, `(taskId, status, submittedAt, id)` and `(employeeId, submittedAt, id)`; SubmissionEvidence `(assetId, submissionId)`; ImageAsset `(purpose, state, uploadedAt, id)` and deletion-lease scan; TaskCommandRecord `(actorUserId, occurredAt, id)`. Unique keys already supporting a query do not need duplicated indexes.

The owner is `packages/database/prisma/schema.prisma` plus a new forward directory under `packages/database/prisma/migrations/`; exact migration timestamp is chosen during implementation. Preserve applied P01-P04 migration SQL and their immutable history. Add custom SQL for checks, deferred composite/cross-record constraints and guarded final/snapshot/evidence/command transitions where Prisma declarations are insufficient.

Extend existing schema inventory/migration tests and proposed `packages/database/tests/integration/tasks.integration.test.ts`. Gate B needs a fresh deploy, populated P01-P04 upgrade with balances/subscriptions/audits preserved, repeated deploy, direct invalid writes, ownership/date/version/uniqueness failures, and actual service rollback/races. No schema, migration or test was written or executed by this planning artifact.
