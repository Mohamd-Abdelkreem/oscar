# Feature Specification: P06 - TRON Custody, Deposits, and Basic Treasury Backend

**Feature Branch**: 005-proofs-tasks-codes-review (current branch; no branch-creation hook is configured)

**Created**: 2026-10-06

**Status**: Clarified; ready for P06 planning. P06 implementation and controlled testnet/recovery gates are unexecuted.

**Input**: User description: "PHASE_ID=P06 - TRON Custody, Deposits, and Basic Treasury Backend. Read docs/workflow/speckit-prompts.txt. Apply OPERATING CONTRACT and execute SPECIFY only."

**Roadmap Phase**: P06 - TRON Custody, Deposits, and Basic Treasury Backend

**Feature Directory**: specs/006-tron-custody-deposits

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: Protected company custody/signing, unique recoverable employee deposit addresses, immutable transfer attempts, automatic confirmed USDT TRC-20 detection and exact wallet credit, resumable indexing/reconciliation, employee assigned-address/history and authorized administrator deposit-history capabilities, the separately audited ADMIN-only manual-credit capability needed by P07, and operator-triggered fixed-treasury sweeps with capped resource-funding instructions. Authority: [PLAN.md](../../PLAN.md), Sections 3.3, 3.6, 3.8, 5.2-5.6, 6, 7/P06, 9, 11 and 12. Current P06 maps to original P08; original P06 task/proof references do not select this feature.
- **Exclusions**: Reimplementing P01-P05 foundations or task workflows; all frontend integration/routes/popups/static-copy/design changes; P07 deposit screens; P08-P09 employee withdrawal addresses/reservations/scheduling/payout policies/settlement; P10 cross-domain administration/settings/summaries; P11 production deployment/full-system recovery/release. No direct-to-package payments, other assets/networks, employee-controlled keys, external custodial payment provider, deployed custom contract, automatic top-ups, staking/energy trading, complex sweep batching, generic accounting/outbox platform, KYC, admin 2FA or dual approval. This SPECIFY run creates no application code, implementation tests, plan or tasks and performs no deployment, transfer, spending, commit or push.
- **Prerequisites**: Populated [constitution](../../.specify/memory/constitution.md) version 1.0.0 and existing money/source-ledger/account/session/wallet foundations. [P03 task evidence](../003-auth-account-frontend/tasks.md) records P01/P02 acceptance and completed P03 local acceptance. [P04 task evidence](../004-packages-referrals-wallet-finance/tasks.md) records T001-T078 complete and both delivery gates. [P05 remediation evidence](../005-proofs-tasks-codes-review/tasks.md) records T001-T095 complete and backend/frontend gates revalidated on 2026-10-06; [its quickstart](../005-proofs-tasks-codes-review/quickstart.md) distinguishes fresh remediation checks from reused earlier results. These are reused recorded results, not fresh P06 tests or production acceptance. Preserve completed work and recheck affected foundations during implementation. The later owner decision recorded in P03 removes separate CONVERGE as a prerequisite for P02 and later phases; do not reinstate it or claim a new assessment ran.
- **Frontend boundary**: Backend only. Deliver safe public-data capabilities for the existing /employee/deposit and /admin/deposits surfaces without editing or connecting them. Prior phase-specific presentation exceptions do not authorize P06 UI changes.
- **Owner decisions and operational gates**: C1 is resolved below using the owner's instruction to select the recommended simple choice. Explicit network/token identity, provider access, protected test-only credentials, recovery storage/owner, treasury destination, resource limits and test funding remain required before controlled acceptance; availability is unverified here. P07 must resolve obsolete deposit delay/rejection copy and required manual-credit confirmation/reason surfaces within the frontend freeze before affected UI work. P06 does not approve those changes. The historic absent-admin-login warning is superseded by current P03 implementation and recorded acceptance.
- **Acceptance gate**: Custody/key recovery and secret isolation; exact atomic duplicate-safe deposits with durable restart/replay; authorized employee/admin history and manual credit; safe fixed-destination sweeps/reconciliation; and actual controlled testnet provisioning/deposit/sweep evidence must all pass before P07 integration. Missing required infrastructure, recovery records, provider evidence or executed tests keeps this gate incomplete. One subsystem's success or a requirements checklist does not complete P06.

Apply the constitution and [operating contract](../../docs/workflow/speckit-prompts.txt). All eight [engineering guides](../../docs/engineering/README.md) and the installed SPECIFY skill were read. Guide inventories describing pre-P01 source are historical. P06 owns the separately opted-in testnet profile under current PLAN.md Section 9; the older testing-guide reference to P08 does not defer it.

### Actors and Current Capability

Actors are an authenticated employee retrieving their own public instructions/history; a currently authorized administrator inspecting history or confirming a manual credit; protected automated custody/deposit processes; an authorized treasury operator; and a recovery operator. Automatic verified inbound credit is independent of employee login, subscription and task/withdrawal eligibility. Any one authorized administrator may authorize an allowed administrative action. Accepted no-2FA/no-dual-approval and compromised-admin/host risks remain.

Source inspection on 2026-10-06 establishes current facts, not P06 acceptance:

| Evidence owner                                                                                                                                                                                                                                                       | Existing capability / P06 gap                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Exact money](../../apps/api/src/core/financial/money.ts), [ledger service](../../apps/api/src/modules/ledger/ledger.service.ts), [ledger effects](../../apps/api/src/modules/ledger/ledger.effects.ts), [persistence](../../packages/database/prisma/schema.prisma) | Exact units, source-aware transactional postings, business/request identities, reservations and audited correction primitives exist. A deposit origin and test funding helpers do not implement live deposits.                               |
| [Ledger intents](../../apps/api/src/modules/ledger/ledger.types.ts), [P04 FR-027](../004-packages-referrals-wallet-finance/spec.md)                                                                                                                                  | Existing source-specific ADMIN corrections require a prior operation on the same wallet. P04 explicitly deferred manual-credit endpoints. New-reference/initial manual credit and its source policy are not established by these primitives. |
| [Session authority](../../apps/api/src/modules/auth/session-authority.ts), [authentication](../../apps/api/src/middlewares/auth.middleware.ts), [API composition](../../apps/api/src/router.ts)                                                                      | Current identity/session/role protection and preceding domain modules exist. No custody/deposit/treasury or public signing capability is wired.                                                                                              |
| [Persistence](../../packages/database/prisma/schema.prisma), [contracts exports](../../packages/contracts/src/index.ts), [API manifest](../../apps/api/package.json)                                                                                                 | No custody assignment/recovery, chain receipt/cursor, sweep or signing-attempt records/contracts exist. No TRON dependency, worker/signer startup or testnet profile exists. These are P06 deliverables.                                     |
| [Dedicated admin sign-in](../../apps/web/src/app/admin/auth/login/page.tsx), [P03 acceptance](../003-auth-account-frontend/tasks.md), [P05 acceptance](../005-proofs-tasks-codes-review/tasks.md)                                                                    | Identity and predecessor domain gates have recorded local evidence. They confer no custody authority or permission to change deposit screens.                                                                                                |

## Clarifications

### Session 2026-10-06

The owner instructed CLARIFY to select the recommended answers without overengineering. One material question was resolved under that delegation; no interactive question was needed.

- Q: C1 - May ADMIN manual credit create an initial/new grant, which source applies, and what reference is required? → A: Allow new grants, including the first credit to a wallet, as available NON_REFERRAL administrative funds. Require a meaningful external reference or a valid existing same-wallet ledger-operation reference identifying the administrative action. The server fixes and records the grant source; an administrator cannot select REFERRAL for a new grant. Existing corrections remain source-specific and require an existing same-wallet operation. Retain confirmation, nonblank reason/reference, exact amounts, current ADMIN authority, audited atomic effects and duplicate/payload-conflict protection. Existing sources/reservations and genuine chain receipts remain unchanged; no fake prior operation or chain receipt is created.

## User Scenarios & Testing _(mandatory)_

Implementation must create or extend actual automated acceptance tests. Financial atomicity/concurrency needs real migrated persistence; custody/recovery needs actual isolated protected storage/process boundaries. Network doubles may exercise failures but cannot replace controlled testnet evidence. Scenario references describe required behavior, not tests already executed.

### User Story 1 - Receive a recoverable personal deposit address (Priority: P1)

As an employee, I need stable public instructions for a company-controlled personal address so incoming funds remain attributable and recoverable after failure.

**Why this priority**: Publishing an unrecoverable or wrongly assigned address exposes funds to loss before any deposit can be processed safely.

**Independent Test**: Provision for distinct employees, race requests for one employee, interrupt recovery acknowledgement/publication and restore a newly published assignment after primary custody-store loss; inspect ownership/public results without exposing keys.

**Acceptance Scenarios**:

1. **Given** an authorized employee without an address, **When** provisioning and acknowledged recovery complete, **Then** their instructions identify one unique company-controlled address and configured network/token; another employee receives a different address. (FR-002-003/005-009/021)
2. **Given** concurrent provisioning or a lost assignment response, **When** the employee repeats the request, **Then** the same recoverable assignment is returned without address reuse or loss of an unacknowledged key. (FR-008-011)
3. **Given** failed/unavailable/unverifiable off-site recovery acknowledgement, **When** publication is requested, **Then** no address is exposed as ready; recorded provisioning can safely resume. (FR-007/009/011)
4. **Given** an address published immediately before primary-host/storage loss, **When** it is restored, **Then** its correct key/address/employee binding and required history are recovered before financial admission resumes; missing/mismatched records keep admission fenced. (FR-007/010-011/033)
5. **Given** another employee's identity or stale/revoked credentials, **When** address/history access is attempted, **Then** access is denied without cross-account data or custody disclosure. Address generation alone never claims activation or sufficient resources. (FR-003/006/008/021)

---

### User Story 2 - Automatically receive a verified deposit once (Priority: P1)

As an employee, I need a genuine confirmed transfer to my address to become exact wallet funds without a waiting period or administrator decision.

**Why this priority**: Wallet ownership must remain correct under provider uncertainty, repeats and competing financial actions.

**Independent Test**: Verify owned transfers, inspect receipt/posting/source outcomes, replay one event 100 times, process distinct logs within one transaction and force concurrent processing/financial failures.

**Acceptance Scenarios**:

1. **Given** a successful canonical-final configured-token transfer of 1.000001 USDT to an assigned address, **When** it is detected and verified, **Then** one genuine receipt and one exact available non-referral credit of 1.000001 commit together and appear in owned history. (FR-012-017/021)
2. **Given** one eligible event observed 100 times, concurrent scanners and restart after commit before acknowledgement, **When** it is processed again, **Then** one receipt and one credit remain. Two distinct eligible logs in the same transaction each receive their own single credit. (FR-015-016/019)
3. **Given** wrong network/token/recipient, fake symbol, failed execution, zero/out-of-range amount, malformed receipt, unfinalized/disappearing candidate or a user-only TxID claim, **When** inspected, **Then** no available credit is granted; uncertain candidates remain distinguishable and recoverable. (FR-003/012-014/018/020)
4. **Given** Saturday/Sunday, closed task hours, a Free/expired employee or a later account restriction with an existing assignment, **When** a transfer qualifies, **Then** automatic credit retains original ownership without a 72-hour hold or admin rejection, and does not restore login/withdrawal authority. (FR-010/017)
5. **Given** failure during receipt/posting or simultaneous purchase/another credit, **When** processing commits or rolls back, **Then** receipt/ledger/projections agree, source/reserved balances remain exact and retry cannot duplicate credit or overspend. (FR-016/034)

---

### User Story 3 - Inspect deposits and record a distinct manual credit (Priority: P2)

As an administrator, I need bounded truthful history and an authorized administrative credit with reason/reference so company actions are auditable and cannot masquerade as chain transfers.

**Why this priority**: P07 needs genuine history/manual-credit behavior and a clear separation between chain evidence and administrator authority.

**Independent Test**: Retrieve multiple owned/admin history pages, submit/replay/reconcile a confirmed source-classified credit, lose its response and inspect exact unchanged chain receipts plus committed postings/audit. Include a first credit to an empty wallet using an external reference and a source-specific correction using a valid same-wallet operation reference.

**Acceptance Scenarios**:

1. **Given** multiple employees' chain/manual history spanning more than one page, **When** an employee/admin reads it, **Then** the employee sees only their own safe records; the admin can page/filter authorized records with stable ordering and explicit chain/manual labels. Neither receives keys, signed bytes or recovery paths. (FR-003/006/021-022)
2. **Given** a current administrator and reviewed positive amount, target, fixed NON_REFERRAL grant classification, reason and permitted reference, **When** confirmed, **Then** one administrative posting, available-source change and server-derived audit commit together without creating/editing a chain receipt. (FR-023-025)
3. **Given** a repeated intent, concurrent repeats or lost response after commit, **When** the original action is retried/observed, **Then** its recorded outcome is recovered once; same-key/business-identity payload changes conflict without another credit. (FR-004/024-025)
4. **Given** missing confirmation/reason/reference, invalid source/amount, employee credentials, deactivated/revoked admin authority or forged balance/audit fields, **When** manual credit is attempted, **Then** no financial effect commits and no existing referral/reserved funds are relabeled as deposits. (FR-003-004/023-025)
5. **Given** a wallet without previous operations and a meaningful external reference, **When** a current administrator confirms its first manual credit, **Then** one available NON_REFERRAL administrative grant commits without fake historic-operation or chain records. A grant requesting REFERRAL classification or a ledger reference belonging to another wallet is rejected; existing corrections retain their source-specific same-wallet-reference rules. (FR-023/025; C1)

---

### User Story 4 - Recover missed detection without guessing balances (Priority: P1)

As a deposit/recovery operator, I need interrupted/paginated detection to resume from durable evidence so provider outages and host loss cannot erase or duplicate transfers.

**Why this priority**: A successful normal scan does not establish safety under delayed events, restarts or stale restored state.

**Independent Test**: Scan several pages, inject delayed/out-of-order/repeated events and provider failures, interrupt before/after financial commit and scan progress, then restart/replay/reconcile ownership and exact totals.

**Acceptance Scenarios**:

1. **Given** several pages/replay windows, interruption and overlapping scanners, **When** detection resumes, **Then** every eligible event is eventually accounted for once and progress cannot skip unfinished eligible work. (FR-015/018-020/034)
2. **Given** throttling, malformed/contradictory provider data, timeout or outage, **When** scanning fails, **Then** safe progress persists, retry remains bounded/observable and no receipt, confirmation or successful empty/zero result is fabricated. (FR-018-020/032)
3. **Given** a restored snapshot and possibly broadcast sweep, **When** recovery begins, **Then** financial writes/new dispatch stay fenced until required assignments/financial commits/attempts are recovered and chain activity reconciled. Chain rescan cannot replace missing off-chain purchases/rewards/adjustments. (FR-011/029-033)
4. **Given** an irreconcilable recovery gap or conflicting final evidence, **When** truth cannot be established, **Then** it remains visible and fenced/unresolved; no guessed balance, overwritten receipt or replacement payment repairs it. (FR-018/030/032-033)

---

### User Story 5 - Safely move custody funds to company treasury (Priority: P2)

As an authorized treasury operator, I need protected consolidation to the configured company treasury with bounded resources and durable reconciliation, without changing employee wallet ownership.

**Why this priority**: Company-controlled addresses do not forward funds by themselves; lost replies must not trigger another payment or employee credit.

**Independent Test**: Initiate a fixed-destination test-only sweep, reject unauthorized/altered intents, interrupt signing/broadcast acknowledgement, reconcile the original attempt and compare employee balances.

**Acceptance Scenarios**:

1. **Given** an authorized operator, recovered source key, source funds and permitted limits, **When** a sweep starts, **Then** only its fixed treasury/recorded intent can be signed, and protected signed attempt/transaction/broadcast-intent records persist before broadcast. (FR-005/026-029)
2. **Given** arbitrary destination/signing/key-export request, wrong source/network/token, insufficient funds/resources, excess caps or stale authority, **When** signing is attempted, **Then** no unauthorized transfer/secret exposure occurs and insufficiency remains a truthful actionable state. (FR-002-006/026-028/031)
3. **Given** lost signer/broadcast reply or restart, **When** retry/reconciliation runs, **Then** the same durable attempt/transaction identity is resolved or reused; a possibly executable transfer cannot justify fresh signing or guessed failure. (FR-029-030/033)
4. **Given** a verified canonical-final sweep, **When** reconciled, **Then** source/treasury movement and company resource costs are accounted for while employee available/reserved/source totals and deposit-credit count remain unchanged. (FR-027/030-032)
5. **Given** a new-dispatch pause races an existing attempt or confirmation occurs on a weekend, **When** initial/rebroadcast admission or reconciliation is attempted, **Then** the pause blocks later durable broadcast-intent admissions. An attempt admitted before the pause may finish sending and remains possibly sent until reconciled; confirmations/reconciliation continue during pause and weekends. Resource funding remains a capped operator responsibility without automatic top-up/energy trading. (FR-031-032)
6. **Given** complete explicit testnet configuration/resources, **When** controlled provisioning/deposit/sweep/recovery runs, **Then** actual public transaction identities, final outcomes and reconciled amounts demonstrate success. Missing prerequisites/mainnet configuration prevent the run and keep the gate incomplete. (FR-035-036)

### Edge Cases

- Lost recovery acknowledgement after successful off-site storage must resolve the same binding; tampered/mismatched encrypted assignment cannot authorize publication. (US1; FR-007-011)
- Restriction/deactivation/deletion never frees an old address. Inbound credit retains attribution without restoring employee access. (US1-2; FR-003/010/017)
- Repeated event identity with different token/recipient/amount evidence cannot overwrite a genuine receipt or become a second credit. (US2/4; FR-012/015/018)
- A positive fractional transfer is representable alone but its wallet addition would overflow. No partial receipt/credit commits; the gap remains investigable without a commercial cap. (US2; FR-014/016/018)
- Delayed events fall behind recent progress, pages repeat or a process crashes between verification/commit/checkpoint. Durable pending work/replay must prevent loss and duplicate credit. (US2/4; FR-015-020)
- A manual reference mentions a TxID already seen or a wallet has no previous operation. A meaningful external reference can support an initial NON_REFERRAL administrative grant, but never chain proof or a fake prior-operation record. Replaying the same administrative action with a new request key cannot add another grant; an existing chain credit cannot be replayed as chain credit through manual referencing. (US3; FR-004/023-025)
- Concurrent sweeps compete for source funds or resource/policy configuration changes before signing. Original intent/current limits must be rechecked without spending possibly sent funds again. (US5; FR-026-030)
- Recovery/decryption/provider/test-funding access is absent. Publication/signing/testnet readiness fail closed at their respective boundary; unavailable access is not a passed gate. (US1/4/5; FR-002/007/011/033/035-036)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Deliver only P06's backend scope, reuse accepted foundations and preserve frontend/unrelated artifacts. Complete P06 acceptance MUST precede P07 integration. (All stories; scope/gates)
- **FR-002**: Privileged operations MUST require explicit consistent network, allowlisted USDT TRC-20 token, provider, custody/recovery authority and applicable treasury/resource policies. Missing/malformed/placeholder/conflicting configuration MUST fail closed without default credentials, substitutions or mainnet fallback. (US1/AC1-3; US5/AC2/6)
- **FR-003**: Employee access/provisioning MUST derive ownership from current authenticated identity and check role/status/session. Admin reads/manual writes MUST check current ADMIN authority at the action/commit; automation MUST use authorized process authority. Clients/providers cannot supply authoritative owner, balances, audit actor or financial outcomes. (US1/AC5; US2/AC3; US3/AC1/4)
- **FR-004**: Inputs MUST reject forged privileged fields/invalid money/source/reference data. Admin action identity MUST bind actor/operation/key/payload and retain a durable business identity so changed or missing request keys cannot duplicate the same action. Consequential payload changes under an existing identity MUST conflict. (US3/AC3-4)
- **FR-005**: Generation/decryption/signing MUST remain inside protected process/credential/permission boundaries separate from public application access. Only authenticated durable allowed-operation intents within independent limits may be signed; arbitrary-signing/key-export/public signing capabilities MUST NOT exist. (US1/AC1/5; US5/AC1-2)
- **FR-006**: Keys, seeds, decryption/provider secrets and private signed material MUST be absent from employee/admin outputs, public configuration, browser/build artifacts, logs/errors, fixtures and ordinary diagnostics. Public transaction identities/safe state may be exposed without secret-bearing recovery locations. (US1/AC5; US3/AC1; US5/AC2)
- **FR-007**: Custody recovery material MUST have encryption/integrity protection and assignment binding, acknowledged recoverable off-primary-host storage and separately protected decryption authority. Recovery/rotation MUST preserve all published key access. (US1/AC3-4)
- **FR-008**: Each employee MUST receive a unique independent company-controlled key/address generated within custody. Client addresses MUST NOT establish assignments. Generation, publication readiness, activation and resource readiness MUST be distinct truthful facts. (US1/AC1-2/5)
- **FR-009**: Publication MUST wait for acknowledged recoverable key/address/employee records agreeing with durable assignment. Concurrency/lost replies MUST resolve the same assignment; incomplete acknowledgement MUST keep it unavailable and safely resumable. (US1/AC1-3)
- **FR-010**: Published addresses/ownership history MUST never be reassigned, including after lifecycle changes. Eligible inbound transfers and history MUST retain the original employee. (US1/AC2/4; US2/AC4)
- **FR-011**: Restart/recovery MUST resolve incomplete provisioning and recover every published key/binding, including one published immediately before host loss. Missing/mismatched records MUST fence affected publication/signing rather than invent ownership/keys/success. (US1/AC2-4; US4/AC3)
- **FR-012**: Deposits MUST independently verify configured network/token contract, decoded assigned recipient, exact positive raw amount, successful execution and canonical-final receipt/log evidence. A TxID, symbol, explorer link, user claim or provider acknowledgement alone cannot authorize credit. (US2/AC1/3)
- **FR-013**: Deposit/sweep finality MUST follow one explicit rule requiring successful execution and confirmed/solidified canonical receipt evidence. Pending observations cannot be called confirmed. Planning/controlled acceptance MUST identify and verify the precise evidence used without guessing an elapsed confirmation wait. (US2/AC3; US5/AC4/6)
- **FR-014**: Deposit amounts MUST retain exact integer micro-USDT units, with up to six fractional digits at public boundaries. Reject zero/negative, malformed/unsupported precision and unrepresentable inputs/results without rounding verified units or inventing a commercial minimum/maximum. (US2/AC1/3/5)
- **FR-015**: Permanent event identity MUST comprise configured network, transaction ID and canonical receipt log index. Replay/concurrency MUST credit once independently of worker/request identity; distinct eligible logs in one transaction remain separate. Conflicting evidence cannot overwrite an existing receipt. (US2/AC2-3; US4/AC1/4)
- **FR-016**: Genuine receipt, exact available non-referral credit, append-only ledger/source projections and required audit MUST commit together through existing transactional financial authority. Failure leaves zero partial effects; competing operations preserve exact source/reserved accounting and representable nonnegative balances. (US2/AC1-2/5)
- **FR-017**: Verified deposits MUST automatically credit every day immediately after detection/verification without added hold, admin approval/rejection, subscription/task-window/withdrawal restriction dependency. Lifecycle changes retain inbound ownership without restoring login/withdrawal authority. External transfers become wallet funds rather than directly purchasing packages. (US2/AC1/4)
- **FR-018**: Unfinalized/disappearing/malformed/conflicting/unverifiable candidates MUST remain uncredited/unresolved with truthful safe state and recoverable reconciliation. Genuine historic receipts/postings MUST remain immutable; corrections append separately audited entries. (US2/AC3; US4/AC2/4)
- **FR-019**: Bounded detection MUST preserve durable pagination/progress/replay/pending-work state for delayed events and interruption. Restart, overlapping scanners and missed wakeups MUST recover every eligible event from persisted records without in-memory-only cursors or lost work. (US2/AC2; US4/AC1)
- **FR-020**: Provider calls/parsing/pages/retries MUST be bounded and untrusted. Throttling/timeouts/malformed data MUST retain safe progress and a recoverable failure without fake success/confirmation/ownership/balances. Advancing progress cannot erase unresolved eligible work. (US2/AC3; US4/AC1-2)
- **FR-021**: Employee capabilities MUST return only their own public address, configured network/token, truthful readiness/detection and bounded persisted chain/manual history, with exact decimal amounts/explicit timestamps. Unavailable responses cannot become fake addresses/zero balances/successful empty history. (US1/AC1/3/5; US2/AC1; US3/AC1)
- **FR-022**: Authorized admin history MUST provide validated bounded filters/pagination, stable unique-tie-breaker ordering, declared totals/filter scope and access to all matching records. Chain/manual origins MUST be distinguishable; custody/private signed data MUST be excluded. (US3/AC1)
- **FR-023**: ADMIN manual credit MUST allow a new grant, including the first credit to a wallet. Require reviewed target, exact positive amount, server-fixed and recorded NON_REFERRAL classification, confirmation, nonblank reason and a meaningful external reference or valid existing same-wallet ledger-operation reference identifying the administrative action. Reject administrator-selected REFERRAL grant classification and another wallet's ledger reference. Check current ADMIN authority at commit. References never substitute for verified chain evidence. (US3/AC2/4-5; C1)
- **FR-024**: Manual credit MUST atomically append the administrative posting, permitted available-source change, durable outcome and server-derived actor/time/reason/reference audit. Repeats/races/lost replies recover one outcome; existing request/business identities with changed payload conflict. (US3/AC2-4)
- **FR-025**: New manual grants MUST add only available NON_REFERRAL funds with an administrative origin distinct from genuine chain deposits. Existing corrections MUST remain source-specific and tied to an existing same-wallet operation; preserve their exact-accounting, current-authority, audit, duplicate and nonnegative-available-funds safeguards. Neither operation may reclassify retained referral/reserved funds, rewrite receipts/history or impersonate chain confirmation. Reuse/extension of ledger primitives MUST NOT expose arbitrary balance patches or fake reference records. (US3/AC2/4-5; C1)
- **FR-026**: Sweeps MUST be authorized operator-triggered protected transfers to fixed configured treasury. Signer authority MUST independently bind operation/network/token/assigned source/destination/exact amount/current limits to durable intent and reject arbitrary destination or intent changes. (US5/AC1-2)
- **FR-027**: Sweeps/company resource funding MUST affect only company chain holdings and recorded costs, with zero new employee credit or wallet deduction. Sweep events MUST NOT qualify as employee deposits. (US5/AC4)
- **FR-028**: New sweep dispatch MUST verify recovered source control, current funds, activation/resources and amount/resource limits. Concurrent intents MUST not spend the same funds or ignore possibly sent attempts. Insufficiency MUST remain a truthful operational state. (US5/AC1-2)
- **FR-029**: Before broadcast, transfer attempts MUST durably preserve protected signed material, transaction/attempt identities and broadcast intent bound to immutable operation/network/token/source/destination/amount. Lost signer replies/restart MUST recover the same attempt without signing a second transfer. (US5/AC1/3)
- **FR-030**: Unknown acknowledgement MUST leave sweeps unresolved until original-attempt reconciliation. Safe retries reuse/reconcile that attempt; replacement requires authoritative proof the prior attempt cannot execute/succeed. Success requires verified canonical-final execution. Timeout cannot cause guessed failure/new payment/employee credit/refund. (US4/AC3-4; US5/AC3-4)
- **FR-031**: Provide capped operator resource-funding instructions and basic shortfall alerts without secrets in commands/scripts/dashboard; no automatic top-up/staking/energy-market trading/complex batching. Company operations cannot add admin approval to automatic deposits or future due employee payouts. (US5/AC2/5)
- **FR-032**: Basic reconciliation MUST account for receipt/ledger/source agreement and sweep source/treasury movement/company costs, identify gaps/conflicts and expose safe audit/progress/shortfall state. Protected emergency new-dispatch pause MUST block initial and rebroadcast admissions committed after the pause; durable broadcast-intent admission is the cutoff. Already admitted work may finish sending and MUST remain possibly sent until reconciled. Existing confirmations/reconciliation MUST continue during pause and weekends. (US4/AC2/4; US5/AC4-5)
- **FR-033**: Restore MUST fence financial writes/new dispatch until required keys/assignments, financial commits and immutable attempts are recovered and chain/in-flight outcomes reconciled. Missing history remains an unresolved gate; rescan cannot reconstruct off-chain commits. P06 MUST prove its isolated recovery boundaries; P11 retains complete deployed WAL/point-in-time/full-system acceptance. (US1/AC4; US4/AC3-4; US5/AC3/6)
- **FR-034**: Add actual automated custody recovery/secret, deposit verification/atomicity/replay/concurrency, restart/pagination/recovery, owner/admin/manual-credit and sweep/lost-ack tests. Run affected ledger/session/contracts/migration regressions with real required boundaries, including populated upgrade/rollback. Network doubles cannot replace financial persistence or actual recovery evidence. (All stories)
- **FR-035**: Controlled testnet provisioning/deposit/sweeps MUST be separately opted in and excluded from ordinary discovery, requiring explicit test network/token, test-only keys/recipients, provider access and funding/resources. Missing/mainnet configuration fails closed. Record public transaction identities/finality/reconciled amounts, never secrets. (US5/AC6)
- **FR-036**: All required backend/recovery/secret/regression and real testnet evidence MUST pass before P07. Reports distinguish fresh checks, reused predecessor results, failures and unavailable/unexecuted checks. Missing evidence keeps gates incomplete; no production/security guarantee or funds authorization follows. (All stories; scope/gates)

### Key Entities _(include if feature involves data)_

- **Deposit Address Assignment**: Permanent employee/company-controlled address/network binding, provisioning/publication readiness and recovery acknowledgement; preserved after lifecycle changes.
- **Protected Custody Recovery Record**: Integrity-protected encrypted key/address/employee binding, recovery version/acknowledgement and separately protected decryption authority; private.
- **Deposit Candidate and Scan Progress**: Observed event/verification/uncertainty, resumable bounded progress/replay/pending work for delayed events and restarts.
- **Confirmed Chain Receipt**: Immutable network/transaction/log identity, verified token/recipient/exact units and canonical execution/finality evidence linked to one financial credit.
- **Financial Credit and Audit**: Existing append-only source-aware outcome with actor/business identity and exact available effect; chain/admin origins remain distinct.
- **Manual Credit Intent/Outcome**: Target/exact amount, fixed NON_REFERRAL grant classification, reason/external-or-same-wallet-ledger reference, confirmation and payload-bound request/business identity with recoverable administrative result; existing source-specific corrections remain distinct.
- **Sweep Intent and Transfer Attempt**: Operator-authorized fixed source/treasury/network/token/amount/policy, protected immutable signed attempt/transaction/broadcast intent and unresolved/final outcome; no employee wallet effect.
- **Treasury/Recovery State**: Company destination/resource limits, safe liquidity/progress alerts, dispatch pause and restore fence/reconciliation status; no exposed secrets.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every published address in concurrency/lost-reply acceptance has exactly one recoverable employee/key/address binding, including a fresh address restored after host loss. Zero addresses are published without acknowledged recovery or reassigned. (US1; FR-007-011)
- **SC-002**: One event processed 100 times/concurrently produces one receipt/credit; two eligible logs within one transaction produce two distinct credits. 1.000001 USDT is exact and forced financial failures leave zero partial effects. (US2; FR-014-016/034)
- **SC-003**: Every tested invalid/unfinalized/disappearing event or user-only claim produces zero deposit credit. Eligible weekend/closed-window/Free/expired transfers credit without an added wait/approval. (US2; FR-012-018/020)
- **SC-004**: After multi-page/replay interruption, delayed events/provider outage/restart, every eligible fixture event is accounted for once with exact receipt/ledger/source agreement and zero lost work. Unresolved gaps remain visible without guessed balances. (US4; FR-015-020/032-034)
- **SC-005**: Authority checks produce zero unauthorized cross-account/secret disclosure. Each new manual grant, including an empty wallet's first credit, posts once as available NON_REFERRAL with its reference/audit; existing corrections retain their source-specific safeguards; replay/races/lost-response recovery add no extra credit, payload changes conflict and genuine receipts/existing sources/reservations remain intact. All matching history is reachable across more than one page. (US3; FR-003-006/021-025)
- **SC-006**: Each permitted sweep reaches fixed treasury through one safely reconciled logical transfer; lost acknowledgements/restart cause zero duplicate movement/employee wallet effect. Unauthorized signing/policy/resource violations cause zero unauthorized sends. A committed dispatch pause permits zero later initial/rebroadcast admissions; work with durable broadcast-intent admission before the pause may finish sending and remains possibly sent until reconciled. Confirmations/reconciliation continue during pause and weekends. (US5; FR-026-032)
- **SC-007**: Secret-isolation/fresh-key recovery checks expose zero sentinel custody/decryption/signing secrets in public outputs, diagnostics or browser/build artifacts. Missing required recovery/history keeps admission fenced in every tested restore case. (US1/4/5; FR-005-007/011/033-034)
- **SC-008**: Provisioning/deposit/sweep testnet journeys each provide actual transaction/finality/amount evidence and all required isolated/backend/regression gates pass before P07. Zero unavailable/unexecuted checks are marked passed and zero frontend presentation/files change in P06. (FR-001/034-036)

## Assumptions

- Deposit holds/asset scope, exact accounting, unique company custody and single-admin/no-2FA decisions are settled. No commercial deposit cap or public-TxID ownership shortcut is inferred.
- Existing money/ledger/session/history foundations are reused; enum/test fixture/correction support is not implemented deposit/manual-credit behavior.
- The approved provider relationship is direct TronWeb/TronGrid access inside protected company boundaries, as required by PLAN.md Section 3.6; an external custodial payment provider cannot replace it. This constraint does not choose SDK methods or technical architecture.
- C1 is resolved by the owner's delegated recommended-choice instruction: new grants allow initial credit and meaningful external/same-wallet-ledger references, use server-fixed NON_REFERRAL classification and retain a distinct administrative origin. Existing corrections remain source-specific; this policy requires P06 implementation rather than being inferred from current correction code.
- Generation does not promise activation/resources. Exact provider canonical evidence and operational scan/replay bounds must be established during planning and proven at acceptance; no arbitrary detection-latency/capacity promise is added.
- Network/token, provider access, treasury/resource limits, recovery owner/storage/decryption authority and test funding remain operational prerequisites, not verified SPECIFY facts. No mainnet fallback, credential creation with real secrets or deployment/spending follows.
- P06 proves isolated custody/assignment/deposit/attempt recovery. P08 owns employee payout policy; P11 owns complete deployed post-snapshot off-chain/WAL recovery and release. Later obligations remain mandatory.
- Prior presentation exceptions are phase-bound. P07's deposit copy/confirmation conflicts require its owner decision and do not authorize P06 UI edits.
- Compromised authorized admin/host risks remain despite isolation, limits, audit/recovery. Independent money/security review and owner release approval remain launch gates; no security guarantee is made.
