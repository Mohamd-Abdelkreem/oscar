# Implementation Plan: P06 - TRON Custody, Deposits, and Basic Treasury Backend

**Branch**: `005-proofs-tasks-codes-review` (actual Git branch) | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P06 - TRON Custody, Deposits, and Basic Treasury Backend

**Feature Directory**: `specs/006-tron-custody-deposits`

**Input**: Clarified P06 spec, including C1. `.specify/feature.json` selects this directory. Installed setup-plan returned feature identifier `006-tron-custody-deposits` as BRANCH; it did not create/change the actual Git branch.

**Status**: PLAN design complete; proposed implementation and P06 acceptance unexecuted. Only this plan and its research/data-model/contracts/quickstart are PLAN outputs. No tasks, code, approval markers, pointer, roadmap or constitution changes are authorized here.

## Summary

Deliver protected company custody, recoverable unique employee deposit addresses, automatic exact confirmed USDT credit, resumable detection, safe employee/admin history, distinct ADMIN manual grants and operator-triggered fixed-treasury sweeps. Reuse the ledger/session/contract/persistence owners. Add a private signer and polling worker inside the API build, one API-only TronWeb dependency, encrypted immutable off-host recovery records and financial-admission fencing. See [research](research.md), [data model](data-model.md), [HTTP contract](contracts/deposits-api.md) and [protected runtime contract](contracts/custody-runtime.md).

P06 is backend only. P07 owns deposit UI integration; P08 owns employee withdrawal policy/reservations/scheduling/payouts; P10 owns cross-domain administration; P11 owns deployed WAL/PITR, full recovery and release. No frontend files/presentation, direct-to-package transfers, other assets/networks, external custody provider, custom smart contract, automatic top-ups/energy trading, generic outbox or accounting platform is added.

## Technical Context

**Language/Version**: TypeScript 5.9.3 ESM/NodeNext; Node `>=24 <25`, inspected runtime 24.18.1; pnpm 11.17.0.

**Primary Dependencies**: Existing Express 5.2.1, Prisma/adapter 7.9.1, pg 8.22.0, Zod 4.4.3, Pino 10.3.1, Vitest 4.1.10, Supertest 7.1.4, PostgreSQL Testcontainers 12.1.0. Proposed API-only `tronweb: 6.5.1`, pinned with lockfile during implementation; bundled types/ESM inspected, Node24 import/sign/build remains a test gate. Node crypto/fs and operator-provisioned OpenSSH provide encryption/recovery; no additional npm crypto/backup library. Redis/BullMQ is deferred to P08's actual scheduling need.

**Storage**: Existing migrated PostgreSQL 18.4 owns wallet/ledger/account/history. Proposed assignment/candidate/window/receipt/manual-credit/sweep/attempt metadata and control rows also live there. Keys/signed bytes live only in signer-private encrypted storage and acknowledged independent recovery storage. API/worker have no key mounts/decryption authority. No transaction spans provider, signing or recovery I/O.

**Testing**: Existing Vitest/Supertest and migrated Testcontainers harnesses; real PostgreSQL, nonowner DB roles, actual files/Linux identities, fixed clocks/independent-connection barriers, isolated forced-SSH helper and provider network doubles. Proposed separate `test:testnet` and testnet typecheck/discovery; actual provider/funding/recovery-host evidence is required before P07.

**Target Platform**: Existing API plus proposed private worker/signer/operator CLI on Linux. Recovery helper is a one-shot command on an independent Linux host, not another application service. Windows tests do not prove Linux UID/file isolation. Full Docker/VPS deployment remains P11.

**Project Type**: Existing `@template/api`, browser-safe `@template/contracts`, persistence `@template/database`. Next.js/React/transport remain untouched.

**Performance Goals**: Bounded requests and eventual recovery under verified provider coverage; no invented zero-latency/throughput guarantee. Proposed defaults: 10-second provider timeout, 2 MiB response limit, discovery page 100 (provider maximum 200), five pages/address/pass, candidate batch 50, four concurrent reads, three retry attempts with bounded backoff/Retry-After. Fair address/window selection prevents starvation. Operational overrides are validated against provider plan limits.

**Constraints**: Exact micro-USDT/JSON decimal strings; once-only canonical-event credit; no commercial deposit cap/hold/admin rejection; current session/ownership authority; key recovery before address publication; immutable attempts before broadcast; no public signing/key-export route; no funds execution by PLAN; accepted no-2FA/single-admin and compromised-host residual risk.

**Scale/Scope**: P06 only; roadmap target of 1000 registered employees over a year, without claiming 1000 concurrent users. One worker/signer initially; DB integrity still tolerates overlap/restarts.

## Existing Evidence and Predecessor Gates

| Existing owner/evidence                                                                                       | Reuse and boundary                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/financial/money.ts`, `modules/ledger/ledger.{service,transaction,types,effects}.ts`                     | Exact units, transactional source effects, sorted locks and recognized Serializable retries. No live custody/deposit detection yet.                      |
| `modules/auth/session-authority.ts`, middleware and financial/task services                                   | Current account/session/role authority and transactional rechecks; no second auth stack.                                                                 |
| `packages/contracts/src/{financial,wallet,http}/`, `modules/wallets/`                                         | Amounts/envelopes/bounded history; retain public CREDIT/ADMIN_ADJUSTMENT compatibility.                                                                  |
| Database schema/migrations through `20261005000100_p05_tasks_proofs_review`                                   | Existing financial/auth/subscription/task history; P06 models/guards are proposed.                                                                       |
| API manifest/tsconfigs/Vitest and `scripts/assert-build-output.mjs`                                           | Existing build/harness; worker/signer/testnet/treasury/recovery scripts are absent.                                                                      |
| P01/P02 evidence reused through `specs/003-auth-account-frontend/tasks.md`; P03 all 65 tasks/local acceptance | Foundations accepted locally. Dedicated admin login exists; historic missing-screen warning is superseded by its phase-specific owner decision/evidence. |
| `specs/004-packages-referrals-wallet-finance/tasks.md`, T078                                                  | T001-T078 and both P04 gates recorded complete.                                                                                                          |
| `specs/005-proofs-tasks-codes-review/tasks.md`, T093-T095 and quickstart                                      | All 95 P05 tasks and both gates revalidated on 2026-10-06.                                                                                               |

These are reused recorded results, not fresh PLAN tests or release evidence. Separate CONVERGE is not reinstated as a prerequisite; P03 records the later owner decision. Guide inventories describing auth-only code are historical. Current roadmap/spec assign the opted-in testnet profile to P06, overriding the old guide's P08 reference.

## Constitution Check

Pre-research review used constitution 1.0.0, entire roadmap, operating contract, all eight guides and applicable instructions. No root/ancestor AGENTS.md or CLAUDE.md exists; web instructions were read for the preserved boundary. No framework-dependent web work occurs. Post-design results follow. PASS means compliant design, not implementation acceptance.

| Principle            | Before research                                         | After design and evidence                                                                                                                                                       |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I Scope/evidence     | PASS: matching P06 pointer/spec; no existing plan suite | PASS: proposed work distinguished, only P06 artifacts, unrelated dirty pointer/spec preserved.                                                                                  |
| II Frontend          | PASS: backend only                                      | PASS: zero web edit targets. P07 obsolete delay/rejection copy and manual-credit confirmation/reason surfaces remain owner gates.                                               |
| III Ownership/design | PASS: packages/versions verified                        | PASS: existing build/contracts/database; one justified dependency; fixed recovery helper/business records without new platform.                                                 |
| IV Prerequisites     | PASS: recorded P01-P05 gates inspected                  | PASS: bounded backend ordering; complete local/recovery/testnet P06 gate before P07; no extra CONVERGE requirement.                                                             |
| V Finance/custody    | PASS: clarified C1/formulas retained                    | PASS: canonical log identity, exact atomic source credit, grant/correction distinction, permanent ownership, durable same-attempt sweep/fenced restore. Withdrawals remain P08. |
| VI Security          | PASS: process/ADMIN/employee boundaries identified      | PASS: current commit authority, separate credentials/mounts/roles, output allowlists, intent policy/audit; residual risk explicit.                                              |
| VII Verification     | PASS: actual harness/scripts inspected                  | PASS: concrete tests/real boundaries/commands below. Missing provider/recovery/funding/Unix evidence remains incomplete acceptance.                                             |

No constitutional exception/amendment is required. Security-best-practices informs the Express/process/input/egress/secret design; docs-guard reviews the suite's factual claims and proposed-state labels.

## Project Structure

### Documentation

```text
specs/006-tron-custody-deposits/
  spec.md                         # existing; read-only
  checklists/requirements.md      # existing markers; read-only
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/deposits-api.md
  contracts/custody-runtime.md
```

`tasks.md` is a later TASKS output, not created here.

### Source ownership and proposed targets

| Owner               | Proposed targets; extensions refer to existing files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire schemas        | New `packages/contracts/src/deposits/deposit.schema.ts`; extend `src/index.ts`. Reuse financial/http schemas; no new public financial kind/origin.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Persistence         | Extend `packages/database/prisma/schema.prisma`; new forward `prisma/migrations/20261006000000_p06_tron_custody_deposits/migration.sql`. Preserve applied migrations/generated client.                                                                                                                                                                                                                                                                                                                                                                         |
| HTTP/history/grants | New `apps/api/src/modules/deposits/{deposits.routes.ts,deposits.controller.ts,deposits.service.ts,deposits.queries.ts,deposits.mapper.ts,manual-credit.service.ts}`; extend `router.ts` and `infrastructure/openapi/openapi.ts`.                                                                                                                                                                                                                                                                                                                               |
| Deposit automation  | New `modules/deposits/{deposit-verifier.ts,deposit-indexer.ts,deposit-credit.service.ts,deposit-reconciliation.ts}` and `infrastructure/tron/{tron-provider.ts,tron-receipt.ts}`.                                                                                                                                                                                                                                                                                                                                                                              |
| Protected custody   | New `modules/custody/custody.service.ts`, `infrastructure/custody/{key-storage.ts,recovery-store.ts,recovery-store.cli.ts}`.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Treasury            | New `modules/treasury/{treasury.service.ts,treasury-reconciliation.ts,treasury.cli.ts}`, `infrastructure/tron/tron-signer.ts`; no employee payout policy.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Runtime/admission   | New `worker.ts`, `signer.ts`, `modules/custody/{runtime-control.ts,recovery.cli.ts}`; extend existing `server.ts`, necessary `app.ts`/`router.ts` composition and `modules/{subscriptions/subscription-purchase.service.ts,task-submissions/task-review.service.ts}` constructor propagation for API boot authority. Extend `modules/ledger/{ledger.transaction.ts,ledger.service.ts,ledger.types.ts,ledger.effects.ts,ledger-reconciliation.evidence.ts}` for admission/grants. Wallet mapper/query changes only for compatible safe projections if required. |
| Config/tooling      | New `core/config/{tron.config.ts,custody.config.ts}`/private runtime parsers; extend `.env.example`, API manifest/testnet configs/typechecks/build exclusions and `scripts/assert-build-output.mjs`. Privileged config never enters public config barrels/app/router imports.                                                                                                                                                                                                                                                                                  |

Paths in shortened rows are under `apps/api/src/`. This map does not require tiny forwarding files: combine local helpers when coherent. Provider/signer/storage boundaries remain distinct for permissions/failure testing. No `apps/web` production edit is in scope.

## Architecture and Transaction Boundaries

### Provisioning and acknowledged recovery (FR-002-011)

Authenticated USER POST creates/observes one durable employee/network provisioning record with current runtime admission/account/session checked under lock; GET only reads state. Restore fences new provisioning requests/publication as well as financial mutations, preventing fresh bindings against incomplete restored ownership. Repeats converge on the same record. Before generation, capture/retain a conservative solidified chain block/timestamp as the inclusive replay floor. Signer conditionally claims and generates/fsyncs an assignment-bound key envelope. If it exists after interruption, decrypt/validate/rederive it instead of regenerating. Preserve unpublished envelopes.

The forced-SSH helper stores immutable ciphertext off-host, fsyncs file/publication directory and acknowledges matching digest/readback. Then commit matching recovery metadata and READY binding. Unique employee/network and network/address constraints retain permanent ownership. No public address before acknowledgement. Generation, recovery readiness, activation and resources are separate facts. Bans/expiry never reassign addresses or stop qualifying inbound credit.

Signer-only files/keys and nonowner DB permissions are unavailable to API/worker; signer has no public listener. Real Linux identities/SSH/file tests prove isolation. Rotation retains every old decryption version until acknowledged replacement and recovery validation; no old published key is discarded.

### Durable discovery, verification and credit (FR-012-020)

Pin network/genesis/provider/token and verified six decimals. Per-address discovery uses `only_to=true`, configured contract, `only_confirmed=true`, fixed timestamp bounds, ascending order, bounded limit and opaque fingerprint. Construct URLs locally. Candidate insertion/page progress commit together. Hot overlapping windows plus recurring bounded historical replay cover delayed observations; inclusive boundaries avoid equal-time skips. Pending candidates survive finished windows and restart. Invalid fingerprints restart the same fixed window; malformed/outage responses never advance as empty successes.

Verifier obtains solidified transaction/receipt/block evidence and decodes complete canonical logs. Check execution, token/event ABI, assigned recipient, sender/exact positive units. Raw unfiltered array position becomes logIndex. Wrong/unfinalized/disappearing/conflicting candidates remain uncredited/recoverable. Distinct eligible logs have separate identities even in one transaction.

`DepositCreditService` uses the existing ledger with allowlisted process `deposit-indexer` and `p06.deposit` identity. Observation checks immutable receipt/link evidence before ledger replay. Domain write creates receipt alongside operation/posting/projection/audit in one transaction. Source is available NON_REFERRAL. Overflow/injected failure leaves no partial effect. Classify only known event constraints; never fabricate a receipt during replay. Candidate completion follows accounting for every eligible log; commit-before-ack repeats are safe. Credit runs 24/7 without hold, approval, package purchase or restored account authority.

### Read projections and manual grants (FR-021-025)

Use strict shared contracts, current role/session, no-store and existing envelopes. History page/count reads use RepeatableRead and `recordedAt DESC,id DESC`, identical filters and bounded pages. Public chain `confirmedAt` maps exactly to the immutable receipt's `verifiedAt`: the server instant of successful canonical-final verification whose evidence produced that committed receipt. Chain `blockTimestamp` is inclusion time; `recordedAt` is the persisted financial-recording server instant, equal to `FinancialOperation.createdAt`, not PostgreSQL's actual commit timestamp. Replays retain the stored values. Confirmed chain credits/manual grants are distinct. Pending detection health is separate from confirmed money. No key/raw provider/recovery/attempt payload is projected.

Manual POST requires current ADMIN at commit, CSRF, confirmation, canonical positive amount, reason, external/same-wallet reference, durable actionId and request key. Server fixes NON_REFERRAL. Fingerprint binds original actor/target/amount/reason/reference/confirmation. `p06.manual-credit` plus global actionId is independent of request aliases. CREDIT/ADMIN_ADJUSTMENT, ManualCredit, available effect and server audit commit together. Because ledger inserts AuditRecord before domainWrite, grant/audit/ManualCredit cross-row consistency is deferred until transaction end; immediate actor/action/basic checks remain. Same action/new key recovers; changed actor/payload conflicts. Revoked ADMIN cannot mutate/replay with stale authority. CORRECTION and historical public kinds/origins/snapshots remain compatible; no source relabeling or fake prior operation/receipt occurs.

### Fixed sweeps and uncertain attempts (FR-026-032)

Protected CLI records assignment source, exact amount, operation ID/reason and fixed configured treasury/network/token/policy. No destination/key/raw-signing argument or public signing route exists. Treasury cannot be an employee assignment. One active sweep/source includes signing/signed/submitted/UNKNOWN. Signer independently verifies durable version/authority, recovered key, fresh funds/resources, current limits and unsigned fields: one allowed transfer, source/token/exact calldata recipient/amount, zero call value, permissions, expiration and TxID.

Build/sign outside DB transactions. On resume first inspect local/off-host signed envelope under the reserved attempt ID, even if DB TxID/digest metadata is still null; recover it before any rebuild/sign. Archive the returned signed object and complete immutable intent/policy/operator/reason/source-claim/timestamps. Persist/acknowledge signed recovery and broadcast intent before `sendRawTransaction`. Every interruption resumes identical material. Acknowledgement is SUBMITTED/UNKNOWN, not success. Duplicate errors/empty lookups do not prove finality. Within validity/policy, retries use identical bytes. Automatic replacement is disabled; authoritative nonexecution/complete coverage is required to close expired possible submission, otherwise it stays UNKNOWN/active. New intents cannot bypass its source claim.

Canonical successful exact movement to fixed treasury closes success. Canonical failed execution with verified zero intended token movement closes CHAIN_FAILED, retaining actual company costs; no automatic replacement follows. No wallet operation/credit/deduction is performed. Company costs use exact TRX/SUN/current chain parameters; energy `fee_limit` is distinct from activation/bandwidth/other costs. Funding is manual/capped. Reconcile ledger/source agreement separately from custody movement/costs/attempts. Use `/walletsolidity/getaccount` and `/walletsolidity/triggerconstantcontract` for balances, bracketed by the same provider's `/walletsolidity/getnowblock`; retry if cutoff changes. Head-state queries are insufficient; normal balances are not arbitrary-height snapshots or wallet totals. Diagnostics contain allowlisted codes/IDs/counters/timestamps only.

### Restore fencing, pause and shutdown (FR-033)

Mutating ledger `execute`/`runInTransaction` acquire shared advisory transaction admission and locked control-row read before existing account/wallet locks, including replay that binds a new request alias. Restore takes the exclusive lock, drains current mutations and commits the financial fence. Serializable locked reads/recognized retries prevent stale-snapshot bypass. Observation/reconciliation methods remain available. All purchases/rewards/deposits/grants share this boundary.

P06 intentionally narrows `LedgerService.recoverOperation` to a read-only observation for every call, including `execute`'s post-abort uniqueness recovery. Current source calls `replay`/`bindAlias` and can insert RequestIdentity; T012 must remove that side effect from recovery without changing accepted historical records. Recovery still checks current observation authority, existing request-key conflicts, matching business payload/outcome and applicable receipt evidence, then returns the stored outcome or null. It never inserts an alias or invokes domain writes, even after admission opens. A fresh request key may therefore recover the original outcome without becoming bound; binding it requires admitted `execute`/`runInTransaction` replay. Closed boot/restore admission leaves authorized recovery reads available with all financial rows unchanged. Existing P01 artifacts remain historical; this P06 change does not waive identity or authority checks.

Signer admission separately rechecks financial fence/dispatch pause in the short durable broadcast-intent transaction. That admission is the observable dispatch cutoff: already admitted work remains possibly sent/reconcilable. A pause stops new admissions while confirmations/reconciliation continue, including weekends. No transaction spans network/storage I/O. Shutdown stops new claims, persists incomplete work and closes owned resources.

Each API/worker/signer boot creates a fresh in-memory boot UUID and registers a narrow FinancialRuntimeAdmission request; no restored acknowledgement is reused. Existing `server.ts` owns API registration and injects process admission through app/router into every LedgerService owner, including existing SubscriptionPurchaseService and TaskReviewService. Boot ID is never selected through LedgerContext/client/job input, environment fallback or restored rows; missing binding fails closed. Mutations/new dispatch wait for protected acknowledgement of that boot/current generation and recheck it under the shared control lock. Runtime roles cannot acknowledge/open admission. Restore advances generation, invalidating old boots. Stale OPEN/new API without tooling cannot authorize finance. Missing inventory/assignments/attempts/off-chain history stays fenced. P06 tests actual startup; P11 proves supervisors/WAL/PITR/full recovery. Rescans never fill lost purchases/rewards/grants.

### Basic operational criteria (FR-020/031-032)

The [runtime contract's operational policy](contracts/custody-runtime.md#operational-signals-and-operator-ownership) defines required triggers, finite thresholds, safe fields, repetition bounds and operator ownership. Proposed process-config values `scanLagAlertAfterMs` and `pendingWorkAlertAfterMs` default to 300000 ms, each validated as an integer from 1000 through 86400000 ms; these are alert criteria, not deposit-latency promises. T008/T009 own their parser/default/boundary checks. T043 owns scan/pending/recovery/conflict/fence events; T064 owns unresolved-attempt/resource events and operator guidance. Tests use fixed clocks just below/at thresholds, state transitions and a captured existing logger destination, proving no raw provider/private payload or repeated-loop alert flood. The protected treasury/recovery operator reviews that output and follows reconciliation or capped manual-funding procedures; an actual designated person/log destination is an operational acceptance input. No notification service, monitoring platform or automatic funding is added.

## Dependency-Safe Implementation Ordering

These are bounded delivery batches for later TASKS, not task IDs or additional roadmap phases.

1. Shared contracts, forward schema/guards, receipt/grant constraints, role harness and populated-upgrade tests; preserve historical credit/correction data.
2. Private config, local/off-host records, provisioning/startup/shutdown/fence; prove fresh-key recovery and isolation before READY publication.
3. Provider verification, durable windows/candidates, atomic credit and replay/concurrency/recovery/reconciliation.
4. Employee/admin DTO endpoints and compatible grants, HTTP/session/CSRF/lost-response tests; web consumers stay untouched.
5. Fixed-treasury CLI/signing/attempts/capped resource guidance, reconciliation/pause/uncertainty tests; no payout work.
6. Focused/shared checks, Linux/independent-host recovery and actual opted-in provisioning/deposit/sweep testnet acceptance. Only complete P06 acceptance permits P07.

## Test Strategy and Future Paths

| Proposed path                                                                              | Observable behavior / real boundary                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/deposits/deposit.schema.test.ts`                                   | Strict fields/precision/bounds, reference alternatives, readiness union, chain/manual labels, safe envelope/pagination.                                                                                                                |
| `packages/database/tests/integration/p06-custody-deposits-upgrade.integration.test.ts`     | Populated P05 upgrade, old snapshots/history, repeated deploy, controlled late-migration rollback.                                                                                                                                     |
| `packages/database/tests/integration/p06-custody-deposits-constraints.integration.test.ts` | Ownership/log identity/immutable links/grant guards/active sources and nonowner grants/denials; extend existing schema/migration inventory tests.                                                                                      |
| `apps/api/src/infrastructure/custody/key-storage.security.test.ts`                         | AEAD/tamper/rotation/containment and sentinel-secret diagnostics with real files.                                                                                                                                                      |
| `apps/api/src/modules/custody/custody-recovery.integration.test.ts`                        | DB/files/actual isolated SSH helper/Linux identities: provisioning races, interrupted/lost ACK, no premature address, fresh-key host loss, stale DB inventory, mismatch fences.                                                        |
| `apps/api/src/modules/deposits/deposit-verifier.test.ts`                                   | Realistic raw receipts, wrong network/token/recipient/ABI, failed/unfinalized/contradictory data, raw indices, uint256/fraction/range; network doubles.                                                                                |
| `apps/api/src/modules/deposits/deposits.integration.test.ts`                               | Real DB/service: 100 replays, two logs, exact 1.000001, ban/Free/expiry/weekend, overflow and receipt/posting/audit rollback.                                                                                                          |
| `apps/api/src/modules/deposits/deposit-concurrency.integration.test.ts`                    | Independent clients/barriers: scanners/credits/purchase/grant races, evidence conflicts and exact ledger/source counts.                                                                                                                |
| `apps/api/src/modules/deposits/deposit-recovery.integration.test.ts`                       | Pages/equal timestamps/host-clock skew/cursor expiry/delayed historical events, outage/restart, actual API stale-OPEN boot without tooling, drain/fence/missing off-chain history.                                                     |
| `apps/api/src/modules/deposits/deposit-history.integration.test.ts`                        | Actual app/auth/CSRF routes: cross-account/role/revoked-session denial, multi-page filters/totals/no-store/private-field absence.                                                                                                      |
| `apps/api/src/modules/deposits/manual-credit.integration.test.ts`                          | First external grant/same-wallet ref, fixed source/confirmation/reason, replay/new key/actor/payload conflict/lost response, atomic audit and unchanged corrections/reservations/receipts.                                             |
| `apps/api/src/modules/treasury/treasury-sweeps.integration.test.ts`                        | DB/files/attempt stores/provider doubles: authority/limits/tamper/source race, early sealed-envelope/DB metadata crash, lost ACK, identical retry, expiry uncertainty/canonical chain failure/costs/pause/restart, zero wallet effect. |
| `apps/api/src/infrastructure/tron/signer-security.test.ts`                                 | Independent intent/unsigned policy, secret absence and public import cannot initialize signer.                                                                                                                                         |
| `apps/api/testnet/{custody,deposits,sweeps}.testnet.test.ts`                               | Separate opt-in real provider/network/token/test funding/independent recovery: provisioning, exact inbound credit, sweep/finality/costs/restart; public identities only.                                                               |

Extend existing ledger service/concurrency/reconciliation, session/auth, wallet projection, API config/composition and database migration regressions where affected. Extend existing `apps/api/src/modules/ledger/testing/financial-fixtures.ts` to explicitly admit its known-clean disposable DB after the new initially closed fence; this is test-only setup, never a production fallback. Custody/recovery tests separately prove default-closed startup and failed admission. Do not duplicate whole predecessor suites or mock Prisma for financial evidence. Use fixed clocks and separate connections/barriers; close processes/clients/files/network doubles on success/failure.

Manifest-backed commands/new script proposals are in [quickstart](quickstart.md). Implementation needs focused/shared suites, schema validate/generate, lint/types/build/build-output and applicable code/test/security/docs reviews. P06 is not a full-current-regression checkpoint; P07 retains that checkpoint. Later production deployment does not waive P06 Linux/recovery/testnet evidence.

## Gates and Risks

- Design decisions are resolved and constitution checks PASS for planning; no requirement approval/test success follows.
- Local acceptance requires migrations/constraints, custody isolation/fresh recovery, exact replay/races/restart, grants/HTTP authority, sweeps/uncertainty/fence and affected regressions with actual boundaries.
- Operational/testnet acceptance is INCOMPLETE: explicit network/token/genesis/provider coverage, test-only keys/recipients/funding, caps, independent recovery host/owner/decryption and actual journey evidence remain unverified.
- P07 presentation/confirmation/reason conflicts require its owner decision under the freeze; no P06 UI change is authorized.
- Admin/host compromise remains possible. Independent money/security review, deployed WAL restore, UAT and release authorization remain later gates.

## Complexity Tracking

No principle is waived. Separate permissions, fixed recovery helper, event identity and shared admission fence are necessary custody/recovery controls. A nightly backup or queue lock cannot meet approved requirements. No speculative registry, queue framework or microservice is introduced.
