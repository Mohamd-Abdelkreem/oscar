# Implementation Plan: P05 - Private Proofs, Tasks, Codes, and Review

**Branch**: `005-proofs-tasks-codes-review` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P05 - Private Proofs, Tasks, Codes, and Review

**Feature Directory**: `specs/005-proofs-tasks-codes-review`, verified against `.specify/feature.json` and the clarified specification.

**Input**: Complete merged P05, including the five accepted owner decisions. Originally generated under PLAN only; the owner authorized bounded U1/U2/I1 amendments and full preimplementation quality review on 2026-10-05. Installed speckit-plan/tasks/analyze and docs-guard rules apply within that scope. Research/design steps are not additional roadmap phases or application implementation authority.

## Summary

Deliver private bounded raster proofs, one common dated task, globally unique codes/durable unlocks, one employee/day submission with captured entitlement, pending evidence replacement and one final review. Approval alone credits the captured non-referral reward through the existing ledger. After the entire backend passes Gate B, integrate the nine existing task/code/review routes through shared schemas, feature adapters/hooks and the established transport. Gate F completes the merged phase.

Extend P01-P04. PostgreSQL owns eligibility, command outcomes, claim/decision uniqueness and audit; local files have recoverable lifecycle metadata. No queue, general outbox, recurring scheduler or second financial/auth system is needed. Decisions are in [research.md](research.md), persistence in [data-model.md](data-model.md), HTTP in [contracts/http-api.md](contracts/http-api.md), UI in [contracts/ui-integration.md](contracts/ui-integration.md), validation in [quickstart.md](quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node >=24 <25, pnpm 11.17.0, ESM; preserve API `.js` imports, web aliases and contracts exports.

**Primary Dependencies**: Express 5.2.1, Zod 4.4.3, Prisma/adapter 7.9.1, PostgreSQL 18.4, Luxon 3.7.2; Next 16.2.12, React 19.2.8, TanStack Query 5.101.4, Axios 1.19.0 and existing form/control libraries. Propose API-direct `@fastify/busboy` 3.2.2 and `sharp` 0.35.5 for bounded multipart/raster processing. Compatibility/upstream evidence is in research; reverify native binary installation/advisories during implementation. No dependency/lockfile changes occur in PLAN.

**Storage**: Existing wallet/ledger/subscription/session models plus proposed P05 models and forward SQL migration. Private local proof/illustration files outside source/public/static roots, server-generated keys, staging and durable leases. Bounded maintenance belongs to API lifecycle; no Redis addition. Production volume/backup/native-memory limits remain P11 obligations.

**Testing**: Existing Vitest 4.1.10, Supertest 7.1.4, Testing Library 16.3.2, Testcontainers 12.1.0 and Playwright 1.63.0. Real migrated PostgreSQL for transactions/constraints/races; actual isolated files/decoder child for storage; real test Next/API/DB/private IPC for browser. Manifest-backed commands are in quickstart. No P05 tests ran in PLAN.

**Target Platform**: Existing browser and Node API, initially one API process/two admitted processing slots. API owns parser/decoder/maintenance startup and shutdown. No custody, signer, deployment, mainnet or spending work.

**Project Type**: Existing web/API monorepo: wire schemas in `@template/contracts`, persistence in `@template/database`, adapters in API infrastructure, business services in API modules and UI in current features.

**Performance Goals**: 1,000 registered employees over a year, not concurrent users. Page default 25/max 100; indexed deterministic lists/consistent filtered counts. Research specifies finite bytes/pixels/frame/channels/output/time/slots/staging budgets. These are safety limits, not latency or hard native-RSS guarantees.

**Constraints**: Baghdad weekdays 12:00 inclusive/18:00 exclusive; unique employee/date claim across subscriptions/tasks/keys; current revision on first submission; date frozen after participation; globally unique retained normalized codes. Captured exact reward, zero pending credit, atomic final reward/status/audit, rejection without deduction. Proof retention >=30 complete days and all pending evidence versions exempt. Current server session/role/status/ownership. Frozen UI with accepted C1/C2 only.

**Scale/Scope**: One backend-then-frontend feature, nine existing routes. Exclude P06-P11 custody/deposits/withdrawals/cross-domain administration/deployment; no proof gallery, configurable task hours, code caps/independent expiry, clawback, new routes or global fixture-provider removal.

## Constitution Check

**Initial check**: Recorded PASS before research. **Post-design check**: PASS at requirements/design level after owner-authorized U1/U2/I1 amendments on 2026-10-05 and independent backend/frontend/coverage review. All 54 checklist quality items have supporting evidence; native-resource criteria and terminal command/upload fencing are explicit. The final read-only ANALYZE rechecks the amended suite before handoff. Gate B/F remain future execution gates. Constitution 1.0.0 is populated and unchanged; historical inventories are reconciled with source.

| Principle                  | Initial / post-design | Evidence/boundary                                                                                                                                                                                                      |
| -------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I - Scope/evidence         | PASS / PASS           | P05 pointer/spec/branch match; fresh plan suite only; current/proposed facts distinguished. Preserve existing pointer/spec/checklist changes.                                                                          |
| II - Frontend preservation | PASS / PASS           | Spec C1/C2 permit bounded copy/states/reasons/fixed-date adaptations in existing surfaces; no redesign. Admin login now exists with P03 evidence, so historical conflict is resolved for this context.                 |
| III - Ownership/design     | PASS / PASS           | Existing shared schemas/transport/query/Prisma retained; two dependencies justified; focused domain records/adapters, no platform.                                                                                     |
| IV - Backend prerequisites | PASS / PASS           | Reused P03 T001-T065 and P04 T001-T078 B/F completion records. P05 B precedes every UI integration group.                                                                                                              |
| V - Financial/custody      | PASS / PASS           | Existing money/calendar/ledger, captured reward/day uniqueness/one final decision and compatible locks. Approval after target ban preserves all sources/reservations. Custody/payouts out of scope, policies retained. |
| VI - Security              | PASS / PASS           | Current authority, strict inputs, purpose/owner-bound private files, bounded child/lifecycle, reasoned admin audit. One-admin/no-2FA and host risks retained.                                                          |
| VII - Verification         | PASS / PASS           | Concrete proposed test owners, real DB/files/barriers/fixed clock/browser, actual scripts. Planning proves no execution gate or production readiness.                                                                  |

No `.specify/extensions.yml` exists; before/after PLAN hooks are skipped. Predecessor evidence is recorded local acceptance, not fresh tests or deployment approval. No unresolved business/UI clarification remains.

## Project Structure

### Documentation for this feature

```text
specs/005-proofs-tasks-codes-review/
├── spec.md                       # existing clarified input, read-only in PLAN
├── checklists/requirements.md    # existing, read-only in PLAN
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── http-api.md
    └── ui-integration.md
```

`tasks.md` was produced by the subsequent TASKS command. This bounded preimplementation amendment preserves all 92 IDs/unchecked implementation markers and the reviewed custom checklist; it does not regenerate the plan suite or create application files.

### Source ownership

This is a proposed implementation map, not completed P05 files. Extend existing owners narrowly; all new paths below are proposals.

| Owner                                                                                                | Proposed change/reuse                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/database/prisma/schema.prisma`, `prisma/migrations/`                                       | P05 models, named constraints/indexes/immutability guards in a new forward migration. Preserve previous SQL/history/populated finances.                                                          |
| `packages/contracts/src/proofs/`, `tasks/`, `task-codes/`, `task-submissions/`                       | Strict browser-safe schemas/tests; explicit existing `src/index.ts` exports; reuse money/date/http/pagination shapes.                                                                            |
| `apps/api/src/modules/proofs/`                                                                       | Upload/observation/read/retention/lifecycle services, thin HTTP adaptation and safe mapping.                                                                                                     |
| `apps/api/src/infrastructure/files/`                                                                 | Multipart stream, contained storage and supervised decoder child; no I/O inside DB transactions.                                                                                                 |
| `apps/api/src/modules/tasks/`, `task-codes/`, `task-submissions/`                                    | Publication/availability/command audit, codes/unlock/usages, claims/history/evidence/final review. Approval uses existing ledger.                                                                |
| `apps/api/src/core/business-calendar/business-clock.ts`                                              | Focused window/next-opening output extension, existing Baghdad owner/tests.                                                                                                                      |
| `apps/api/src/router.ts`, `app.ts`, `server.ts`, `core/config/`, `infrastructure/openapi/openapi.ts` | Existing composition/lifecycle/HTTP docs; inject storage/clock, register routes; proposed `core/config/proofs.config.ts` validates private root/budgets. Later `.env.example` uses placeholders. |
| Existing API `ledger/`, `auth/`, `subscriptions/`                                                    | Reuse current transactions/session/terms; add `p05.task-reward` composition policy/regressions only.                                                                                             |
| `apps/web/src/features/employee/api/tasks.api.ts`, `hooks/tasks.hooks.ts`                            | Proposed adapters/queries/commands; adapt existing `hooks/use-task-submission.ts` and task components.                                                                                           |
| `apps/web/src/features/admin/api/`, `hooks/`                                                         | Proposed tasks/task-codes/task-submissions adapters/hooks; existing screens remain.                                                                                                              |
| `apps/web/src/features/proofs/api/`, `hooks/`                                                        | Purpose-separated upload/binary adapters and account/resource-owned temporary previews.                                                                                                          |
| `apps/web/src/shared/query/financial-query.ts`, `services/api/`                                      | Bounded P05 namespace/private-read extension; current session runtime/transport/`financial-response.ts`; P04 regressions.                                                                        |
| Existing employee/admin task/code/submission components/actions                                      | Remove migrated P05 fixture authority/callers only. Existing exact-string `MoneyAmount`, confirmations and other domains' providers remain.                                                      |
| Existing DB tests/private IPC/browser harness                                                        | Extend inventory/upgrade/cleanup; proposed `apps/api/tests/e2e/p05-tasks.ts`, `apps/web/e2e/tasks-codes-and-review.spec.ts`. No public fixture-control route.                                    |
| Existing `Caddyfile`                                                                                 | Matching aggregate upload body cap when the existing local ingress is used; app limits remain authoritative. Production ingress deployment remains P11.                                          |

**Structure Decision**: Existing route/controller/service constructor composition, focused policy/query/command/storage collaborators only when warranted. No mandatory repository/DI layers or empty folders. Web routes stay thin/stable; engineering guides govern actual edits.

## Backend Design and Ordered Delivery

These groups inform later dependency-safe tasks; they do not create task IDs or implementation authority.

1. **Contracts/persistence**: Strict input/allowlisted output/date/revision/purpose/command shapes; forward models/SQL with uniqueness, attribution and immutable snapshots/finals; real fresh/populated migration tests and isolated phase fixtures.
2. **File pipeline**: Auth/CSRF/role/limit before bytes; multipart/format/resource budgets; STAGING/upload observation; real canonical file before READY; private reads; startup/retention/recovery/shutdown. Distinct ADMIN illustration upload and employee authorized reads. No claims from unready/deleting assets.
3. **Publication/codes**: Confirmed admin create/edit/status; fixed weekday/date/global code uniqueness, expected revisions, durable unlocks and accurate paginated usage. Task/code locks serialize date-edit/participation and pause/unlock. Safe links are never fetched server-side.
4. **Claims/review**: Current employee work checks and entitlement capture after locks; one date claim/declaration/task snapshot; append replacement evidence before original cutoff. Current admin review binds versions; approval uses existing ledger, rejection has zero money effects.
5. **Gate B**: Entire backend and mandatory failures/races pass before frontend wiring. Apply relevant code/test/security/docs reviews during implementation.
6. **UI after B**: Employee daily/history/unlock/upload/submit/replace and admin publication/code/usage/review; scoped commands/private previews, confirmed P04 wallet/ledger refresh. C1/C2 only, final actions unavailable, no fixture/optimistic money/retries. Run meaningful component/adapter/authenticated-browser checks and affected regressions.
7. **Gate F**: All nine routes persist/reconcile, privacy/focus/phone/desktop checks pass. B alone never completes P05.

### Transactions and replay

- First submission locks employee/current session, task, required code/unlock and asset; re-read clock/eligibility/revision/effective subscription before acceptance. User lock serializes upgrade/restrictions; unique employee/date is independent of request identity. Starting upload before cutoff grants no extra time.
- Approval pre-reads only immutable IDs for lock selection, enters existing ledger sorted-user/wallet/reservation order, checks current admin/session, then locks task/submission/sorted assets and checks PENDING plus both reviewed versions. Credit namespace `p05.task-reward`, key submission UUID, origin `TASK_REWARD`, source `NON_REFERRAL`, captured units. One review/domain command/audit/operation/posting/financial audit/wallet commit together. Later target ban/expiry is not a review eligibility test.
- Rejection uses compatible P05 order and one reasoned command/decision/audit, no ledger credit/debit. Conditional transitions/unique review/operation attribution protect new keys and independent admins.
- Domain command hashes bind actor/kind/key/target/normalized payload, including versions/reason/confirmation. COMMITTED replay returns its saved safe outcome under current authority; mismatches conflict. NOT_OBSERVED remains nonterminal. Deliberate cancellation and every executor share the current actor-user lock through commit: the winner either preserves COMMITTED or appends an immutable CANCELLED fence. Late execution under that key conflicts before effects. No financial reversal, automatic retry or fresh key on timeout. Upload cancellation uses the separately purpose-bound ImageAsset FAILED/UPLOAD_CANCELLED fence; it never cancels READY acceptance. Authority, terminal states and manual recovery are defined in the HTTP/UI contracts.
- Retry recognized Serializable/deadlock conflicts only, at most three attempts, retaining intent and rechecking authority/time. Specific named uniqueness gets specific recovery/conflict, not blanket retry. No database retry repeats filesystem/decoder/external I/O.

### File lifecycle

Proposed `PROOF_STORAGE_ROOT` is an absolute private persistent root outside public/static/source directories, owned by proposed `proofs.config.ts`. Inject isolated roots/budgets in tests. Initially two admitted uploads in one API process; multi-process deployment must coordinate budgets or use independent capped roots.

Reject hostile names/unsupported loaders/animation/type mismatches; stream metadata-stripped oriented PNG through a counted output writer and abort above 33,554,432 bytes before exhausting its reservation. Exclusive server-generated paths, file/directory synchronization and contained atomic rename precede READY. Supervised child uses explicit pixels/channels/no-cache/single concurrency, five-second library timeout and independent ten-second kill/reap deadline. Multipart also has a finite request deadline. Hold a slot until streams/child/staging cleanup finish. Heap is not native memory; actual hostile tests collect safe resource evidence and any native exhaustion blocks B. P11 enforces production memory/CPU/volume/backup limits.

Keep each valid file's completed-upload `uploadedAt` immutable through processing/READY/replacement/retries. Recheck original authority/lease and cancellation state before READY; uncertain upload observes PENDING/READY/FAILED/NOT_OBSERVED. Explicit cancellation may fence absent/STAGING work as FAILED/UPLOAD_CANCELLED, never READY/DELETING/DELETED. Keep parser/child/storage work outside transactions and capacity held until external cleanup. Crashes preserve reconcilable metadata/files, never a business claim. Every accepted unattached/superseded proof retains its own 30-day age; all pending evidence versions remain exempt. Only an atomically fenced DELETING asset may unlink, outside a transaction, with durable lease/retry. Missing retained files preserve metadata and report storage unavailability.

Native-resource Gate B acceptance uses the proposed 512 MiB per-child observed RSS/high-water, 1,024 MiB sum of two child high-water observations and 128 MiB sampled API growth ceilings. Measurement method, missing/abrupt metric handling and rationale belong to [research](research.md#native-resource-acceptance-for-gate-b); deterministic fixtures, two-slot stress, safe errors and cleanup assertions belong to [quickstart](quickstart.md#native-resource-acceptance-workload). These empirical checks do not promise an OS memory cap or substitute for P11 deployment controls.

One nonoverlapping lifecycle scan every 60 seconds handles <=100 records, 120-second leases, unfinished staging expiry after one hour. Startup accounts for leftover temp files/reservations and repairs state before admission; no unbounded temp accumulation. Shutdown stops admission/claims, closes parsers, kills/reaps children, leaves recoverable leases and disconnects DB last. App/router imports do not start scanners. Logs/DTOs never expose paths/raw uploads.

## Verification Strategy and Gates

All P05 test paths below are proposed unless explicitly existing. Follow discovery/colocation and combine overlapping behavior instead of trivial method tests. Quickstart gives manifest-backed commands/infrastructure.

| Future test owner                                                                                                                                                               | Mandatory evidence                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/proofs/proofs.schema.test.ts`, `tasks/tasks.schema.test.ts`, `task-codes/task-codes.schema.test.ts`, `task-submissions/task-submissions.schema.test.ts` | Strict fields/normalization/date/URL/revision/purpose/money, bounded queries, authority injection rejected, allowlisted JSON/private binary.                                                                                                                                                                                           |
| Existing DB `tests/schema-contract.test.ts`, `tests/integration/migration.integration.test.ts`; proposed `tests/integration/tasks.integration.test.ts`                          | Fresh/populated P04 upgrade/repeated deploy, named relational/uniqueness/state/immutability failures, preserved history.                                                                                                                                                                                                               |
| `apps/api/src/modules/proofs/proof-storage.integration.test.ts`, `proof-retention.test.ts`                                                                                      | Actual multipart/child/files, exact/over limits, malformed/type/active/pixel bombs/traversal/symlink/unauthorized bytes, I/O/crash/restart, all pending evidence/cleanup races. DB/file race cases belong in integration discovery.                                                                                                    |
| `apps/api/src/modules/tasks/tasks.integration.test.ts`, `modules/task-codes/task-codes.integration.test.ts`                                                                     | Baghdad boundaries/eligibility, stale revision/no claim, date-edit/first participation, normalized/concurrent code uniqueness, pause/unlock, retained unlock/history/filtered counts.                                                                                                                                                  |
| `apps/api/src/modules/task-submissions/task-submissions.integration.test.ts`, `task-approval.integration.test.ts`, `daily-reward-concurrency.integration.test.ts`               | One day across devices/upgrades/keys, declaration/owned READY proof, zero pending credit; captured S1 after O1/edit/expiry/ban; final rejection; replacement/review and decisions races; actual service rollback across domain/ledger/wallet/audit.                                                                                    |
| Existing clock/auth/ledger/subscription/wallet tests                                                                                                                            | Affected clock, revoked session/restriction, lock/source and P04 projection regressions; isolated cleanup remains safe.                                                                                                                                                                                                                |
| Existing employee task-card/screenshot-upload tests; proposed `task-code-gate.test.tsx`, `tasks-screen.test.tsx`; admin `submissions-screen.test.tsx` and task/code tests       | Real adapter-bound rendered states/C1/C2, declaration/replacement/finality/reason/confirmation, uncertainty/stale/error, no fixtures/optimistic money.                                                                                                                                                                                 |
| Proposed feature adapter/hook/preview tests; existing shared query/transport/P04 tests                                                                                          | Unknown-response parsing, multipart/binary/output cap, safe errors; logout/denial/resource switch/late completions/blob cleanup; guard survives close/remount; bounded pagination/invalidation/no retries.                                                                                                                             |
| `apps/web/e2e/tasks-codes-and-review.spec.ts`, existing private IPC harness                                                                                                     | Real admin publication/code/illustration, employee unlock/upload/declared pending/replacement, reasoned final decision, reload/wallet/history, private access and second-session conflicts. Nine-route normal phone/desktop; challenging 320px flows and representative 390/430px phones; Cairo/RTL/LTR/focus/overflow/console checks. |

**Gate B**: Entire backend/schema/contracts/file lifecycle implemented, all mandatory actual DB/file/authority/time/replay/race/rollback/retention checks pass using separate connection barriers/fixed clock. Relevant shared regressions and affected lint/types/scoped format/diff pass. Missing Docker/storage/native binaries or unexecuted required tests keep B incomplete.

**Gate F**: B evidenced before wiring; all nine existing routes use real contracts and pass required tests/authenticated journey and approved UI review. No fixture/automatic-retry/private-scope/optimistic-money regression. Wallet/ledger show one captured approval and no rejected/pending funds; affected P03/P04/shared checks pass. P05 is not a full current regression checkpoint; P04/P07/P09/P10/P11 checkpoints remain.

Implementation must apply security-best-practices, clean-code-guard, test-guard, docs-guard, React guidance/installed Next docs and playwright as applicable. PLAN applied speckit-plan and docs-guard; no application/test-code review or behavioral execution is claimed.

## Complexity Tracking

No constitutional exception is requested. C1/C2 remain bounded owner decisions. A supervised decoder and durable asset lifecycle are necessary for hostile processing/crash/retention. Terminal domain/upload fences use the existing P05 records and actor locks; no outbox/version/command platform is introduced. The two ANALYZE gaps have concrete amended design criteria approved by independent requirements review. B/F and release obligations remain unexecuted.
