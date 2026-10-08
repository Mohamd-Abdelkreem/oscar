# Tasks: P07 - Deposit Frontend

**Roadmap Phase**: P07 - Deposit Frontend

**Feature Directory**: `specs/007-deposit-frontend`; verified against the active pointer/spec. Branch: `007-deposit-frontend`.

**Input**: [spec](spec.md), [plan](plan.md), [research](research.md), [data model](data-model.md), [HTTP contract](contracts/http.md), [UI contract](contracts/ui-integration.md) and [validation guide](quickstart.md).

**Prerequisites**: Constitution 1.0.0 and accepted C1–C3 decisions; recorded P01–P05 foundations/P06 acceptance reused. New C3 lookup/harness/shared/frontend acceptance is future work. All eight engineering guides were read for P07; owning layers/current callers/scripts were revisited for this task sequence.

**Implementation Scope**: TASKS generation only. All 47 tasks start incomplete. A later IMPLEMENT request must bind exact IDs or a dependency-safe batch. [requirements.md](checklists/requirements.md) and [deposit.md](checklists/deposit.md) remain read-only here; the 36 custom quality items remain unapproved. Required evidence review happens in an authorized implementation preflight, before execution, without treating requirements approval as test results.

**Tests**: REQUIRED. Create/extend the actual files below; validate money through migrated PostgreSQL and frontend behavior through the real browser boundary. Writing tests does not establish passing acceptance. No application tests, service startup, code edits, spending, commits or deployment occurred during generation.

**Organization**: Internal delivery groups within P07. No project/toolkit setup, new roadmap phase or separate CONVERGE prerequisite. No migration/dependency/financial policy/custody rewrite. C1/C2 are the only permitted frozen-presentation exceptions. P10 employee-detail/directory/audit integration remains excluded.

## Format and Ownership

Every task uses `- [ ] T### [P?] [US#?] Description with exact paths`. Story labels occur only in story groups. `[P]` permits independent file ownership after the dependencies listed below pass; it never authorizes an unselected task. Unmarked tasks run sequentially. Test authoring can precede its implementation; acceptance gates require the complete paired behavior to pass.

An assigned worker owns the named files for that unit, must preserve others' edits and coordinate shared owners. Employee US1/US2 edits are sequential; admin US2/US3 edits are sequential. All E2E scenario/control/server and browser-spec edits have one coordinated owner. Preserve route/page/layout files, unrelated fixture providers and approval markers.

## Group A — Backend Prerequisite (Plan G1)

**Goal**: Deliver only C3's minimal live target lookup and deterministic admitted test support before any dependent frontend work.

**Acceptance**: Current ADMIN/minimal/bounded target reads include first-credit USER+wallet accounts; grants still revalidate target. Real application/DB tests and isolated P04/P05/P07 support preserve financial admission, auth, CSRF, source/audit and production fences.

- [x] T001 [P] Extend `packages/contracts/src/admin/admin.schema.test.ts` with strict target query/identity/page/envelope cases: defaults/bounds, arrays/unknown fields, unsafe offsets, search normalization, minimal output and metadata agreement. [FR-017; HTTP §Proposed C3 Endpoint]
- [x] T002 Add the proposed target schemas/types to `packages/contracts/src/admin/admin.schema.ts` and export them from `packages/contracts/src/index.ts`; reuse page/search helpers and safe name150/email320 constraints without duplicate browser schemas or migrations. Depends T001. [FR-017]
- [x] T003 Create `apps/api/src/modules/admins/manual-credit-targets.integration.test.ts` using the real app/migrated DB: anonymous/USER/stale/revoked/disabled ADMIN denial, first-credit/varied-status USER+wallet targets, duplicate names, search/pages/ties/count snapshot, no-store/minimal output and observation under financial fence. Depends T002. [FR-001/017]
- [x] T004 Implement the minimal target read/select/map in `apps/api/src/modules/admins/admins.service.ts` and `apps/api/src/modules/admins/admins.mapper.ts`; reuse current-session locking/RepeatableRead, matching rows/count and createdAt/id descending order. Add no status/subscription/history eligibility. Depends T003. [FR-017; Plan G1]
- [x] T005 Wire GET /admin/employees/manual-credit-targets through `apps/api/src/modules/admins/admins.controller.ts` and `apps/api/src/modules/admins/admins.routes.ts` using parsed shared input, current ADMIN and existing envelope/no-store/error handling. Depends T004. [FR-001/017]
- [x] T006 Extend `apps/api/src/infrastructure/openapi/openapi.test.ts` and `apps/api/src/infrastructure/openapi/openapi.ts` for the lookup's actual registration/shared schemas/security/bounds and safe errors, including database SERVICE_UNAVAILABLE distinct from DEPOSIT_UNAVAILABLE. Depends T005. [FR-017; HTTP §Proposed C3 Endpoint]
- [x] T007 Review the lookup owners with clean-code-guard/security-best-practices/test-guard and owning guides; sequentially build current contracts/database runtime artifacts, then run C3 contracts/OpenAPI/real-DB tests plus affected admin/session regressions. Record exact fresh results and remaining gates in `specs/007-deposit-frontend/quickstart.md`. Depends T001–T006; no frontend acceptance is inferred. [Plan G1; FR-030]
- [x] T008 [P] Extend `apps/api/src/modules/subscriptions/testing/subscription-fixtures.integration.test.ts` and `apps/api/src/modules/subscriptions/testing/subscription-fixtures.ts` to accept explicit FinancialRuntimeAdmission for funding/activation and their ledger calls; prove source-aware effects and pending/fenced rejection without money/audit effects. Preserve the default integration-only guard in `apps/api/src/modules/ledger/testing/financial-fixtures.ts` unchanged. [Research R6; Plan G1]
- [x] T009 Correct guarded clean-disposable E2E boot registration/acknowledgement in `apps/api/tests/e2e/server.ts` before scenarios/custody fixtures; inject the same admission into createApp and `apps/api/tests/e2e/p04-finance.ts`/`apps/api/tests/e2e/p05-tasks.ts`, including direct financial services and funding/activation. Inject validated public test metadata; preserve default fences and database ownership/inventory checks. Depends T008. [Research R6]
- [x] T010 Add `apps/api/tests/e2e/p07-deposits.ts`, then sequentially extend `apps/api/tests/e2e/control.ts`, `apps/api/tests/e2e/server.ts`, `apps/web/e2e/support/fixtures.ts` and `apps/web/e2e/support-smoke.spec.ts` with strict bounded private IPC, real authenticated HTTP readiness/history/grant smoke and safe persisted observations. Observe actual provisioning request before synthetic READY transition; use deterministic verifier/credit/provider boundaries, no public fixture routes/live secrets/funds. Depends T007/T009. [FR-003/008/017/030]
- [x] T011 Review changed test support/fixtures with applicable code/security/test guards; run the G1 command set below with current contracts/database build evidence, preserving P04/P05 assertions and negative admission cases. Record backend/support evidence in `specs/007-deposit-frontend/quickstart.md`; distinguish synthetic READY UI fixtures from reused P06 protected custody/testnet acceptance. Depends T007–T010. **G1 must pass before Group B or story integration.** [FR-017/030; Plan G1]

## Group B — Shared Private Integration (Plan G2 Read Prerequisites)

**Goal**: Reuse private authority/query/transport and exact presentation without changing P04/P05 behavior. G2's manual-action runtime is owned by US3 and must pass before grant integration.

- [x] T012 [P] Extend `apps/web/src/services/api/api-client.test.ts` and `apps/web/src/services/api/api-client.ts` for private deposit/admin-deposit/target GET families, scope retirement/denial and no automatic deposit POST/authentication replay; preserve preExecutionAuthPaths. Depends T011. [FR-001/014/020]
- [x] T013 [P] Add `apps/web/src/services/api/safe-error.test.ts` and extend `apps/web/src/services/api/safe-error.ts` with only verified P06 deposit/manual/fence codes and bounded amount/employee/reference field projections; retain existing safe categories and exclude raw/nested diagnostics. Depends T011. [FR-014/016/018]
- [x] T014 Extend `apps/web/src/shared/query/financial-query.test.ts` and `apps/web/src/shared/query/financial-query.ts` with P07 scoped read/list keys, normalized selections, enabled/10-or-25 limits, current denial and retirement cancellation/removal; preserve same-scope acceptedData on transient errors and all P04/P05 defaults. Depends T012/T013. [FR-001/007/012/014]
- [x] T015 Extend that same `apps/web/src/shared/query/financial-query.test.ts`/`apps/web/src/shared/query/financial-query.ts` owner with 5/10/20/30/60-second bounded GET observation, 20 completed automatic domain observations including initial reads/errors, no secondary retries and hidden/inactive/offline/denied/obsolete/malformed rules. Preserve the active epoch/account/role/domain/resource/normalized-selection window's count/backoff across check-only revalidation and query recreation while retaining current check-scoped authority/keys; only true admitted identity/selection changes or explicit existing refresh reset it. Suppress or budget implicit focus/reconnect/mount/new-key fetches, with zero automatic domain reads after exhaustion; auth checks remain independent. Test partial-budget resume and exhausted-budget focus/online revalidation, query recreation and explicit-refresh recovery. Join in-flight refresh; reset/clamp page after selection/valid out-of-range data and expose page-1 recovery on failure without usable pagination. Keep budget state transient; no new persistence/framework. Depends T014. [FR-007/012; UI §Private Reads and Refresh]
- [x] T016 [P] Add `apps/web/src/features/employee/components/common/copy-action.test.tsx` and extend `apps/web/src/features/employee/components/common/copy-action.tsx` with safe failure reporting to deposit-owned existing feedback; await success and ignore obsolete pending values. Preserve appearance/default behavior for unrelated callers. Depends T011. [FR-015/028]
- [x] T017 [P] Extract only unchanged BAGHDAD_TIMEZONE/formatBaghdadDateTime to `apps/web/src/shared/time/baghdad-time.ts` and re-export from `apps/web/src/features/admin/utils/time.utils.ts`; leave withdrawal calculations untouched. Preserve existing `apps/web/src/features/admin/utils/time.utils.test.ts` outputs/fallbacks; reuse current MoneyAmount/formatMoney without another money/time algorithm. Depends T011. [FR-009/011; Data §Existing Persisted History]
- [x] T018 Review Group B with owning guides/clean-code-guard/security-best-practices/vercel-react-best-practices/test-guard; run affected query/transport/error/copy/time/money/private-scope tests and web lint/types. Record evidence in `specs/007-deposit-frontend/quickstart.md`; installed Next guidance precedes framework changes. Depends T012–T017. [FR-014/029/030; Plan G2]

## Group C — US1: Receive Correct Personal Deposit Instructions (P1)

**Goal**: Ready-only personal instructions with truthful readiness/detection/copy and current-account isolation. The shared employee adapter also supplies minimum real first-page history so this screen no longer presents fixture financial facts; US2 adds full navigation/credit-refresh acceptance.

**Independent test criteria**: Two accounts receive their own equal visible/QR/copied assignment across reload; nonready/invalid results offer no usable address; reply loss is observed safely; clipboard refusal never announces success; old work cannot restore another account's data. Per the owner's 2026-10-07 decision, T045 requires independent rendered-image decoding instead of separate-phone scanning.

### Automated acceptance files

- [x] T019 [P] [US1] Create `apps/web/src/features/employee/api/deposits.api.test.ts` for strict address/first-page history envelopes/current scope, invalid output/status, empty provision input and exact 200 READY/202 nonready handling. Depends T018. [FR-001/002/003/014]
- [x] T020 [P] [US1] Create `apps/web/src/features/employee/hooks/deposits.hooks.test.tsx` using fresh session/QueryClient wrappers for USER admission, GET-first/one guarded provisioning POST, remount/concurrent retrieval, lost reply followed by observation, relevant bounded reads and obsolete/denied address/first-page history completion. Depends T018. [FR-001/003/007/014]
- [x] T021 [P] [US1] Create `apps/web/src/features/employee/components/deposit/deposit-card.test.tsx` for ready-only address/QR input/configured token-network, readiness/detection feedback, malformed/unavailable/cross-account data and actual clipboard success/refusal. Require server first-page records rather than fixture financial facts. Depends T018. [FR-002/003/006/015/028]

### Implementation and gate

- [x] T022 [US1] Create `apps/web/src/features/employee/api/deposits.api.ts` with schema-validated address GET/guarded empty POST and employee history GET through central transport; parse POST 200/202 explicitly while preserving financialRead's 200-only contract. No retries/fallbacks/secret fields. Depends T019. [FR-001/002/003/014]
- [x] T023 [US1] Create `apps/web/src/features/employee/hooks/deposits.hooks.ts` for current USER receiving lifecycle and real first-page history; keep POST outside query retries, observe lost reply, expose readiness/detection/safe feedback and cancel obsolete work. Never auto-loop provisioning or persist a provisioning command. Depends T020/T022/T015. [FR-003/006/007/014]
- [x] T024 [US1] Wire existing address/notice and initial real-history regions in `apps/web/src/features/employee/components/deposit/deposit-card.tsx`: assigned READY address/180px QR/copy, configured metadata, C1's bounded copy and C2's truthful states. Remove fixture address/history and 700ms simulated-confirmation authority; show validated chain/manual first-page facts using exact/shared time helpers without invented fields. Preserve address-qr/screen/routes/layout and unrelated contexts. Depends T021/T023/T016/T017. [FR-002/003/004/009/010/015/026/027/028]
- [x] T025 [US1] Review this integration with owning frontend/security/test/code skills and run the US1 files plus affected clipboard/query/transport checks; record actual automated increment results and pending US2/browser/device gates in `specs/007-deposit-frontend/quickstart.md`. Depends T019–T024. No whole-P07 or independent-decode pass is inferred. [US1; FR-030]

## Group D — US2: Observe Real Credit and History (P1)

**Goal**: Persisted exact chain/manual history for both audiences, bounded recovery/navigation and server-owned credit refresh.

**Independent test criteria**: Repeated canonical event stays one credit; two eligible logs sharing a TxID stay distinct; candidate uncertainty/time cannot credit; manual fields/privacy, exact units, weekend/Baghdad dates, empty/error/page/scope recovery remain truthful. Real persisted financial assertions belong to the browser/DB boundary.

### Automated acceptance files

- [x] T026 [P] [US2] Extend `apps/web/src/features/employee/api/deposits.api.test.ts` and `apps/web/src/features/employee/hooks/deposits.hooks.test.tsx` for history query/page agreement, multi-page/changed-scope/error recovery, detection-versus-credit, repeated operations/distinct logs and retirement. Depends T025. [FR-006/007/008/011/012/014]
- [x] T027 [P] [US2] Extend `apps/web/src/features/employee/components/deposit/deposit-card.test.tsx` for exact six-digit chain/manual records, colliding cross-kind IDs, Baghdad timestamps, no admin attribution/chain impersonation, stale-known/error/empty distinctions and out-of-range recovery. Depends T025. [FR-008/009/010/011/012/016]
- [x] T028 [P] [US2] Create `apps/web/src/features/admin/api/deposits.api.test.ts` and `apps/web/src/features/admin/hooks/deposits.hooks.test.tsx` for bounded ADMIN history/search/kind/page schemas, mismatched/invalid output, current denial, obsolete selection, acceptedData recovery and scoped live admin-finance refresh after newly observed persisted credits. Depends T025. [FR-001/009/012/014/016]
- [x] T029 [P] [US2] Create `apps/web/src/features/admin/components/deposits/deposits-screen.test.tsx` for genuine chain/manual fields, exact amounts, search/kind/10-row pages, stable row keys, clipboard truth and safe unavailable/empty/denied states; fixture manual grant cannot remain reachable. Depends T025. [FR-010/012/015/023/027/028]

### Implementation and gate

- [x] T030 [P] [US2] Extend `apps/web/src/features/employee/api/deposits.api.ts` and `apps/web/src/features/employee/hooks/deposits.hooks.ts` with complete current-page history query/navigation, coordinated first-page detection refresh and scoped live P04 wallet/ledger refresh after newly observed persisted credit. Suppress intervals on navigated pages, reset/clamp selections and recover page 1 safely; no optimistic balances/duplicate effects. Depends T026/T015. [FR-006/007/008/011/012/013]
- [x] T031 [US2] Complete bounded history/navigation/recovery presentation in `apps/web/src/features/employee/components/deposit/deposit-card.tsx` using existing FinancialFeedback/FinancialPages and exact money/shared Baghdad helpers. Key by operationId or kind+id; manual records expose no admin/chain fields; omit unconfigured explorer links. Depends T027/T030. [FR-008/009/010/011/012/016/025/028]
- [x] T032 [P] [US2] Create `apps/web/src/features/admin/api/deposits.api.ts` and `apps/web/src/features/admin/hooks/deposits.hooks.ts` for validated current ADMIN history with server q/kind/10-row pages and safe scoped recovery. Newly observed persisted credits refresh affected existing P04 admin finance scopes, including chain/other-actor credits; no local balance patch or P10 detail reads. Reuse shared schemas; no fixture-derived identity, unbounded list or generic new framework. Depends T028/T018. [FR-001/010/012/013/014/016]
- [x] T033 [US2] Wire history/search/kind/pagination in `apps/web/src/features/admin/components/deposits/deposits-screen.tsx`; preserve table/alert design, exact amounts/time and operation keys; await clipboard success and omit guessed/manual explorer links. Disconnect manualCreditDeposit/fixture-target authority; keep existing grant review/submit unavailable with truthful existing feedback until US3 attaches the valid runtime. Depends T029/T032. [FR-009/010/012/015/023/025/027/028]
- [x] T034 [US2] Create `apps/web/e2e/deposits.spec.ts` with real auth/CSRF/private IPC for US1–US2: two accounts/reload/GET-first readiness, copy refusal, malformed/degraded/empty states, repeated canonical event/two logs, unverified candidate exclusion, Saturday/Sunday, exact chain/manual privacy and unchanged source/reservation snapshots. Use no live provider/funds; coordinate the single spec/fixture owner. Depends T031/T033/T010. [SC-001/002/003/004/006]
- [x] T035 [US2] Review US2 with owning code/security/React/test skills, run employee/admin focused history files and `apps/web/e2e/deposits.spec.ts`, plus affected money/time/financial regressions; record actual evidence and remaining US3/device/full-checkpoint gates in `specs/007-deposit-frontend/quickstart.md`. Depends T026–T034. [US2; FR-030; Plan G3/G4]

## Group E — US3: Grant and Reconcile a Manual Credit (P2)

**Goal**: Real target, complete exact reviewed intent and one durable original action through uncertain replies. G2's action-runtime acceptance completes here before the existing form is enabled.

**Independent test criteria**: First-credit target receives one exact 1.000001 NON_REFERRAL grant/audit; duplicates preserve the same action; original observation reconciles lost reply/reload; not-found/malformed/conflict/coordination failure never authorizes replacement; current authority/source/reservation/live-wallet facts remain intact.

### Automated acceptance files

- [x] T036 [P] [US3] Extend `apps/web/src/features/admin/api/deposits.api.test.ts` for live target bounds/minimal fields and exact strict manual body/outcome, 201 fresh/200 replay agreement, matching action/employee/stable actor ID/full reviewed intent and safe failure with no automatic POST replay. Depends T035. [FR-017/018/020/022]
- [x] T037 [P] [US3] Create `apps/web/src/features/admin/utils/manual-credit-command-runtime.test.ts` for two instances sharing actor lock/storage, busy/missing lock, storage read/write/readback/removal failure, duplicate dispatch, synchronous retirement after publication, crash before observable dispatch, reload and original absence/conflict/network/malformed uncertainty. Require minimal handle only, no new UUID/reconstructed submission/cancel/forced clear. Depends T035. [FR-014/019/020/021/024]
- [x] T038 [P] [US3] Extend `apps/web/src/features/admin/hooks/deposits.hooks.test.tsx` and `apps/web/src/features/admin/components/deposits/deposits-screen.test.tsx` for first-credit/later-page/duplicate-name targets, selected label/draft retention, empty/unavailable/failed lookup and safe recovery, exact reason/reference review, invalid precision/overflow, pending close/reset and uncertainty blocking a new grant. Require no valid target or lookup failure to disable review/submit while retaining only valid same-scope input/label; denial/retirement hides old facts. Cover late replies, returning original actor, changed actor labels and historical walletAfter below newer live funds. Depends T035. [FR-017/018/019/020/021/024/028]

### Implementation and gate

- [x] T039 [P] [US3] Create focused `apps/web/src/features/admin/utils/manual-credit-command-runtime.ts` using existing action-runtime patterns: strict actor-scoped minimal handle persisted/read back under ifAvailable lock, storage notifications, memory-only frozen payload, publication then current-authority recheck, recovered observation only and matching-handle settlement cleanup. Keep uncertain/pre-dispatch-crash identity; never inherit task NOT_OBSERVED/cancellation semantics. Depends T037. [FR-014/020/021; Data §Proposed Client Scope and State]
- [x] T040 [P] [US3] Extend `apps/web/src/features/admin/api/deposits.api.ts` with validated target choices, deliberate confirmed grant and original outcome observation. Use actionId as stable Idempotency-Key/current CSRF transport, verify fresh/replay/matching identity/full in-memory intent; recovered facts match stable actor.id, not mutable name/email. No reconstructed/automatic write. Depends T036. [FR-017/018/020/022]
- [x] T041 [US3] Extend `apps/web/src/features/admin/hooks/deposits.hooks.ts` for one relevant target page/selected identity, valid dirty draft/frozen review and actor-scoped runtime orchestration. Missing valid target or unavailable lookup disables new review/submit with existing feedback; retain valid same-scope input for safe recovery, never fixture choices. Bound original reads; retain unknown/not-found/conflict results; current retirement hides/scrubs payload. Valid committed settlement refetches P07/P04 scoped live history/wallet/finance without historical walletAfter patch. Depends T038/T039/T040/T015. [FR-014/017/019/020/021/024]
- [x] T042 [US3] Wire only existing form/select/pagination/alert/confirmation in `apps/web/src/features/admin/components/deposits/deposits-screen.tsx` to target/hooks/runtime: exact string amount/shared validation, real name/email, complete amount/reason/reference review and pending/uncertainty/recovery state. Correct only C1 reference promises; remove fixture grant/global reference dedup/fake TxID/local balance/audit authority without changing unrelated contexts or P10 detail tabs. Depends T038/T041. [FR-017/018/019/020/022/023/026/027/028]
- [x] T043 [US3] Extend the single-owner `apps/web/e2e/deposits.spec.ts` for first-credit/paged targets, exact reviewed grant, duplicate/tab action protection, separate deliberate same-reference grants, committed route.fetch then route.abort reply loss/reload/original reconciliation, retained absent action and revoked authority. Inspect genuine postings/audit/live wallet/source/reservation via private IPC and preserve employee metadata privacy. Depends T042/T034/T010. [SC-004/005/006]
- [x] T044 [US3] Review action/runtime/form/test changes with code/security/React/test guards and owning guides; run the focused admin/runtime files, shared action/session/transport regressions and full focused deposit browser spec. Record actual results/limitations in `specs/007-deposit-frontend/quickstart.md`; no possibly committed action may be cleared to pass a test. Depends T036–T043. [US3; FR-030; Plan G2/G4]

## Group F — Preservation and Full P07 Acceptance (Plan G5)

- [x] T045 Inspect both integrated routes using `apps/web/e2e/deposits.spec.ts` and affected `apps/web/e2e/ui-preservation.spec.ts` evidence on desktop/390/430px plus focused 320px address/table/confirmation: Cairo/RTL/LTR, focus/keyboard, bottom-nav clearance, clipboard truth, no clipping/overflow/unexpected console/privileged employee requests. Independently decode rendered ready QR screenshot pixels with jsQR for two accounts before/after reload at 320/390/430/1280px and compare decoded/API/visible/copied assignment; record decoder/viewport/equality and missing evidence in `specs/007-deposit-frontend/quickstart.md`. Owner decision 2026-10-07 replaces the separate-phone gate. Depends T044. [FR-029; SC-001/007]
- [x] T046 Run the full current P07 checkpoint from `package.json`, `apps/api/package.json` and `apps/web/package.json`: pnpm verify, both E2E type profiles and the entire web browser suite; retain P04/P05/Linux/admission assertions and required services. Account for verify's db:format write without discarding unrelated changes; record exact fresh/cached/failure/unperformed results in `specs/007-deposit-frontend/quickstart.md`. Depends T044; it may complete while T045's independent QR observation remains pending. [FR-030; SC-008]
- [x] T047 Complete docs-guard review of actual P07 evidence in `specs/007-deposit-frontend/quickstart.md` and task progress in `specs/007-deposit-frontend/tasks.md`; reconcile requirement/acceptance traceability and leave unsupported tasks/gates incomplete. Preserve all quality-approval markers/spec/plan except the explicit owner-approved QR gate revision, and preserve reused P06 evidence; claim completion only after all required automated/browser/independent QR gates pass. Depends T045/T046. [FR-030; Constitution VII]

## Dependencies and Execution Order

```text
Lookup: T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007
Admission: T008 -> T009
T007 + T009 -> T010 -> T011 (G1 backend/support accepted)
T011 -> T012 + T013 -> T014 -> T015
T011 -> T016 + T017
T012..T017 -> T018 (G2 shared reads accepted)
T018 -> T019 + T020 + T021 -> T022 -> T023 -> T024 -> T025
T025 -> T026 + T027 + T028 + T029
T026 -> T030; T027 + T030 -> T031
T028 -> T032; T029 + T032 -> T033
T031 + T033 + T010 -> T034 -> T035
T035 -> T036 + T037 + T038
T037 -> T039; T036 -> T040
T038 + T039 + T040 -> T041 -> T042 -> T043 -> T044
T044 -> T045 + T046 -> T047
```

Explicit dependencies on task lines also apply (especially shared helper prerequisites). Gates aggregate all named test/implementation tasks in their range.

| Story    | Required earlier gates              | Completion boundary                                                                                                             |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| US1 (P1) | T011/T018                           | T025 automated instructions increment; T034 browser and T045 independent rendered-image decoding complete remaining acceptance. |
| US2 (P1) | T025; shared owners finished        | T035 real history/browser acceptance; T045/T046 preservation/full checkpoint remain.                                            |
| US3 (P2) | T035; C3 current backend acceptance | T044 real grant/recovery acceptance; T045–T047 finish the phase.                                                                |

**Safe first complete implementation batch**: T001–T007, after authorized preflight. It delivers/tests the minimal lookup only. T008 can be a separate independent selected backend batch. T009–T011 finish G1; no frontend starts before T011. These recommendations do not authorize execution now.

## Parallel Opportunities

- Backend: T001 and T008 have disjoint contract versus subscription-fixture ownership and reuse accepted P06 admission types. Include both only if selected.
- Shared: after T011, T012/T013/T016/T017 own different files; T014 then T015 share a file and must be sequential.
- US1: after T018, test authoring T019/T020/T021 owns distinct API/hook/card files; implementation/shared dependencies remain sequential.
- US2: after T025, test authoring T026/T027/T028/T029 owns disjoint files. T030 and T032 are separate employee/admin implementations after their tests; no later edits may overlap these owners.
- US3: after T035, test authoring T036/T037/T038 has separate adapter/runtime/hook-screen owners. T039/T040 use separate files; T041 waits for both.
- One owner serializes server/control/scenario edits, all employee US1/US2 edits to the same files, all admin US2/US3 edits to the same files and all deposit browser-spec edits. Do not run build/browser/checkpoint groups concurrently against shared generated artifacts/ports.

## Requirement and Acceptance Coverage

| Requirements       | Owning tasks / acceptance                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| FR-001/014         | T003/T005/T012–T015/T020/T023/T026/T028/T036–T044; SC-004.                                                           |
| FR-002/003/015     | T010/T016/T019–T025/T034/T045; SC-001/007.                                                                           |
| FR-004/005/006/007 | T015/T020/T023/T026/T030/T031/T034/T041; SC-002/003/004.                                                             |
| FR-008/010         | T010/T026–T034/T043; canonical event/log/row identity and chain/manual separation; SC-002/006.                       |
| FR-009/011         | T017/T021/T024/T026–T034/T036/T038/T042/T043; exact six-digit/Baghdad/reload; SC-003/005/006.                        |
| FR-012             | T014/T015/T026–T033/T038/T041/T042; filtered totals/page reset/clamp/error return.                                   |
| FR-013/023/024     | T010/T030/T032/T034/T038–T044; persisted source/audit/live refresh and unchanged reservation allocation; SC-005/006. |
| FR-016             | T003/T010/T013/T023/T026–T034/T037–T043; minimal target/private projections and no secret persistence.               |
| FR-017             | T001–T007/T036/T038/T040–T043; first-credit authority/choices acceptance.                                            |
| FR-018/019         | T036/T038/T040–T043; exact validated complete review/pending guard.                                                  |
| FR-020/021/022     | T012/T036–T044; original identity, conflict, indefinite absence/crash/lost reply and reference semantics.            |
| FR-025             | T031/T033/T034; optional unconfigured explorer omitted and manual fields genuine.                                    |
| FR-026/027/028     | T024/T031/T033/T042/T045; C1/C2/C3 boundary only.                                                                    |
| FR-029/030         | Gate tasks T007/T011/T018/T025/T035/T044–T047; SC-007/008 and actual evidence.                                       |

## Verification Commands and Infrastructure

Commands below are **future execution**, verified from current manifests; all paths are relative to the repository root or owning package as shown.

**G1** — Node 24/pnpm 11, Docker/PostgreSQL 18.4, isolated migrations and real auth/CSRF. Never use/reset a developer/production DB. Use pnpm so npm_execpath is supplied. Direct filtered checks bypass Turbo's dependency build ordering; build current contracts then database sequentially before API checks and the P05 dist snapshot. Full retained P05 browser support also requires Linux Node 24 Docker and those current artifacts.

```text
pnpm --filter @template/contracts build
pnpm --filter @template/database build
pnpm --filter @template/contracts test
pnpm --filter @template/api test src/infrastructure/openapi/openapi.test.ts
pnpm --filter @template/api test:integration src/modules/admins/manual-credit-targets.integration.test.ts src/modules/subscriptions/testing/subscription-fixtures.integration.test.ts src/modules/admins/authorization.integration.test.ts src/modules/auth/session-revocation.integration.test.ts src/modules/deposits/manual-credit.integration.test.ts src/modules/deposits/deposit-history.integration.test.ts src/modules/ledger/ledger.service.integration.test.ts src/modules/ledger/ledger-concurrency.integration.test.ts
pnpm --filter @template/api lint
pnpm --filter @template/api check-types
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/web test:e2e e2e/support-smoke.spec.ts e2e/packages-and-subscriptions.spec.ts e2e/wallet-and-ledger.spec.ts e2e/referrals.spec.ts e2e/tasks-codes-and-review.spec.ts
```

**Focused shared/story checks** — use Vitest/Testing Library's real session/transport/fresh QueryClient wrappers and adapter-boundary doubles. Reuse existing exact money/time tests; the owner's 2026-10-07 revision adds exact test-only `jsqr` 1.4.0 for independent screenshot-pixel decoding.

```text
pnpm --filter @template/web test src/services/api/api-client.test.ts src/services/api/safe-error.test.ts src/shared/query/financial-query.test.ts src/features/employee/components/common/copy-action.test.tsx src/features/admin/utils/time.utils.test.ts src/features/employee/components/common/money-amount.test.tsx src/features/employee/utils/money-display.test.ts
pnpm --filter @template/web test src/features/employee/api/deposits.api.test.ts src/features/employee/hooks/deposits.hooks.test.tsx src/features/employee/components/deposit/deposit-card.test.tsx
pnpm --filter @template/web test src/features/admin/api/deposits.api.test.ts src/features/admin/hooks/deposits.hooks.test.tsx src/features/admin/components/deposits/deposits-screen.test.tsx src/features/admin/utils/manual-credit-command-runtime.test.ts
pnpm --filter @template/web lint
pnpm --filter @template/web check-types
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/web test:e2e e2e/deposits.spec.ts
```

**Full P07 checkpoint** — the browser runner builds Next, uses Chromium/one worker/no retries, ports 3103/4103 and disposable DB/private IPC. Keep live signer/provider/testnet/funding outside normal discovery. Synthetic READY and deterministic transfer fixtures prove UI behavior, not protected custody acceptance; retain P06's recorded evidence.

```text
pnpm verify
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/web test:e2e
```

Root verify omits E2E types/browser and writes db:format; preserve unrelated edits or record equivalent complete constituent coverage. Independent screenshot-pixel decoding is mandatory under the owner's 2026-10-07 revision; QR input/SVG rendering cannot substitute. Missing Docker/Linux/independent decoding or required execution leaves its gate incomplete.

## Implementation Strategy and Status

Deliver selected small backend batches, pass G1/shared prerequisites, then US1 -> US2 -> US3 with shared-file serialization. The first product increment is US1 personal instructions (seven tasks, plus required foundations); it is not full P07 or release authorization. Full navigation/history/grant/browser/device/checkpoint acceptance remains required.

All 47 tasks are generated and unchecked; no fresh application acceptance is claimed. Keep the original-action 404 limitation explicit, no automatic write/forced-clear workaround, no live spending/deployment/next phase. ANALYZE is the next artifact-review command; this file does not execute it or approve custom checklist items.

## IMPLEMENT Group A Status — 2026-10-07

T001–T011 complete; G1 PASS. Exact fresh commands/results and changed-owner inventory are recorded in [quickstart.md](quickstart.md#group-a-final-g1-result). The original generation-status statements above describe the TASKS run, not current implementation progress. T012–T047 remain unchecked and their original task lines are unchanged. This completes only the selected backend prerequisite batch, not P07. No convergence/next phase was executed.

## IMPLEMENT Group B Status ? 2026-10-07

T012?T018 complete; G2 shared read prerequisites PASS. Fresh tests, lint/types, source owners and review evidence are recorded in [quickstart.md](quickstart.md#p07-group-b-execution-evidence--2026-10-07). T019?T047 remain unchecked and their task lines are unchanged. The complete G2 gate still includes the US3 original-action runtime (T037/T039/T041/T044); this batch does not enable manual grants or complete P07. No convergence or next phase was executed.

## IMPLEMENT Group C Status — 2026-10-07

T019–T025 complete; the US1 automated instructions increment PASS. Fresh adapter/hook/card and shared regression results, reviews and source owners are recorded in [quickstart.md](quickstart.md#p07-group-c-execution-evidence--2026-10-07). T026–T047 remain unchecked and their original task lines are unchanged. This completes only Group C, not full US1 browser/device acceptance or P07: US2 history navigation/live-credit refresh, admin integration/manual-action recovery, browser/device preservation and the full checkpoint remain required. No convergence or next phase was executed.

## IMPLEMENT Group D Status — 2026-10-07

T026–T035 complete; US2 real history and focused browser acceptance PASS. Fresh focused/shared/browser results, reviews, changed owners and limitations are recorded in [quickstart.md](quickstart.md#p07-group-d-execution-evidence--2026-10-07). T036–T047 remain unchecked and their original task lines are unchanged. The admin grant form remains unavailable until Group E. Independent phone decoding/preservation, the full P07 checkpoint and final phase reconciliation remain required; P07 is incomplete. No convergence or next phase was executed.

## IMPLEMENT Group E Status — 2026-10-07

T036–T044 complete; G2 original-action runtime and G4 US3 manual-grant acceptance PASS. Fresh focused/shared/browser results, source owners, reviews and limitations are recorded in [quickstart.md](quickstart.md#p07-group-e-execution-evidence--2026-10-07). T045–T047 remain unchecked and unchanged. Group E is complete; P07 remains incomplete pending Group F's preservation/device, full checkpoint and final reconciliation. Earlier generation/batch status paragraphs are historical. No convergence or next phase was executed.

## IMPLEMENT Group F Status — 2026-10-07

T045–T047 remain unchecked. Final deposit browser acceptance passed 7/7, including preservation at all four widths; checkpoint attempts and the scoped shared integration-harness correction are recorded in [quickstart.md](quickstart.md#p07-group-f-execution-evidence--2026-10-07). Actual separate-phone decoding is unperformed. Root formatting still fails on 485 unrelated files; full API integration finished 444 passed/one timeout, and the entire browser suite finished 90 passed/one failure. Isolated task-illustration and unchanged P05 reruns passed, but they do not change those full-run results. Evidence and progress were reviewed with docs-guard; T047's acceptance dependencies remain open. Group F and P07 are incomplete. Original task lines, approval markers, specification, plan and P06 evidence remain unchanged. No convergence or next phase was executed.

## IMPLEMENT Group F QR Follow-up — 2026-10-07

**T045 complete; T046/T047 remain open.** The owner explicitly approved independent automated image decoding instead of the separate-phone requirement. Fresh deposit browser acceptance passed 7/7 with 16 successful rendered-QR/API/visible/clipboard equality checks across two accounts, before/after reload, at 320/390/430/1280px. Evidence and the bounded acceptance revision are recorded in [quickstart.md](quickstart.md#p07-group-f-independent-qr-follow-up--2026-10-07). Only this owner-approved QR criterion was revised in the plan/research/UI contract and current task instructions; quality-approval markers, business specification and P06 evidence are preserved. Earlier Group F status describes the original attempt. Full-checkpoint blockers remain unchanged; P07 is incomplete. No convergence or next phase was executed.

## IMPLEMENT Group F Final Acceptance — 2026-10-08

**T045–T047 complete; all 47 P07 implementation tasks are complete.** Owner-requested formatting/checkpoint repairs passed `pnpm verify` with native exit 0, fresh API integration 445/445 and database integration 66/66, both E2E type profiles, and the fresh entire browser suite 91/91 with one worker/no retries. The Linux task-illustration file passed 7/7 within its original deadline in the full run; the unchanged P05 journey also passed. Fresh versus cached results, source/formatting owners, independent QR evidence and docs-guard acceptance reconciliation are recorded in [quickstart.md](quickstart.md#p07-final-full-acceptance--2026-10-08). Earlier failed/pending entries are historical; their results were preserved. Checklist approval markers and business requirements are unchanged. Only IMPLEMENT was executed; no CONVERGE or next phase followed.

## Phase 7: Convergence

**P07 CONVERGE — 2026-10-08:** Two MEDIUM partial findings remain after reviewing current source and recorded acceptance. The existing full-checkpoint and independent QR results are reused evidence for this audit. Execute T048, then T049; the final checkpoint follows both corrections.

- [x] T048 [US3] Make the existing initial manual-credit form in `apps/web/src/features/admin/components/deposits/deposits-screen.tsx` keyboard accessible per FR-029, SC-007, plan G5 and T045 (partial; MEDIUM F1). Evidence: lines 121–125 and 376–385 open/render an unnamed dialog without initial focus, containment, Escape or background isolation; lines 492–499 dismiss without restoring focus. Reuse existing dialog behavior, including `apps/web/src/shared/hooks/use-dialog-background.ts`, where appropriate; preserve rendered copy/classes/layout and support the AdminSelect portal and subsequent confirmation. Extend `apps/web/src/features/admin/components/deposits/deposits-screen.test.tsx` and `apps/web/e2e/deposits.spec.ts` to verify keyboard opening, accessible name, forward/reverse focus containment, Escape/return focus, background isolation, target-select navigation and pending-confirmation protection. Run the focused component and deposit browser suites plus web lint/types and E2E types; record actual results and preservation evidence in `specs/007-deposit-frontend/quickstart.md`. Depends on completed T047.
- [x] T049 Repair the malformed admin-history response cases in `apps/web/src/features/admin/api/deposits.api.test.ts` per FR-014, FR-016, FR-030, plan verification strategy and T028 (partial; MEDIUM F2). Evidence: lines 160–187 request CHAIN_DEPOSIT while the employee/private/amount variants retain a MANUAL_CREDIT fixture, so an unrelated kind mismatch can satisfy every rejection. Start from a matching valid response, assert the control succeeds, and mutate only each intended fault; reserve mixed kinds for the kind-mismatch case. Apply test-guard and run the focused adapter suite and affected shared-contract tests. After T048 passes, run the required full P07 checkpoint (`pnpm verify`, both package E2E type profiles and the entire web browser suite), preserving existing assertions and required service boundaries. Record fresh/cached/reused/failure results and reconcile P07 acceptance in `specs/007-deposit-frontend/quickstart.md` with docs-guard; leave unmet gates open. Depends on T048 for final acceptance.

**IMPLEMENT T048/T049 — 2026-10-08: complete.** All 49 P07 implementation tasks are checked. Focused accessibility/adapter/shared-contract checks, the full aggregate, both E2E type profiles and the final entire browser run passed. Fresh QR equality passed 16/16; existing UI/copy/classes remain preserved. Actual fresh/cached results, interrupted attempts, evidence-retention limitations and final acceptance are recorded in [quickstart.md](quickstart.md#p07-remediation-final-acceptance--2026-10-08). T001–T047 and quality-approval markers remain unchanged. This is implementation completion; a new CONVERGE was not executed. The next owner-selected command is CONVERGE for P07.

## Phase 8: Convergence

**P07 CONVERGE — 2026-10-08:** T048/T049 resolve the previous findings. One MEDIUM partial test-realism finding remains after reviewing current source and recorded acceptance. The existing full-checkpoint/browser/independent QR results are reused evidence; no tests were executed during this audit. P07 convergence remains open until T050 passes. This internal task group does not authorize another roadmap phase.

- [x] T050 Repair the manual-grant reply-mismatch matrix in `apps/web/src/features/admin/api/deposits.api.test.ts` per FR-014, FR-016, FR-018, FR-020, FR-022, FR-030, US3/AC3, plan G4/verification strategy and T036 (partial; MEDIUM F1). Evidence: lines 75–102 use `reply(config, result)` with default HTTP 200 (`apps/web/src/test/p04-network.ts:225–228`) while inheriting `manualCreditOutcome.replayed: false` (`apps/web/src/test/p07-deposits.ts:29`); `apps/web/src/features/admin/api/deposits.api.ts:54–59` rejects that pairing before the intended actor/intent checks, so seven amount/reason/reference/employee/actor/action/private-field cases can pass on an unrelated fault. Start each case from a matching valid 200/replayed-true or 201/replayed-false response, assert that control succeeds, and mutate only the intended field; isolate the replay case by changing only its replay flag. Assert the documented safe failure category/code for each boundary without changing production validation or shared fixtures unnecessarily. Apply test-guard and run the focused adapter/runtime and affected deposit/financial contract suites. Complete the required P07 checkpoint (`pnpm verify`, both package E2E type profiles and the entire web browser suite) using existing assertions, deadlines, retries and required services; retain logs outside the browser runner's disposable output directory. Record actual fresh/cached/reused/failure results and correct the overbroad matching-control claim in `specs/007-deposit-frontend/quickstart.md` with docs-guard; leave unmet gates open. Depends on completed T048/T049. After implementation, run another owner-selected P07 CONVERGE.

## IMPLEMENT T050 Final Acceptance — 2026-10-08

**T050 complete; all 50 P07 implementation tasks are checked.** The eight grant-reply mismatch cases now accept a matching control, isolate their intended fault and assert the safe error category/code. Focused adapter/runtime 38/38, affected contracts 142/142, full `pnpm verify`, both E2E type profiles and the entire fresh browser suite 91/91 passed with native exit 0. Fresh independent QR equality passed 16/16. Actual fresh/cached/reused results, expected failing-control reproduction and retained raw logs are recorded in [quickstart.md](quickstart.md#p07-t050-final-acceptance--2026-10-08). T001–T049 task lines and checklist approval markers are preserved. This invocation executed IMPLEMENT only; another owner-selected P07 CONVERGE is next.
