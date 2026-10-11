# P09 Validation Guide

**Status**: Planning guidance with scoped implementation evidence appended below,
updated 2026-10-09. PLAN ran no
application tests, browser journeys, worker/signer processes or transfers. This guide
does not authorize implementation or a live testnet run.

## Prerequisites and ordering

Use the existing Node24/pnpm11 workspace and locked dependencies. Docker/image access
is required for disposable PostgreSQL18.4 and P08 Redis7.4.11 tests. Playwright1.63.0
Chromium must be available. Preserve unrelated working-tree edits.

1. Reuse the latest [P08 gate evidence](../008-withdrawals-payout-recovery/quickstart.md#final-t079-t080-acceptance)
   and revalidate affected backend checks when source/configuration changes.
2. Complete the proposed compatibility gate in [plan.md](plan.md): shared readiness/
   metadata, admin identity/availability, keyed outcome and producer/OpenAPI changes.
   Real PostgreSQL/role/admission/locks and configured isolated protected payout
   startup/inventory evidence precede enabling frontend money controls.
3. Add actual P09 integration/component/browser files below, then run focused checks.
4. Run the full P09 checkpoint, including explicit browser/type profiles. Missing
   required infrastructure or an unrun financial check leaves P09 incomplete.

The readiness boolean is admitted new-request capability, not live signer/provider
health. No API secret import or new live transfer is required. Existing separately
authorized Nile proof is reused only for unchanged P08 payout boundaries; production
WAL/full restore/release remains P11.

## Test owners and required behavior

Paths are repository-relative. **Extend** names existing files; **add** names proposed
files, not files created by PLAN. Consolidate overlapping cases within these owners;
avoid mirrored helper tests or one tiny file per assertion.

| Owner                     | Actual future test-file work                                                                                                                                                                                                                          | Required observable evidence                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts          | Extend `packages/contracts/src/withdrawals/withdrawal.schema.test.ts`, `packages/contracts/src/wallet/wallet.schema.test.ts`                                                                                                                          | Boolean readiness, nullable network, exact safe admin identity/flags, strict keyed outcomes/bindings; reject malformed/privileged/contradictory money/terminal data.                                                                            |
| Backend compatibility     | Extend `apps/api/src/modules/withdrawals/withdrawals-http.integration.test.ts`, `apps/api/src/modules/wallets/wallet-projections.integration.test.ts`, `apps/api/src/core/config/tron.config.test.ts`                                                 | Configured/disabled readiness agrees across views; no first reserve while disabled; read/outcome access during fence/pause; safe admin projection and exact command observation.                                                                |
| Existing P08 invariants   | Extend affected `apps/api/src/modules/withdrawals/withdrawals-concurrency.integration.test.ts`, `withdrawal-reservation.integration.test.ts`, `withdrawal-cancellation.integration.test.ts`                                                           | Real pause/acceptance and claim/admin races, one reservation/release, replay and stale facts. Reuse existing calendar/scheduler/payout/settlement tests for unchanged boundaries; rerun affected cases.                                         |
| Shared web integration    | Extend `apps/web/src/services/api/api-client.test.ts`, `safe-error.test.ts`, `apps/web/src/shared/query/financial-query.test.ts`                                                                                                                      | Safe codes/fields, no automatic POST replay, scoped retirement/denial, 20-cycle observation/backoff/exhaustion across remounts, focus/reconnect resume versus explicit user/one-shot outcome refresh, correct 10/25-row pages.                  |
| Employee adapter/recovery | Add `apps/web/src/features/employee/api/withdrawals.api.test.ts`, `hooks/withdrawals.hooks.test.tsx`, `hooks/withdrawal-command.hooks.test.tsx`                                                                                                       | Exact strings/statuses, matching results, validated definite rejection retires only its first attempt; prior uncertainty, malformed/late replies and opaque reload retain original-quote recovery, NOT_OBSERVED blocking and no offline replay. |
| Employee UI               | Add `apps/web/src/features/employee/components/withdraw/withdrawal-form.test.tsx`, `withdrawal-address-card.test.tsx`, `withdrawal-status-card.test.tsx`; extend existing `apps/web/src/features/employee/components/account/account-screen.test.tsx` | Exact quote sheet, six-decimal input, server funding, pending/resend/explicit consumption, all states/countdown/details/25-row history, dirty draft retention.                                                                                  |
| Link lifecycle            | Add `apps/web/src/features/employee/hooks/use-withdrawal-destination-link.test.tsx`                                                                                                                                                                   | Scrub before redirect, latest same-route hash, no auto-consume, scope/pagehide disposal, signed-out reopen, cache/storage/diagnostic secret exclusion.                                                                                          |
| Admin adapter/recovery    | Add `apps/web/src/features/admin/api/withdrawals.api.test.ts`, `hooks/withdrawals.hooks.test.tsx`, `hooks/use-withdrawal-action.test.tsx`                                                                                                             | Exact keyed original observation, stale/superseded and wrong-row responses, immutable body/key fingerprint, no automatic retry/double extension/release.                                                                                        |
| Admin UI                  | Add `apps/web/src/features/admin/components/withdrawals/withdrawals-screen.test.tsx`, `extend-schedule-dialog.test.tsx`                                                                                                                               | Real 10-row filter/detail scope, required version/reason/confirmation, positive supported fractional hours, truthful preview, dirty reason and removal of manual/held/unsafe actions.                                                           |
| Browser                   | Add `apps/web/e2e/withdrawals.spec.ts`; proposed private `apps/api/tests/e2e/p09-withdrawals.ts` and `apps/web/e2e/support/p09-withdrawals.ts`                                                                                                        | Real HTTP/DB reservation/release, browser persistence/concurrency/reply-loss/privacy/calendar and phone/desktop interaction.                                                                                                                    |

Frontend hook/component tests use a fresh real QueryClient per independent session,
network-boundary doubles and accessible interaction. They do not prove financial
atomicity. Apply test-guard to changed tests, clean-code/security/React review to
relevant implementation, and docs-guard to resulting documentation.

Acceptance recovery must cover the exact definite-rejection code/status allowlist in
[the contract](contracts/withdrawals.md#quote-and-acceptance-observation), including
wrong code/status/scope, a previous lost dispatch and handle-retirement failure.
Known stale rejection with no prior uncertainty releases only its client guard/handle,
preserves the draft and requires fresh authoritative review. Active/restricted accounts
remain blocked; no local money release occurs. A restored opaque handle, a generic
error/5xx or live NOT_OBSERVED remains uncertain until original-quote disposition.

Observation tests use controlled timers: the immediate first cycle plus at most 19
further cycles, settlement-relative 5/10/20/30/60-second waits capped at 60 seconds,
pause/stop conditions, coalescing and no automatic fetch bypass. Focus/reconnect must
not reset exhaustion. Explicit authorized user refresh or one-shot refresh after a
newly confirmed command/newly observed persisted transition starts a new budget through
the same owner, including when the old budget is exhausted. Verify affected disabled
readers actually refresh alongside invalidation. Deduplicate by persisted identity/
version; unchanged polls/countdowns/rerenders never reset the budget. Exhaustion
preserves last-known facts, drafts and unresolved command handles without enabling a POST.

## Backend compatibility scenarios

- Ready true only with valid public capability and this registered/acknowledged API
  boot at current generation, no fence/pause. Missing config/admission, wrong process,
  unregistered/unacknowledged/stale boot, fence or pause gives false. Invalid configured
  UUID/network fails config; query failure is a read error. User funds/destination/
  active/restriction blockers stay independent of readiness.
- Verify both status and employee/admin wallet views use the same predicate. Status
  network supports initial UNSET review without deposit provisioning; missing/mismatched
  network never gets a guessed label or incompatible issuance.
- Race pause against first quote acceptance with separate real connections and an
  explicit barrier. Only an admitted ordered winner may reserve; no partial/duplicate
  effect. Pause after quote prevents a new reservation. COMMITTED GET survives fence;
  no disabled write or timeout releases an accepted obligation.
- Race original-quote outcome observation against acceptance across quote expiry using
  separate PostgreSQL connections and a barrier while acceptance holds its identity
  lock. An observer waiting on that lock must not combine an older request-absent
  RepeatableRead snapshot with a later clock to return EXPIRED_UNCOMMITTED after the
  request commits. Inspect the saved request/reservation and require COMMITTED for the
  winner; an actually uncommitted expired quote may return EXPIRED_UNCOMMITTED. This
  source-inferred overlap risk is not reproduced evidence. Missing or failing real-DB
  proof keeps T013 incomplete and requires correction in the existing outcome owner
  before frontend recovery may rely on that disposition; no new outcome API is needed.
- Admin name/email search agrees with returned current safe identity. Employee DTOs
  contain no admin identity/flags. All in-flight/terminal rows are readonly; no attempt
  with null TxID is treated as safe. Fenced scheduled snapshots disable actions;
  paused-but-admitted scheduled requests permit safe extension/rejection.
- Observe exact original extension/rejection after lost reply, including an action
  older than the latest100; actor/key/target/version mismatch, concurrent observation,
  future version, no/equal NOT_OBSERVED and no/advanced SUPERSEDED. GET changes zero
  rows/wakeups. Exact original keyed retry replays once; edited payload conflicts.
- Inspect source totals/posting counts and full persisted outcome after races. Reuse
  P08 fixed-clock/real-Redis/claim/recovery harnesses only in their supported isolated
  suites. No mocked transaction establishes the gate.

## Existing browser harness and proposed P09 support

[Playwright config](../../apps/web/playwright.config.ts) runs serial Chromium with
no retries and private safe reporting. Existing
[fixtures](../../apps/web/e2e/support/fixtures.ts) start real API on4103, built Next
on3103 and disposable PostgreSQL, using private IPC to
[the test server](../../apps/api/tests/e2e/server.ts). Captured Resend email is a
network-boundary double; no mailbox/provider production claim follows.

The proposed P09 helper must:

- Configure `WITHDRAWAL_ADDRESS_CONFIRM_URL=http://127.0.0.1:3103/employee/account`
  before config imports. Existing `depositMetadata:p07Metadata` supplies the explicit
  test network; add only validated non-secret payout capability/admission fixture
  composition needed by the new contract, never real signer credentials.
- Use bounded private IPC commands for isolated funding, current destination/request
  setup, supported financial clock changes and post-command persisted inspection.
  Validate the disposable database/role scope and remain excluded from production
  builds. Do not widen protected P08 fixture guards or expose test controls as routes.
- Exercise actual HTTP command effects for acceptance/extension/rejection. A lost
  reply must execute the real request before suppressing the response. Two browser
  contexts compete against the same real services; inspect one reservation/ledger effect.
- Keep seeded in-flight/terminal browser states explicitly labeled presentation
  fixtures. Current browser runner starts no worker/signer. Its P04 clock changes
  injected financial time, while signer/scheduler SQL guards also use database time.
  Do not claim a browser clock advanced a protected payout. Real P08 integration
  evidence owns unchanged dispatch/finality/Redis/crash/restore behavior.
- Extend the fixture safe-error source allowlist for `withdrawals.spec.ts`. Keep
  automatic traces/video/screenshots/raw-error output off for proof journeys; any
  explicit RTL screenshot must mask proof/private data. Unexpected console errors
  or unauthorized API requests fail the browser check.

## Browser acceptance journeys

| Journey                | Required result / spec coverage                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First destination      | Sheet review of exact address/network, pending/expiry/resend/provider uncertainty, opening link does not save, explicit matching account confirmation persists across reload; expired/superseded/replayed/wrong-account proof unchanged. Signed-out flow discards proof and succeeds by reopening after login. FR004-007, SC001.                                                        |
| Review and reserve     | 100 gross/21 fee/79 net, six-decimal boundary, server limits/saved rate, Free locked referral/pending/reserved exclusions, stale quote re-review; lost acceptance and competing devices yield one reservation. FR008-015, SC002-003.                                                                                                                                                    |
| Lifecycle              | All five active/nine total states, immutable snapshots through expiry, source-identical release/zero charged fee, UNKNOWN retained, no24h cooldown, correct wallet refresh and detail/history paging. Seeded payout states prove display only. FR016/018-020, SC004/006/008.                                                                                                            |
| Counted calendar       | Friday12:00 Baghdad -> Wednesday12:00; weekend snapshot unchanged, Saturday accumulation starts Monday, blocked-boundary dispatch normalization, positive fractional extension adds to current deadline, zero never means paid. Use controlled service clock for real schedule/read cases; P08 tests own protected claims. FR017/021, SC005.                                            |
| Admin safety           | Current detail + expectedVersion + reason + explicit confirmation, exact keyed lost-reply observation, stale/claim race, no unsafe actions/manual/held state, server actor/time/reason, no duplicate extension/release. FR021-023, SC007-008.                                                                                                                                           |
| Isolation/error/mobile | Anonymous/wrong-role/wrong-owner/revoked denial, malformed success vs empty/error/out-of-range, dirty drafts, wrong-row/page/account late replies, bounded observation stop/restart and secret absence. RTL/Cairo, keyboard/focus, long exact addresses/amounts, 320px challenging states, 390/430px phones + desktop, no overflow/hidden bottom-nav actions. FR001-003/024-028, SC009. |

## Commands for implementation verification

Run from repository root after the respective implementation files exist. These
manifest-backed commands were inspected, **not executed by PLAN**. Dependency builds
precede direct API/E2E runs. Build the API freshly before protected built-output tests:
the existing Linux harness executes API `dist`, and `pnpm verify` builds only after
its integration phase. No developer DATABASE_URL/reset is needed because the existing
suites own disposable setup.

```powershell
pnpm --filter @template/contracts build
pnpm --filter @template/database build
pnpm --filter @template/api build
pnpm --filter @template/contracts test src/withdrawals/withdrawal.schema.test.ts src/wallet/wallet.schema.test.ts
pnpm --filter @template/api test src/core/config/tron.config.test.ts
pnpm --filter @template/api test:integration src/modules/withdrawals/withdrawals-http.integration.test.ts src/modules/wallets/wallet-projections.integration.test.ts src/modules/withdrawals/withdrawals-concurrency.integration.test.ts
```

Run affected P08 cancellation/reservation/calendar/scheduler/payout/settlement files
when their source/authority boundary changes; reuse their actual package-relative
file filters. The existing protected built Linux selector, after fresh dependency/API
builds, is:

```powershell
pnpm --filter @template/api test:integration src/modules/withdrawals/payout-recovery.integration.test.ts --testNamePattern "built Linux"
```

After the proposed web files exist:

```powershell
pnpm --filter @template/web test src/features/employee/components/withdraw src/features/employee/hooks/withdrawals.hooks.test.tsx src/features/employee/hooks/withdrawal-command.hooks.test.tsx src/features/employee/hooks/use-withdrawal-destination-link.test.tsx src/features/employee/api/withdrawals.api.test.ts src/features/employee/components/account/account-screen.test.tsx
pnpm --filter @template/web test src/features/admin/components/withdrawals src/features/admin/hooks/withdrawals.hooks.test.tsx src/features/admin/hooks/use-withdrawal-action.test.tsx src/features/admin/api/withdrawals.api.test.ts
pnpm --filter @template/web test src/services/api/api-client.test.ts src/services/api/safe-error.test.ts src/shared/query/financial-query.test.ts
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts
```

Full current P09 checkpoint, after dependency builds above and a fresh API build before
integration:

```powershell
pnpm --filter @template/api build
pnpm verify
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/web test:e2e
```

`verify` includes DB format/validate/generate, format, lint, types, package unit/
integration, build/output and diff checks. **DB formatting writes schema.prisma**;
inspect dirty files before the aggregate. It omits browser execution and separate
E2E type profiles, hence the explicit commands. Report actual fresh vs cached
results and unavailable infrastructure. Do not enable testnet/mainnet profiles as
a fallback. Record evidence in this guide during implementation, not invented passes.

## PLAN verification boundary

PLAN completion consists of source/manifests/library/prerequisite inspection,
constitution reviews, documentation consistency/link/format checks and preserved
non-PLAN artifacts. It is not P09 implementation, test acceptance, live runtime
readiness, production recovery or release approval.

## IMPLEMENT Phase 1 — T001 prerequisite revalidation (2026-10-09)

**Scope**: T001 only, the complete selected internal Phase 1. T002–T050 remain
unexecuted. This is evidence/source revalidation and documentation, not fresh
financial acceptance or whole-P09 completion. The owner-authorized preflight
reviewed every checklist item: requirements.md 16/16 and withdrawals.md 36/36
supported by current written requirements/design. Those approvals do not prove
implementation. No persisted P09 analysis report was found in the feature/docs
inventory; the documented acceptance/expiry-overlap risk remains an explicit
T012/T013 verification requirement, not a reproduced failure or a passing test.

### Reused P08 evidence

Both predecessor groups remain accepted on the inspected records in
[P08 quickstart](../008-withdrawals-payout-recovery/quickstart.md), especially
[final T079–T080 acceptance](../008-withdrawals-payout-recovery/quickstart.md#final-t079-t080-acceptance),
and the checked T034/T068/T070/T079/T080 tasks. Earlier pending statements and failed
runs are historical and are not substituted for the later accepted results.

| Boundary                          | Reused evidence and limits                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate A: reservation/scheduling    | T034 acceptance plus T074 real PostgreSQL cancellation/HTTP and scheduler revalidation; independent connection/lock barriers force each admin/restriction-versus-claim winner and preserve source allocation. Unchanged Group A accounting/calendar evidence is reused.                                                                                                                                           |
| Gate B: automatic payout/recovery | T079 weekday/weekend local and built Linux records plus T080 original-intent recovery. The final isolated Saturday-host built Linux case passed one selected test with 26 filtered, 855.54 seconds overall. It exercised actual SIGKILL before the first intent file, independent fenced recovery, genuine archive acknowledgement/readback, same-byte retry and one original-source settlement.                  |
| Final regressions/build           | T080 records the six-file/99-test local cohort, followed by nine cases revalidating the final shared authority extraction, owning unit checks, workspace lint/types/build and build-output verification. Three unchanged workspace packages used cache in those final workspace checks. The final weekend-guard strengthening had its own passing targeted case; the earlier full cohort was not rerun afterward. |
| Separately authorized Nile        | T067–T068 recorded original TxID `8b1e6c48d68c55ea37cace93afe560e10768e80ad501067f5be1c7895f13352c`: gross 100, fee 21, net 79 USDT, one original 70/30 source settlement, retained UNKNOWN then canonical completion with zero additional recovery broadcasts. The initial failed signature-encoding run remains recorded. This proof is reused; no provider call, live profile or transfer ran for T001.        |

These records establish the accepted predecessor baseline. They do not establish
currently configured payout startup, live liquidity, current boot admission or
P11 production WAL/full-system restore, independent launch review or deployment.

### Current source and affected owners

Fresh inspection confirms the existing contracts, withdrawal services, runtime
admission, scheduler, protected payout/recovery and their test owners are present.
The working tree initially contained only the owner's modified feature pointer and
untracked P09 directory; no tracked application changes were present. Preserve those
inputs and all P08 artifacts. The prerequisite script resolved the existing pointer
to this P09 directory without a feature override.

- `withdrawals.service.ts` and `wallets.mapper.ts` still return
  `withdrawalExecutionReady: false`; both shared schemas still require literal false.
  No control may infer readiness from P08 task completion. Status has no configured
  network projection yet, and admin detail still uses the base request projection.
- `server.ts` registers API financial admission and injects public deposit metadata;
  it does not yet inject the proposed public payout capability. Existing
  `runtime-control.ts` owns current-boot/generation/fence/dispatch locks. Reuse that
  authority rather than introducing a readiness flag or browser override.
- Acceptance detects a committed request before the stale/blocked/active business
  rejection branches. The existing original-quote outcome owner uses a
  RepeatableRead identity transaction. The specified acceptance/expiry-overlap
  proof must run through separate real connections before frontend recovery relies
  on EXPIRED_UNCOMMITTED; source inspection alone does not pass that case.
- `signer.ts` retains Linux-only protected payout configuration and
  `withdrawal-runtime.ts` checks archived recovery inventory and mutation admission
  before retained-attempt reconciliation/new work. Current protected
  key/policy/inventory/startup must still be verified at T013.
- The bounded correction owners remain contracts/account-wallet-withdrawals,
  public configuration/API composition, custody admission, withdrawal/wallet
  services/mappers and OpenAPI, with the exact test owners in T002–T013. P09 frontend
  consumers wait for T013. No schema/migration, new payout engine or UI work belongs
  to T001.

### Fresh environment checks and outstanding verification

Read-only checks observed Node `v24.18.1`, pnpm `11.17.0`, Docker client/server
`29.1.3` and a Linux engine. Local image inspection found PostgreSQL `postgres:18.4`
and the exact digest-pinned Redis image from
`apps/api/src/modules/withdrawals/testing/redis-harness.ts`
(`redis:7.4.11-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499`).
This proves local engine/image availability only; no container or configured
protected runtime was started. The initial image-format query failed; a plain
`redis:7.4.11` lookup and a mistyped digest lookup also failed. Source-derived exact
image inspection subsequently exited 0. None of these diagnostics is test evidence.

The existing API integration setup starts disposable migrated PostgreSQL 18.4;
withdrawal Redis fixtures start their own isolated pinned container. Protected Linux
tests copy compiled API/contracts/database output into disposable processes with
independent roles and pinned SSH recovery. Fresh owning builds must precede that
acceptance; stale dist or cached historical results cannot prove the new correction.

Before T013 can pass, execute the manifest-backed commands in
[Commands for implementation verification](#commands-for-implementation-verification)
and the task list's owning contract/config/OpenAPI/HTTP-wallet/race filters, then:

```powershell
pnpm --filter @template/api test:integration src/modules/withdrawals/withdrawal-reservation.integration.test.ts src/modules/withdrawals/withdrawal-cancellation.integration.test.ts src/modules/withdrawals/withdrawal-scheduler.integration.test.ts
pnpm --filter @template/api test src/modules/withdrawals/withdrawal-clock.test.ts
pnpm --filter @template/api test:integration src/modules/withdrawals/withdrawal-payout.integration.test.ts src/modules/withdrawals/withdrawal-settlement.integration.test.ts src/modules/withdrawals/worker-restart.integration.test.ts src/modules/withdrawals/payout-recovery.integration.test.ts
```

The last command includes the actual built Linux case; its narrower selector is
already documented above. Revalidate affected custody/ledger regressions when their
owners change. Preserve explicit weekday/weekend fixture scenarios through the
existing `P08_TEST_HOST_DATE` setting. Reuse unchanged Nile evidence explicitly;
these local commands do not authorize another live transfer.

Required fresh compatibility/race/PostgreSQL/Redis/Linux/configured-startup/inventory/
admission checks, owning lint/types/build-output and web consumer compatibility are
**not run by T001**. Docker availability does not pass them. Missing credentials,
independent recovery authority, protected storage, image/build access or any failed
required check at that boundary keeps T013 incomplete and request controls disabled;
this invocation has not established their configured availability. The full P09
regression/browser checkpoint remains T050; P10/P11 remain outside scope.

T001 adds no application or test code and changes no UI. Existing ignore rules cover
actual artifacts; no ignore/configuration edit was needed. Docs-guard checks the
changed evidence against the inspected source/manifests and distinguishes planned,
reused and fresh checks. Extension hooks are absent.

Fresh documentation verification: the Bash prerequisite command with
`--json --require-tasks --include-tasks` exited 0 and selected P09; all 52 checklist
items have zero incomplete markers. Scoped Prettier, documented-path/local-link
checks and `git diff --check` passed. No automated behavior tests were added,
changed or run for this documentation-only task. **T001 is complete; P09 remains
incomplete with T002–T050 outstanding.**

## Phase 2 implementation evidence — 2026-10-09

Scope is T002–T016 only. T002–T010 implement the public capability parser,
current API admission/readiness projection, separate administrator identity and
availability, exact actor/kind/key/target/version observation, shared schemas and
OpenAPI. The safe identity schema now lives in account and is re-exported from
wallet, preserving its public name without the former wallet/withdrawals cycle.
The employee original-quote outcome read uses ReadCommitted after the existing
identity lock so a waited acceptance is visible before deciding expiry; the new
administrator outcome read retains RepeatableRead.

Fresh checks so far:

- Focused account/wallet/withdrawal contract tests: initial expected red was four
  failures and 40 passes; after implementation, three files and 44 tests pass.
- API config/OpenAPI/calendar tests: three files and 49 tests pass.
- Initial HTTP/reservation integration run: two files and 39 tests pass in
  389.24 seconds. The expanded four-file run passed 40/51, exposing an older wallet
  fixture's paused dispatch and ten restricted-role admin reads that unnecessarily
  requested the administrator-population write guard. Corrected focused execution
  passed eight readiness/wallet/exact-key/pause/expiry cases (144.14 seconds), and
  the complete cancellation/claim/admin suite passed 19/19 (149.13 seconds).
- Contracts/database/API owning builds passed, followed by another successful
  API build after composition review. API type checking and existing web consumer
  type compatibility passed. Initial lint found import ordering, an unnecessary
  conditional and an inline type import; these were corrected. Both owning lint
  checks passed. The final API build, contracts/API type checks and API lint also
  passed after correcting the read-only admin lock boundary.
- Expanded wallet coverage exposed an older reservation fixture with dispatch
  still paused. That case now uses the explicitly admitted disposable withdrawal
  fixture; its corrected execution passed in the focused eight-case run.
- The six-file P08 reservation/scheduler/payout/settlement/worker/recovery run passed
  101 checks. Its Linux case failed because a concurrent API rebuild temporarily
  removed `dist` while the fixture copied it. The next isolated attempt reached
  container setup but failed inside the Docker CLI with a host memory-allocation
  error. Neither failed attempt establishes Linux acceptance.
- Five focused shared custody/ledger admission and paused/missing-capability
  original-request replay cases passed (41.40 seconds). The latest withdrawal
  schema rerun passed 34 tests, including unsupported admin counters.

The admin read correction preserves the existing acting-user lock and current
session/role checks, while avoiding a population-write singleton lock. It does not
widen SQL grants or change mutation guards. Real restricted-role forced races
verify current safe flags and exact COMMITTED/SUPERSEDED observations.

**T013 passed.** The isolated built Linux selector passed one test with 26 filtered
cases in 1068.79 seconds (1050.55 seconds in the test). It used fresh compiled
API/contracts/database code with the existing verified dependency-only image
`oscar-p06-custody:7afc9e8d8f0d4987a99ec951534121d8`; the harness revalidates its
immutable image identity, Node/dependency versions and separated role IDs before
copying the fresh code. Configured startup, key/policy, pinned independent archive,
current inventory/admission, original crash recovery and no-accept retry assertions
passed. This supersedes the two setup failures above without concealing them.

Final contract review also rejects committed extension facts beyond the current
request's due/schedule and nonpositive extension facts. The focused schema rerun
passed 34 tests. Fresh contracts/API builds and contracts lint passed afterward.
The exact-original admin HTTP case and three of four extension/rejection forced
race cases passed in a final five-case run; one migration subprocess failed from
host memory pressure before its scenario began. Running that case alone passed
(23.41 seconds). A concurrent diagnostic PowerShell launch also failed from the
host paging limit; subsequent checks used lower concurrency. No test was weakened.

Owning commands actually executed include the focused contract/config/OpenAPI/
calendar selectors and the HTTP/reservation, expanded HTTP/wallet/race, six-file
P08 and shared custody/ledger selectors described above. The Linux command was:

```powershell
pnpm --filter @template/api test:integration src/modules/withdrawals/payout-recovery.integration.test.ts --testNamePattern 'built Linux'
```

Contracts/API lint and type checks, existing web type compatibility and fresh
contracts/database/API builds passed. Build-output inspection found the public
parser/composition, admission projection and corrected read isolation, with no
test fixtures or private E2E controls in API `dist`. Security/code/test/docs review
found no remaining in-scope blocker. Unchanged Nile evidence above is reused;
no live transfer was initiated. T002–T013 are complete; T014–T016 can now start.
No rendering, route or static UI copy changed. Clean-code-guard, test-guard and
security-best-practices review applies to the changed owners; docs-guard checks
this record against actual results. Approval markers and out-of-scope task lines
remain unchanged.

### Shared integration foundations — T014–T016

Withdrawal reads now leave denial revalidation with their scoped read owner.
Financial POSTs retain the existing no-replay policy. Strict withdrawal error
codes require a valid response envelope bound to the original withdrawal route;
editable field projections add `gross`, `address` and `countedHours`, while proof,
token, key, version and authority values are discarded from retained errors.

P09 reuses the P07 observation owner: an immediate first read, at most 20 completed
cycles, 5/10/20/30/60-second capped backoff, coalesced reads, and pause/resume for
visibility, focus and connectivity. Budgets survive authority checks, remounts
and query garbage collection within the same QueryClient. Lists use employee25
and admin10 limits and normalized selections. Explicit refresh and newly
validated persisted-outcome refresh reset through that owner; repeated or older
identity/version observations do not reset it. Query invalidation/refetch cannot
bypass the disabled bounded readers. Retirement removes P09 queries, observation
windows and transition deduplication state. Refresh also invalidates relevant
wallet, ledger, membership and admin finance reads without clearing command
uncertainty or dirty drafts.

The private IPC support creates separate `employee@p09.test` and `other@p09.test`
Free accounts using the existing real ledger funding fixture. Default amounts are
100 non-referral and 30 referral per account; exact optional amounts are validated.
Setup checks disposable database name, current user, loopback location and empty
financial/custody/withdrawal state before explicitly resuming dispatch. The API
receives public Nile capability metadata and its current admitted boot. No payout
key, worker, signer, confirmed destination or withdrawal request is manufactured.
The confirmation destination is the existing loopback `/employee/account` route.
Clock IPC changes the supported service clock, never PostgreSQL payout time.
Inspection returns bounded safe identifiers, exact amounts and counts; captured
confirmation URLs stay on the existing private mail channel. Browser diagnostics
recognize `withdrawals.spec.ts` without retaining its private source/DOM failures.

Verification actually executed:

- The transport/safe-error tests first failed on the new missing behavior and
  passed after implementation. The observation tests first failed on missing P09
  exports; the existing P07 scenarios now run against both owners.
- Ten affected frontend files passed **159 tests** in 47.08 seconds, covering
  transport/session, P07/P09 observation, wallet/package/deposit hooks, purchase
  commands and manual-credit guards. The final registry review was followed by
  another successful **26-test** shared query run (7.06 seconds). The outcome
  refresh scenario retains a real uncertain purchase command and blocks a
  replacement dispatch while preserving the draft.
- Web source and E2E type checks passed. Scoped source and private-support lint
  passed for the affected owners. API private E2E type checking passed using the
  installed compiler directly from `apps/api`:

  ```powershell
  node --max-old-space-size=1024 --max-semi-space-size=4 node_modules/typescript/bin/tsc --noEmit -p tests/e2e/tsconfig.json
  ```

- A one-off private IPC checker launched the actual test server and disposable
  PostgreSQL, rejected pre-setup/duplicate/malformed controls, inspected exact
  funding and admission, changed the service clock without financial effects,
  logged in over real HTTP and issued a destination confirmation. It verified
  captured same-origin fragment mail, safe inspection, zero requests/payout
  attempts and no HTTP test-control endpoint. A final repeat also passed a real
  `WITHDRAWAL_DESTINATION_REQUIRED` envelope through the frontend safe error
  projector, verifying the route binding against actual backend output.
- A fresh `pnpm --filter @template/api build` passed. Output inspection again
  found no E2E/test fixtures or private control modules in API `dist`.

Host memory pressure interrupted an initial query worker and an E2E type-check
attempt before acceptance. Private smoke setup also required supplying the
installed pnpm script path to the standalone launcher; an attempted `--jitless`
mitigation was discarded because the existing SSH dependency needs WebAssembly.
A checker-only readiness field mismatch was corrected to
`withdrawalExecutionReady`. Final checks passed with sequential execution and
process-local heap settings; no runner/configuration requirement or financial
test was weakened. Temporary startup diagnostics were removed.

**Selected Phase 2 scope T002–T016 is complete.** T017 onward remains unimplemented
by this invocation; P09 as a whole is incomplete. UI rendering, routes and static
copy remain unchanged. No live transfer, deployment, commit or push was performed.
Clean-code-guard, test-guard, security-best-practices and React review found no
remaining in-scope blocker; docs-guard checked this record against the source and
actual results. Checklist approval markers and out-of-scope task lines remain
read-only. No implementation extension hooks are registered.

## Phase 3 / US1 implementation evidence — 2026-10-09

**Scope: T017–T025 only.** The active pointer still selects this P09 feature.
Requirements/design review reused the recorded approvals: requirements.md has
16/16 checked items and withdrawals.md has 36/36. Neither checklist changed.
The accepted T013 backend gate and T014–T016 foundations above are reused; this
batch did not repeat protected Linux/Nile acceptance or initiate a transfer.

The employee adapter now validates all existing withdrawal endpoints through
central transport and shared contracts, forwards read cancellation and binds
quote/resource/filter/page identities. Acceptance validates 201/200 against replay
facts. Destination issuance/resend must return the matching pending projection;
proof consumption remains a direct cache-free adapter call. Malformed replies and
private fields produce bounded errors without retained response payloads.

The scoped read hooks use the shared P09 observation owner, employee25 pagination,
authority retirement and one-shot persisted identity/version refresh. Confirmed
reservation/outcome facts refresh relevant withdrawal, wallet, ledger and membership
queries; no balance is patched optimistically. The command owner persists only a
validated actor/quote/request-key handle before dispatch. Web Locks coordinate
callers; offline/storage/readback/retirement failure blocks unsafe dispatch.
Uncertain and reloaded handles observe the original quote, never automatically
resubmit. Only proven no-send, the specified definite first-dispatch rejections,
COMMITTED or EXPIRED_UNCOMMITTED retire that handle. Live NOT_OBSERVED remains
blocked. A same-account session-check change now settles an obsolete reply as
uncertain, allowing observation after fresh authorization; actual actor retirement
cannot publish the old completion into a different scope.

The existing form and confirmation sheet review exact server gross/rate/fee/net,
eligible and allocated sources, top-up, saved recipient/network and Baghdad schedule.
Amount text normalizes harmless zeros without floating-point conversion. Dirty input
survives stale rejection, which requires another explicit quote review. All five
active states, missing readiness/destination, restrictions and unresolved commands
guard creation. Actor/epoch changes retire form drafts. OD-002 wording replaces the
local acceptance timer, fixed fee authority and 24-hour cooldown in this form.

### Tests and commands actually executed

Added colocated employee adapter, read-hook, command/recovery and form test files,
the shared presentation fixtures in `apps/web/src/test/p09-withdrawals.ts`, and the
US1 journeys in `apps/web/e2e/withdrawals.spec.ts`.

```powershell
pnpm --filter @template/web test src/features/employee/api/withdrawals.api.test.ts src/features/employee/hooks/withdrawals.hooks.test.tsx src/features/employee/hooks/withdrawal-command.hooks.test.tsx src/features/employee/components/withdraw/withdrawal-form.test.tsx
pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts
pnpm --filter @template/web check-types
pnpm --filter @template/web check-types:e2e
```

- Test-authoring runs first failed on absent adapter/read/command targets.
  After implementation the four-file cohort passed 39,
  then 44 checks as boundary/recovery coverage expanded. Final adapter execution
  passed 19 tests. The final affected ten-file run passed **171 tests** in 17.84
  seconds: these four files plus financial-query, api-client, safe-error, purchase
  command, deposit hooks and wallet hooks. After the final same-account obsolete
  reply correction/test split, the command/recovery file passed **13 tests** in
  3.12 seconds; the broader cohort was not repeated afterward.
- The final full browser command passed **four journeys**, with real Next/API,
  disposable migrated PostgreSQL, actual authentication/CSRF and email-bound
  destination issuance/consumption through real HTTP. The test setup confirms the
  destination independently of the still-unimplemented US2 entry UI. Browser
  acceptance covers exact review, unsupported precision, Free retained-referral
  exclusion, zero-effect definite expiry/stale rejection followed by explicit
  fresh review, reload, genuinely executed acceptance with a suppressed reply,
  and two independent contexts synchronized before their competing POSTs.
  Persisted inspection proves one request, one active source allocation, one new
  ledger operation/action, gross100/fee21/net79, reserved non-referral100 and
  unchanged available referral30. No worker, signer or payout attempt is involved.
- Each final browser run builds the actual production web application through
  the existing harness. Web source/E2E type checks and scoped ESLint passed.
  Scoped Prettier and `git diff --check` passed. Initial checks exposed strict-lint
  issues and a nullable test-prop inference error; these were corrected. An initial
  browser build failed on that test type error. The first setup then rejected an
  invalid checksum address; the fixture now uses a valid public TRON address.
  Subsequent checks passed without weakening validation, runners or assertions.
- Review screenshots at 320/390/430/1280px are under ignored
  `output/playwright/p03/p09-us1-review-*.png`. Browser assertions cover Cairo,
  page/dialog overflow and focus containment; 320px and desktop captures were
  visually inspected, including the final source/schedule fields. Existing sheet,
  control classes, route composition, layout, typography and navigation are reused.
  Only the form's authorized runtime values, inline feedback and OD-002/003 text
  changed; no new page, route, popup or styling system was added.

Clean-code-guard, test-guard, security-best-practices, React best-practices,
Playwright and docs-guard were applied. Review fixed same-account obsolete reply
recovery, changed-draft confirmation gating, strict pending destination bindings,
missing source/dispatch review facts, fabricated pre-quote zero displays and stale
scaffolding comments. Existing ignore rules cover all generated evidence; no ignore
edit or dependency change was needed. No extension hooks are registered.

**T017–T025 are complete. P09 remains incomplete: T026–T050 are untouched and
outstanding.** Destination-entry/account and lifecycle/history surfaces retain their
existing implementation until their separately scoped US2/US3 tasks; US1 does not
establish their acceptance. Administrator integration and the full P09 checkpoint
remain pending. P11 launch/restore/independent-review gates remain separate. No
deployment, mainnet/testnet transfer, commit or push was performed.

## Phase 4 / US2 implementation evidence — 2026-10-09

**Scope: T026–T032 only.** The active pointer remains this P09 feature.
Requirements checklist approvals (16/16 and 36/36), T013's backend acceptance
and T014–T025's shared/US1 evidence were reused; checklist markers are unchanged.
The prerequisite script passed through installed Git Bash after the default
`bash` command selected an unavailable WSL shell. No extension hooks exist.

The new private `hooks/use-withdrawal-destination-link.ts` owns the email proof
in a transient ref. Its nonvisual `withdrawal-destination-boundary.tsx` is mounted
immediately outside the existing employee ProtectedRoute. Recognized account
fragments are scrubbed with native history state preserved before passive guards
navigate. Opening, reload and Strict Mode do not consume. Same-route hashchange
is supported; anonymous/retired sessions, departure and pagehide dispose the
credential. Explicit consumption rechecks the reviewed pending version, address,
network and proof status. Lost replies observe current destination without replay;
ordinary authority rechecks retain only safe observation facts. Credentials never
enter Query keys, mutation variables/context/meta, persistent storage or rendered
props. Preflight disposal and operation identity prevent late retired completion.

The existing `withdrawals.hooks.ts` now owns issuance/resend and bounded saved-version
observation. Its non-secret guard survives remount and ordinary session checks in
the same QueryClient; current authority/configured network, server cooldown and
version are checked before sending. An exact current-scope checksum rejection is
known to precede issuance and permits corrected review; other uncertain sends stay
guarded and observe. Confirmed destination versions refresh relevant eligibility
through the existing scoped refresh owner, without optimistic wallet changes.

`withdrawal-address-card.tsx` reuses shared validation/RHF and the existing sheet
for exact first-address/network review. The account screen changes only destination
hooks and its existing address section. Shared `withdrawal-destination-details.tsx`
shows pending address, Baghdad expiry/cooldown, truthful delivery acknowledgement,
resend/refresh and inline explicit confirmation/results. Confirmed destination is
read-only/copyable; employee replacement remains unavailable. No route, popup
design, stylesheet, dependency or backend implementation changed in this batch.

### Actual verification

```powershell
pnpm --filter @template/web test src/features/employee/api/withdrawals.api.test.ts src/features/employee/hooks/use-withdrawal-destination-link.test.tsx src/features/employee/hooks/withdrawals.hooks.test.tsx src/features/employee/hooks/withdrawal-command.hooks.test.tsx src/features/employee/components/withdraw/withdrawal-address-card.test.tsx src/features/employee/components/withdraw/withdrawal-form.test.tsx src/features/employee/components/account/account-screen.test.tsx src/services/api/api-client.test.ts src/services/api/safe-error.test.ts src/shared/query/financial-query.test.ts
pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts
pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts --grep US2
pnpm --filter @template/web check-types
pnpm --filter @template/web check-types:e2e
```

- The ten-file affected cohort passed **183 tests** in 24.86 seconds. After the
  final pagehide/disposal and short-label changes, the link/account/address cohort
  passed **26 tests** in 6.36 seconds, including 11 private-link cases. The full
  ten-file cohort was not repeated after those final changes.
- The complete withdrawal browser file passed **seven journeys**, retaining all
  four US1 regressions. The final US2-only run after the privacy/label changes
  passed **three journeys**. Each run builds the actual production web application
  and uses real API/authentication/CSRF, captured email and migrated disposable
  PostgreSQL. Inspection proves pending issuance/resend versions, zero write on
  opening, fixed confirmation across reload, wrong-account/superseded/expired
  safety, signed-out fragment disposal and recovery after a genuinely executed
  consume whose reply was suppressed. Reopening the consumed link offers no
  replacement/consume action. No payout worker, signer or live transfer is involved.
- Source/E2E type checks, scoped ESLint (including the employee layout), scoped
  Prettier and `git diff --check` passed. An intermediate broader run exposed a
  stale-quote fixture counting new destination GETs as writes and an optional
  Axios-adapter restore type error. Both were corrected without relaxing the
  one-send assertion; the associated intermediate browser build failure was
  followed by successful fresh builds/runs.
- Masked captures at 320/390/430/1280px are under ignored
  `output/playwright/p03/p09-us2-account-*.png`. Browser assertions check page
  overflow; 320px/desktop captures were visually inspected. The new confirmation
  label was shortened to fit the existing control at 320px. Existing sheet,
  typography, RTL, classes, navigation and unrelated account behavior remain.

Clean-code-guard, test-guard, security-best-practices, React best-practices,
Playwright and docs-guard were applied. Review fixed authority-recheck guard
retention, bounded late confirmation observation, preflight/pagehide credential
disposal, obsolete completion handling and narrow-label clipping. No remaining
in-scope finding was identified. Ignore rules already cover generated artifacts.

**T026–T032 are complete. P09 remains incomplete: T033–T050 remain outstanding.**
US3 lifecycle/history, admin integration and the complete P09 checkpoint are not
claimed by this batch. P08 Linux/Nile evidence is reused, not freshly rerun;
no full `pnpm verify`, protected signer/testnet or P11 launch/restore validation ran.
Single-admin/no-2FA and compromised-host residual risks remain; P11's independent
review and launch gates are unchanged. No convergence, deployment, transfer,
commit or push was performed. Next authorized scope can be US3 T033–T036.

## Phase 5 / US3 implementation evidence — 2026-10-09

**Scope: T033–T036 only.** The active feature remains P09. Requirements approvals
(16/16 and 36/36), T013's backend acceptance and completed T014–T032 evidence
were reused after affected-source inspection. The prerequisite script passed
through installed Git Bash. No extension hooks exist; checklist approvals and
out-of-scope task markers are unchanged.

`withdrawal-status-card.tsx` now consumes the existing scoped employee status and
employee25 history hooks instead of the demo context. It distinguishes all nine
states and safe blockers, presents exact saved gross/rate/fee/net, immutable
recipient/network/source allocation, original/current deadlines, earliest dispatch
and server counted-time snapshots. Native inline disclosures show saved action
actor/time/reason/version, confirmed settlement or identical-source release and
zero charged fee. UNKNOWN stays reserved; zero duration never asserts payment.
Previous/Next, authoritative page/count, empty/error/contract/denial feedback,
first-page recovery and explicit refresh remain inside the approved surfaces.
An empty result shows the server's zero-page count. The screen subtitle now
truthfully describes scheduled payout under OD-002. Production read hooks,
backend/payout/calendar implementation, routes, styles and dependencies are unchanged.

### Actual focused verification

```powershell
pnpm --filter @template/web test src/features/employee/api/withdrawals.api.test.ts src/features/employee/hooks/use-withdrawal-destination-link.test.tsx src/features/employee/hooks/withdrawals.hooks.test.tsx src/features/employee/hooks/withdrawal-command.hooks.test.tsx src/features/employee/components/withdraw/withdrawal-address-card.test.tsx src/features/employee/components/withdraw/withdrawal-form.test.tsx src/features/employee/components/withdraw/withdrawal-status-card.test.tsx src/features/employee/components/account/account-screen.test.tsx src/services/api/api-client.test.ts src/services/api/safe-error.test.ts src/shared/query/financial-query.test.ts
pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts --grep US3
pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts
pnpm --filter @template/web check-types
pnpm --filter @template/web check-types:e2e
```

- The final affected eleven-file unit/component cohort passed **201 tests**
  (40.28 seconds). The new status-card file has 14 behavior tests; the read-hook
  file adds three lifecycle/expiry/observation/paging cases. Coverage includes five
  active creation blockers, all terminal dispositions, immutable terms/audit,
  failed/malformed/empty reads, denial retirement, late pages, settled range
  recovery, external extension/release, retained paid/referral terms after expiry,
  UNKNOWN through focus pause/resume, exhaustion, explicit restart and departure.
  The existing shared observation cohort retains offline/hidden/check/remount/GC
  and versioned refresh coverage. No financial command is automatically retried.
- The revised US3-only browser run passed **two journeys**. The first uses actual
  authentication/CSRF, captured destination email, quote/acceptance, persisted
  schedule/history reads and administrator extension/rejection over HTTP against
  disposable migrated PostgreSQL. It proves Friday12 Baghdad → Wednesday12,
  zero weekend accumulation, an exact 1.5-counted-hour extension, retained
  reservation at zero, source-identical release, reload and wallet restoration.
  Additional real reservations verify Saturday acceptance starts counting Monday
  and a deadline at Saturday00 normalizes dispatch to Monday00. These controlled
  application-clock reads do not advance protected SQL-clock claims or send money.
- The second browser journey explicitly routes validated lifecycle/expiry/finality/
  release presentation fixtures and employee25 pages around one real accepted
  request. It checks all nine distinct labels, saved referral terms after expiry,
  active blockers, terminal display and Previous/Next without modifying persisted
  money/attempts; before/after private inspection is identical. Seeded COMPLETED
  presentation on a Saturday is not actual chain confirmation. P08's accepted
  protected claim/finality/Redis/recovery and Nile records remain reused evidence.
- Intermediate checks are preserved as failures, not acceptance: the initial
  status tests exposed the demo-context dependency; early test fixtures violated
  pagination/fee-basis contracts and fake-timer setup, then were corrected. Scoped
  lint found void callback/async syntax issues, which were fixed. A full browser
  run passed its first eight journeys but failed the repeated-navigation seeded
  history check. That journey now observes the mounted view through explicit
  scoped refresh and waits for each state's distinct label before paging checks.
  An added distant-date case exceeded the legitimate 14-day session lease; an
  equivalent nearer weekday boundary now stays inside it without changing auth
  configuration or guards. The revised two-journey run passed afterward.

Final full-browser and final mechanical-check disposition is recorded below.

- The final full withdrawal browser file passed **all nine journeys**
  (`P03-SCENARIO-1` through `P03-SCENARIO-9`, `P03-RUN passed`). Both new
  US3 journeys assert no unexpected browser console/page errors or failed API
  responses. Final source and E2E type checks, scoped ESLint, scoped Prettier and
  `git diff --check` passed.
- Masked full-page captures at 320/390/430/1280px are retained under ignored
  `output/playwright/p03/p09-us3-schedule-{width}.png`. The 320px and 1280px
  captures were visually inspected; RTL wrapping and existing Cairo presentation
  remain readable. Browser assertions check viewport overflow and Cairo, and
  exercise the native disclosure with Enter. This is scoped US3 evidence, not
  completion of the broader T049 visual and isolation matrix.
- Applied reviews: clean-code-guard, test-guard, security-best-practices,
  vercel-react-best-practices and docs-guard. No unresolved scoped findings remain;
  no new dependency, authorization bypass, financial transition or countdown
  inference was introduced. The existing backend release and payout authority
  remain unchanged. `clean-code-guard: clean`.
- **T033–T036 are complete. P09 is incomplete:** T037–T050 remain unchecked.
  No full `pnpm verify`, full web browser suite, fresh complete P09 checkpoint,
  P08 signer/testnet payout run or P11 release validation was performed in this
  batch. Checklist approval markers remain unchanged. No commit, push, deployment
  or real-money transfer was performed.

## IMPLEMENT Phase 6 — US4 scoped evidence (2026-10-09)

Scope: **T037–T047 only**, under P09. The existing approved requirements
checklists, T013 backend gate and T014–T036 prerequisites were reused; approval
markers were not changed. The private browser harness uses disposable migrated
PostgreSQL, actual authentication/CSRF and the production Next build.

Administrator withdrawal integration now owns validated enriched reads, server
search/state filters, admin10 pagination, matching current detail and scoped
refresh. Existing rows expose immutable terms, saved identity, counted-time
snapshots, source disposition and action actor/time/reason/version through an
inline disclosure. Manual Complete, held Release/filter and unsafe processing
Reject wiring are removed from this screen. Existing providers/demo ownership
cleanup remains T048.

Extension/rejection require current safe SCHEDULED flags, fresh matching version,
reason and explicit confirmation. Positive supported fractional hours stay exact
strings; the extension dialog reviews added hours and saved deadlines without
inventing a future server deadline. It preserves dirty input through transient
refresh and disables dismissal during pending work. It reuses the existing focus
containment/restoration hook. Visual review restored the existing date-cell
wrapping rule and bounded only the new expanded disclosure to a readable width
within the existing table scroll container.

The administrator command runtime coordinates actor-scoped dispatch with Web
Locks and durable opaque recovery identity plus a SHA-256 body fingerprint.
Hours/reasons are not retained in storage. Pending work survives component
remount; after reload only exact outcome observation is available. Manual retry
requires a reproducible original intent, the original key and fresh review.
NOT_OBSERVED stays blocked; COMMITTED requires the exact actor/target/kind/key/
version and preserves saved audit feedback; SUPERSEDED requires new review and
does not claim that this administrator's command succeeded. No automatic POST
retry or financial state transition is introduced.

### Actual verification

- The final affected **16-file unit/component cohort passed 237 tests**
  (48.45 seconds): the eleven employee/transport/query files listed in the US3
  command above, plus administrator `api/withdrawals.api.test.ts`,
  `hooks/withdrawals.hooks.test.tsx`, `hooks/use-withdrawal-action.test.tsx`,
  `components/withdrawals/withdrawals-screen.test.tsx` and
  `components/withdrawals/extend-schedule-dialog.test.tsx`. The five administrator
  owners contain 36 tests. Coverage includes malformed/private/wrong-intent
  replies, cancellation, admin10 filters/range recovery, late/retired detail,
  immutable intent/reload/manual retry, exact outcome outside visible latest100
  history, offline/storage failure, stale preflight, dirty drafts, fractional
  validation, keyboard focus and pending dismissal. SIGNING, SIGNED, SUBMITTED,
  UNKNOWN and SCHEDULED with denied flags remain readonly with null TxID.
- `pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts` passed **all
  eleven journeys**, with `P03-RUN passed`. The two added US4 journeys use actual
  administrator HTTP extension/rejection. Reply loss follows a real successful
  extension, then exact keyed observation proves saved version/deadline/audit
  and one send. Rejection posts one release operation and restores the identical
  non-referral/referral source allocation with zero fee and no payout attempt.
- The stale-version journey pauses the original browser request, commits a
  competing administrator extension, then receives a real 409 for the loser.
  SUPERSEDED feedback and persisted action counts prove one allowed winner.
  A separately controlled non-signing claim then persists SIGNING and one
  attempt; UI controls disappear despite null TxID, and both real HTTP commands
  receive 409 without changing the inspected state. The private
  `p09-claim-fixture` command is restricted to initialized NODE_ENV=test,
  loopback `p03_e2e` owned by `p03_test`, the known test employee and an unclaimed
  fixture. An ephemeral restricted p06_signer login obtains normal boot
  acknowledgement and uses the existing non-signing SQL claim helper. Actual
  SQL-clock due/admission/account/destination guards remain active. No signing
  credential, SQL-clock override, signer process, broadcast or transfer occurs.
  Claim-versus-admin race proof remains the accepted T012/P08 evidence.
- Intermediate failures were investigated and corrected: initial red adapter/
  action tests had missing owners; invalid pagination fixtures and hook type
  inference failed validation/build; scoped lint found number-template and
  browser-storage typing issues. Early browser runs exposed the frozen UI's
  missing favicon and a test route that released the paused request too early.
  The route now stays paused until the competing write commits. The narrow
  established favicon 404 exception and deliberately induced extension
  ERR_FAILED/409 exceptions are explicit; other console/page/API failures fail
  the new journeys. Temporary diagnostic writers were removed.

Final post-review visual/static disposition is recorded below.

- The post-review `pnpm --filter @template/web test:e2e
e2e/withdrawals.spec.ts --grep US4` run passed both administrator journeys,
  including the disclosure-width correction and final capture changes. The
  harness rebuilt the production web application for this run. Masked extension
  captures at 320/1280px and administrator table captures at 390/1280px are under
  ignored `output/playwright/p03/p09-us4-{extension,admin}-{width}.png`.
  Extension 320/1280px and table 1280px were visually inspected after the
  correction; browser assertions reject viewport overflow. This is scoped US4
  evidence; T049 retains the broader keyboard/isolation/visual matrix.
- Final web source/E2E and API E2E type checks passed. Scoped web/API ESLint,
  scoped Prettier and `git diff --check` passed. Applied clean-code-guard,
  test-guard, security-best-practices, vercel-react-best-practices and docs-guard;
  no unresolved scoped findings remain. The shared transport/contracts/query
  owners and production backend financial rules were reused unchanged in this
  batch. No dependency, route, popup design or authorization bypass was added.
  `clean-code-guard: clean`.
- **T037–T047 are complete. P09 remains incomplete:** T048–T050 are unchecked.
  No full `pnpm verify`, full web browser suite, fresh complete P09 checkpoint,
  protected Linux/Nile payout rerun, P11 release validation or CONVERGE was
  performed. Reused P08 evidence does not prove production release readiness.
  The approved no-2FA administrator/host-compromise residual risks and P11
  WAL/restore/deployment/release boundaries remain unchanged. No commit, push,
  deployment or real-money transfer was performed. No after_implement hooks are
  registered because `.specify/extensions.yml` is absent.

## IMPLEMENT Phase 7 - cleanup and acceptance (2026-10-09)

Scope: **T048-T050 only**, within P09. The active pointer, 16/16 and 36/36
requirements approvals, T013 backend gate and completed story evidence were
reused after affected-source review. The Git Bash prerequisite check resolved
this feature. No extension hooks are registered. Approval markers and earlier
task lines remain unchanged.

**T048:** Caller inspection found no production consumer of the employee demo
withdrawal state/address/reserve/release/complete actions or administrator demo
hold/release/extend/reject/complete actions. Those owners and obsolete context
assertions were removed. Administrator fixture withdrawal reads remain for the
P10 overview and employee-detail consumers; global providers, unrelated preview
actions and fixtures remain. Real feature adapter/hook/component/browser tests
own withdrawal acceptance instead of the removed demo transition assertions.
The focused context and employee/admin withdrawal component run passed **59
tests in eight files**; web source types passed. Cleanup removed 945 lines and
added 18 lines across nine existing owners, including deleting the orphaned
administrator action hook.

**T049 acceptance coverage:** Four cross-story journeys were added to
`apps/web/e2e/withdrawals.spec.ts`: malformed/unavailable/empty history with
preserved dirty input; bounded observation exhaustion and explicit restart
without financial effects; actual HTTP ban/session retirement followed by an
independent account; and exact six-decimal quote/keyboard/phone-desktop review.
The existing seeded lifecycle journey additionally exercises settled page-range
shrink and recovery. Routed lifecycle/history data remains presentation evidence.
The existing proof journeys retain fragment/storage/privacy and explicit-consume
coverage; existing hook tests retain late resource/page replies and private
command/observation isolation coverage.

Intermediate browser failures were investigated rather than accepted: an invalid
first-page pagination fixture was replaced by a genuine second-page shrink in
the existing paging journey; expected favicon diagnostics now use the existing
exact absent-favicon exception. The ban fixture initially froze financial time
before real login, violating session revocation timestamp constraints (HTTP500).
Advancing only the supported fixture clock past login made the actual ban and
account-switch journey pass. The keyboard test was corrected to wrap to the
existing last control, Back, rather than the preceding confirmation control.

The keyboard journey also reproduced a production focus-restoration defect:
asynchronous quote loading disables the review trigger before the sheet captures
focus. The existing sheet now accepts an optional explicit return-focus ref;
the withdrawal form captures its own submit control before dispatch and supplies
that ref. No route, styling, copy, financial authority or popup design changed.
A delayed-quote component regression and existing sheet/form tests passed **21
tests in two files**. Final browser/static/checkpoint results follow below.

T049's final focused journeys passed: the corrected read-failure and exhaustion
journeys, seeded lifecycle/pagination-shrink journey, separate actual revocation
journey, and post-fix exact-quote/focus journey. The final quote run rebuilt the
production web app and passed at 320/390/430/1280px. Masked captures were written
to ignored `output/playwright/p03/p09-acceptance-quote-{width}.png`; the 320px
and desktop captures were visually inspected. Existing Arabic/Cairo/RTL and
sheet controls remain readable, keyboard wrap and Escape return focus pass,
and no reservation occurs during review/dismissal. Scoped ESLint, web source
and API/web E2E types, scoped Prettier and `git diff --check` passed. Applicable
code/security/React/test review found no remaining scoped issue. T048/T049 are
complete; T050 and whole P09 acceptance still require the full checkpoint.

T050 checkpoint investigation: the initial full `pnpm verify` run passed all
1,622 unit tests (312 contracts, 9 database, 576 API, 725 web) but exposed a
historical P04 migration-test incompatibility with the current Prisma client.
The fixture now explicitly selects all historical allocation fields and checks
that the later settlement fields migrate to null. Its focused 15-test suite
passed; no production schema or migration was changed.

The next full checkpoint passed all 84 database integration tests and 611/612
API integration tests. The 27-test payout-recovery suite passed, including the
built Linux signer/operator/escrow crash-recovery journey (808.623 seconds).
The single failure was the purchase/reservation integration scenario using a
clean financial fixture with dispatch paused. It now uses the existing explicit
withdrawal-admission fixture; all original money/source assertions remain.
Neither failure was accepted as a pass. Final rerun results follow below.

The corrected purchase file passed all 40 integration tests. The first full
browser run completed 106 scenarios: 104 passed, two failed. All P09 withdrawal
journeys passed. The old account-page request allowlist omitted the two new
P09 status/destination read paths; it now names those exact paths. The old
ban-after-login journey used a financial clock frozen before real login; it now
advances the supported fixture clock before HTTP ban, preserving actual
revocation and restoration assertions. No production behavior was changed for
these regression-fixture corrections. Focused and final full reruns follow.

Both corrected account/revocation browser scenarios passed focused execution
and the next full run. That run passed 105/106 scenarios, including every P09
journey, but exposed an intermittent older configuration-edit test: it pressed
Escape immediately when failure feedback appeared, before the dialog's busy
state settled. The test now waits for its existing Cancel control to enable
and asserts Escape removed the dialog before interacting with the page behind
it. No sleeps, larger timeouts, automatic retries or production changes were
introduced. Repeated focused and final full results follow below.

The corrected configuration-dialog journey passed three repeated focused
executions with automatic retries disabled. The subsequent complete web browser
suite passed **106/106 scenarios**, including all P09 acceptance journeys.
Both API/web E2E type profiles passed again after the regression-test edits.
Final masked 320px and 1280px quote captures were visually inspected; Cairo/RTL,
wrapping and visible existing sheet actions remain intact. All four viewport
widths and keyboard/focus behavior passed in the full browser run.

Applied skills: speckit-implement, clean-code-guard, test-guard, docs-guard,
security-best-practices, vercel-react-best-practices and playwright. Final scoped
production/test review found no remaining issue. Test-only checkpoint repairs
preserve real migrated infrastructure, authority gates and financial assertions.
The final fresh API build and complete verify rerun are recorded below when done.

The next full verify run stopped at 724/725 web unit tests: the withdrawal
observation-exhaustion component scenario exceeded the unchanged 5-second test
limit while using asynchronous fake-clock advancement. It now advances the fake
clock synchronously inside React act and flushes the boundary promises. All 24
observation cycles, exhausted/stopped reads, retained UNKNOWN reservation and
explicit-refresh assertions remain. Its complete 14-test file passed. Production
code and test timeout are unchanged; the 106/106 browser pass remains applicable.
The final complete checkpoint rerun follows below.

Checkpoint on 2026-10-10: all **1,622 unit tests passed**, including the corrected
observation scenario in 1.736 seconds under the unchanged 5-second limit.
Database integration then failed with ENOSPC and connection termination, followed
by a Docker containerd metadata I/O error during cleanup. The API integration run
did not complete. These are failed/unavailable infrastructure results, not passes.
After the interruption, Docker responded again and a disposable PostgreSQL-image
container successfully ran a writable-container/space probe (4% overlay usage).
No global Docker pruning, volume removal or service restart was performed by
this implementation. T050 remains open pending the recovered full checkpoint.

The recovered database suite passed 83/84 tests and exposed an order-dependent
P04 assertion: the shared migrated database already held five valid fixture
purchases from an earlier suite. The no-invented-purchase-history assertion now
runs against the existing migration test's fresh isolated database immediately
after P04 deployment, before its deliberate purchase fixture. Exact seeded
catalog/rates assertions remain in their original test. No retained data is
removed and the zero-history requirement remains asserted.

The complete database suite passed 84/84 after the history-ownership correction.
A subsequent checkpoint again passed all database tests, but built Linux payout
and treasury cases failed after Docker recovery with an invalid workspace package
manifest. A retained disposable acceptance image contained an empty database
package.json. The existing createLinuxCustodyRuntime({ freshBuild: true }) rebuilt
the image without cached layers; both workspace packages then imported successfully.
A second normal cached fixture also passed the import probe. Application code remained unchanged. Unrelated Docker volumes and global build
cache were not pruned.
The known-failed checkpoint process tree was identified and stopped before its
remaining suites completed; its API result is incomplete, not a pass. The complete
checkpoint was restarted against the repaired image cache.

The restarted checkpoint passed all 84 database integration tests, all 27
payout-recovery tests (including built Linux recovery), all 22 treasury tests and
all 40 subscription-purchase tests. The built custody restoration scenario failed
in that full run; its unchanged isolated execution then passed (1 passed,
7 intentionally unselected). The isolated pass does not replace the failed full
checkpoint. T050 remains unchecked pending the complete result and diagnostic.
Evidence: `output/p09-verify-clean-cache.log` and
`output/p09-custody-diagnostic.log`. No custody production controls or test
assertions were changed to obtain the isolated pass.

Final full checkpoint result on 2026-10-10: `pnpm verify` exited 1 after
**611/612 API integration tests** (47/48 files). The sole failure was
`custody-recovery.integration.test.ts`, built Linux restoration,
`CUSTODY_LINUX_ACCEPTANCE_FAILED:missing-escrow-denied:SAFE_FAILURE`.
The safe diagnostic does not distinguish a child timeout from an unexpected
exit-code assertion; its unchanged isolated pass cannot establish the cause.
The full run passed Prisma validation/generation, formatting, lint, source types,
unit checks and all 84 database integration tests. Turbo reused successful unit
results; the prior fresh 1,622-test pass is recorded above. The fresh API build
preceded this run. Both API/web E2E type profiles passed again after it.
The complete 106/106 browser pass remains applicable; no production or browser
code changed after that run.

T050 and P09 acceptance remain **incomplete**. The next implementation action is
to diagnose the bounded missing-escrow child failure, preserve the actual denial
assertion and obtain a passing complete checkpoint. No P06 custody production
behavior, assertion, timeout or automatic retry was changed for this failure.
The no-2FA/admin-host residual risks and P11 WAL/restore/deployment/release
boundaries remain unchanged. No live Nile/mainnet transfer, deployment, commit,
push, CONVERGE or next-phase implementation was performed in this batch.

Since failed integration stopped `verify` before its build stage, `pnpm build`
was run separately and passed all four package tasks (API/web fresh,
contracts/database cached; 44.191 seconds). `pnpm verify:build-output` also
passed. These separate passes do not make the failed `pnpm verify` green.

Follow-up T050 diagnosis on 2026-10-10: the test-only Linux child harness now
records a bounded exit code, termination signal and termination category for
the missing-escrow denial failure. It exposes no raw child output, credentials
or key material. The 30-second child deadline, output limit and expected denial
exit code 1 remain unchanged. The complete custody integration file passed
8/8 tests in 173.05 seconds; the earlier failure did not reproduce, so its
cause remains unconfirmed. Scoped ESLint and Prettier passed. Test-guard review
found no weakened assertion or replacement of real infrastructure. A fresh API
build and full checkpoint rerun follow in `output/p09-api-build-diagnostic.log`
and `output/p09-verify-diagnostic.log`; T050 remains open until that result.

Final T050 acceptance on 2026-10-10: **`pnpm verify` passed, exit 0**.
All 48 API integration files passed (**612/612 tests**, 3,149.61 seconds),
including all eight custody tests and the previously failing missing-escrow
denial journey (104.693 seconds). All 84 database integration tests passed.
All 1,622 unit tests passed: API's 576 executed fresh; contracts/database/web
reused valid successful Turbo results. Prisma formatting/validation/generation,
formatting, lint, source types and final diff checks passed. The initial API
build was fresh; the final root build executed API fresh and reused the three
unchanged package builds. Build-output verification passed: 13 required entries,
828 emitted files and no test artifacts. The schema SHA-256 remained
`A9D7006A2908AAB5DBC326A1F2CD9FEB608B34739951AE5F1A56688E6FACE089`.

Both E2E type profiles passed again during this final checkpoint. The recorded
full browser suite passed 106/106 with retries disabled; its result and masked
320/390/430/1280px RTL/Cairo/keyboard/focus acceptance remain applicable because
the only subsequent source edit was the Linux test-harness diagnostic.
The earlier intermittent missing-escrow failure did not reproduce; its root
cause remains unconfirmed. Diagnostic instrumentation improves a future failure
report and is not claimed as a custody behavior fix. Neither financial controls,
test assertions, deadlines nor automatic retries were weakened.

Final scoped test/docs review found no remaining finding; prior production,
security, React and UI reviews remain applicable. T048–T050 are complete and
all current P09 implementation tasks are checked. No extension hooks are
configured. No CONVERGE or next-phase implementation was run. The no-2FA and
admin-host residual risks, and P11 production WAL/restore/deployment/release
boundaries remain open as previously approved; this acceptance is not a
production deployment or a new live Nile/mainnet payout validation.

## P09 convergence remediation — T051–T056, 2026-10-10

This entry records the later, explicitly scoped IMPLEMENT batch. The earlier
T050 checkpoint remains historical evidence; it does not accept these new tasks.
Checklist approval markers, T001–T050, the feature pointer and approved design
remain unchanged.

- T051: the shared transport defers session revalidation only for a strictly
  validated `POST /withdrawals` first-response `WITHDRAWAL_BLOCKED`/403. The
  command owner can retire its durable handle before its existing error handler
  revalidates restrictions. Its original authority and failed-retirement checks
  remain in place. Actual Axios-adapter tests cover valid versus malformed,
  mismatched and externally changed authority; failed storage removal retains
  uncertainty. No automatic command replay was added.
- T052: status retains the last active request identity within its mounted,
  actor/epoch-scoped observer. When status becomes null, the existing authorized
  detail endpoint must prove terminal disposition before version-deduplicated
  wallet/ledger/history invalidation. Absence alone changes no money. Tests cover
  release/completion with only wallet/status mounted, page-two history refresh,
  repeated null and bounded observation stop.
- T053: typed/preset amount edits retire dismissed quote terms; displayed
  fee/net require the quote gross to match the normalized current draft. A new
  quote and explicit confirmation are required; fees still come from the API.
- T054: same-actor/target/action dialogs retain reason and extension hours after
  supersession. A separate explicit review adopts fresh detail/version before
  another explicit confirmation. Immutable original command intent is unchanged.
  Actual authority/resource retirement clears the draft; fresh readonly detail
  prevents dispatch. The stale-write and real non-signing SQL-claim journeys are
  separate tests, preserving the latter's due/admission/weekday assertions.
- T055: existing inline admin list/detail feedback uses safe classified errors
  to distinguish malformed contracts from unavailable reads. Actual denials hide
  protected rows/actions. No raw error payload is rendered.
- T056: browser regressions exercise dismissed quote edits, blocked first
  acceptance, external rejection with account wallet mounted, preserved stale
  extension/rejection drafts, distinct read feedback and expanded 320px admin
  details/actions with exact `99.123456` gross, a full TRON recipient, bounded
  horizontal table scrolling, no page overflow and keyboard interaction.
  Completion browser coverage uses strictly parsed response-boundary doubles
  while asserting the real persisted reservation is unchanged; it is frontend
  freshness evidence, not settlement, signing or payout acceptance.

Fresh focused verification: **190/190 tests, 10/10 files**, 39.45 seconds,
recorded in `output/p09-remediation-focused-complete.log`. The command selected
the actual transport/safe-error/shared-query tests, employee command/read/wallet/
form tests and admin screen/extension/read-hook tests. Earlier runs exposed
incorrect error-envelope test construction, an overly strict denial-feedback
assertion and browser selector ambiguity with the mobile sidebar; those were
corrected without relaxing command, authorization or financial assertions.

The action-hook file additionally passed **9/9 tests** in 5.78 seconds
(`output/p09-remediation-action-final.log`), including both extension/rejection
pre-dispatch fresh-version conflicts, current-detail refresh, zero sends and
unchanged original reviewed intent. Together these disjoint focused selections
passed **199 tests across 11 files**. Both final E2E type profiles passed with
exit 0 (`output/p09-remediation-api-e2e-types-final.log` and
`output/p09-remediation-web-e2e-types-final.log`). The final isolated expanded
320px browser check passed (`output/p09-remediation-browser-320-final.log`);
its named confirmation locators disambiguate the existing mobile sidebar.
The masked `output/playwright/p03/p09-remediation-expanded-320.png` was visually
inspected. T051–T055 are complete; T056 remains open for the full gates.

Review applied: clean-code-guard, test-guard, security-best-practices,
vercel-react-best-practices, installed Next.js client-boundary guidance,
playwright and docs-guard, against the engineering guides. The review added
readonly resource retirement and masked the newly displayed request/version in
the existing extension screenshot. No production dependency, backend financial
rule, deadline, test retry, route, layout or styling changed in this remediation.
The exact current request/version and review feedback use existing dialog
surfaces. `clean-code-guard: clean` after these corrections.

Remediation files (repository-relative; unrelated pre-existing work is retained):

```text
apps/web/src/services/api/api-client.ts
apps/web/src/services/api/api-client.test.ts
apps/web/src/features/employee/components/withdraw/withdrawal-form.tsx
apps/web/src/features/employee/components/withdraw/withdrawal-form.test.tsx
apps/web/src/features/employee/hooks/withdrawals.hooks.ts
apps/web/src/features/employee/hooks/withdrawals.hooks.test.tsx
apps/web/src/features/employee/hooks/withdrawal-command.hooks.test.tsx
apps/web/src/features/admin/components/withdrawals/withdrawals-screen.tsx
apps/web/src/features/admin/components/withdrawals/withdrawals-screen.test.tsx
apps/web/src/features/admin/components/withdrawals/extend-schedule-dialog.tsx
apps/web/src/features/admin/components/withdrawals/extend-schedule-dialog.test.tsx
apps/web/src/features/admin/components/withdrawals/withdrawal-row.tsx
apps/web/src/features/admin/hooks/use-withdrawal-action.ts
apps/web/src/features/admin/hooks/use-withdrawal-action.test.tsx
apps/web/e2e/withdrawals.spec.ts
specs/009-withdrawal-frontend/tasks.md
specs/009-withdrawal-frontend/quickstart.md
```

The preliminary root checkpoint was stopped during unit execution, before
integration, to restart against completed corrections; it is **incomplete**, not
a pass. A second fresh API build precedes
`output/p09-remediation-verify-final.log`. Actual final gate results follow.
T056 remains unchecked because the full browser gate failed. No extension hooks are
configured. No CONVERGE, next phase, commit, push, deployment or live transfer
was performed.

Final root checkpoint: **`pnpm verify` passed, exit 0**, in
`output/p09-remediation-verify-final.log`. All **612/612 API integration tests**
across 48 files ran fresh (4,087.21 seconds), including payout recovery, custody,
withdrawal claim/cancellation/reservation/HTTP/scheduler/settlement and wallet
projections. All **84/84 database integration tests** across ten files ran fresh.
All **1,648 unit tests** passed: web's 751 ran fresh; API's 576, contracts' 312
and database's nine reused successful Turbo results. Formatting, lint, source
types and final diff checks passed. The preceding API build was fresh
(`output/p09-remediation-api-build-final.log`); root build executed web fresh and
reused API/contracts/database builds. Build-output verification passed with
13 required entries, 828 emitted files and no test artifacts. The Prisma schema
SHA-256 remained `A9D7006A2908AAB5DBC326A1F2CD9FEB608B34739951AE5F1A56688E6FACE089`.

The first complete browser run finished with **109 passed, one timed out and two
failed** out of 112 scenarios (`output/p09-remediation-browser-full.log`, exit 1).
Scenario 79 was the unchanged P05 stale-version/proof-retention journey under
its existing 600,000ms deadline; the safe report did not identify its stalled
step. Scenario 95 was the real non-signing SQL claim fixture (`P03_API_FAILED`).
The fixture retains PostgreSQL's actual due/admission/account/destination and
Baghdad weekday guards: new dispatch is ineligible on this Saturday run. The
safe IPC report does not expose a more specific failure stage. No SQL-clock
override or financial guard bypass was introduced.

Scenario 98 failed its detail-count assertion. Source review found that the new
completion-response test's wallet-read counter could advance before terminal
detail observation; the safe report did not include the observed raw count. The
boundary now counts settlement-shaped wallet reads only when they start after
the original detail request, and waits for both that refresh and the exact
single detail read. The one-read assertion and existing 30-second bound remain.
This corrected browser test passed **three independent repetitions**, with
automatic retries still disabled (`output/p09-remediation-completion-repeat.log`,
exit 0). Its E2E type profile passed again
(`output/p09-remediation-web-e2e-types-post-test.log`, exit 0). Test-guard review
found no weakened financial or authorization assertion. No production source
changed after the root checkpoint began.

The final complete browser suite finished with **110 passed and two failed** out
of 112 scenarios (`output/p09-remediation-browser-current.log`, exit 1), serialized
after the successful root checkpoint to avoid overlapping Next.js builds.
Scenario 79 passed with its unchanged deadline; the earlier timeout's cause is
unconfirmed. All new remediation browser journeys passed, including expanded
320px controls, both stale admin drafts, account-wallet release/completion,
edited quotes, blocked acceptance and classified read feedback.

Scenario 95 again failed the real non-signing SQL-claim fixture with
`P03_API_FAILED`. Saturday is excluded by its existing Baghdad weekday guard;
the safe report still cannot confirm the exact failing fixture stage. Automatic
approval review rejected temporary instrumentation with "blocked by policy"
and provided no further reason. No diagnostic source edit was made, and no
claim guard, clock or assertion was bypassed.

Scenario 100, the existing bounded-observation acceptance journey, failed the
exhaustion-feedback visibility assertion at `withdrawals.spec.ts:934`; its read
progress assertions before that point passed. Its exact cause is unconfirmed.
The unchanged original test passed separately with exit 0
(`output/p09-remediation-bounded-diagnostic.log`), without altering its deadline,
poll budget, financial assertions or production behavior. The earlier full run
also passed this scenario. Neither isolated passes nor the root checkpoint substitute
for a passing complete browser gate. **T056 and P09 acceptance remain incomplete.**

The final masked 320px artifact was regenerated and visually inspected after
the diagnostic run cleared Playwright's output directory. Its unchanged browser
journey passed again (`output/p09-remediation-visual-final.log`, exit 0).
Final scoped Prettier checks on all 17 remediation files and `git diff --check`
passed. The Prisma schema hash above was checked again and remained unchanged.

Executed checkpoint commands were `pnpm --filter @template/api build`,
`pnpm verify`, `pnpm --filter @template/api check-types:e2e`,
`pnpm --filter @template/web check-types:e2e` and
`pnpm --filter @template/web test:e2e`. Focused unit commands used
`pnpm --filter @template/web test` with the explicit files listed in the focused
logs. Browser diagnostic commands used that package's existing `test:e2e` script,
`e2e/withdrawals.spec.ts` and `--grep` for `completion response` (with
`--repeat-each=3`), `bounded observation exhausts`, or `expanded 320px admin`.
Automatic retries remained disabled. The proposed claim-instrumentation command
was rejected before execution; it supplies no claim-stage evidence.

## T056 resumed implementation — 2026-10-10

The owner requested completion of the remaining task. The two browser failures
above remain historical failed checkpoints; the resumed checks below determine
the final task status.

The browser claim fixture now controls PostgreSQL time only after its existing
initialized/test/loopback/database-owner/known-employee/unclaimed-state checks.
It captures the original catalog function and restores it in `finally`, including
claim failures, before disconnecting the temporary restricted signer and dropping
its login. No host clock, migration, production guard or P08 fixture guard changes.
The existing admitted non-signing helper runs at three controlled instants:
before dispatch, a later Baghdad Saturday, and an eligible weekday at or after
dispatch/next-check. The first two must return false and leave the scheduled
request/version and zero attempts unchanged; the last must commit one claim.
The browser's existing readonly HTTP/UI and one-attempt assertions remain intact.
This proves guard-controlled administration state, not signing, broadcast or payment.

`createWithdrawalClaimKeyFixture` extracts the existing synthetic metadata setup
so those three checks share one retained treasury identity. The optional existing
key argument preserves other callers' original setup. Metadata contains no actual
signing material. In the first resumed focused run, all three claim checks failed
with the safe `P03_API_FAILED` report and all three polling repetitions passed
(`output/p09-t056-focused-browser.log`, exit 1 overall). Source review identified
that provisioning the same network/token/source on each check would violate its
unique constraint; the safe report did not expose the precise database error.

The polling journey now explicitly refreshes after the initial persisted-request
render, establishing a known budget before advancing browser timers. It requires
exactly 19 subsequent reads, exhaustion feedback, no more automatic reads and
one explicit restart. This removes dependence on the initial transition's observer
reset timing without increasing the production 20-read budget or any deadline.

Additional files changed in this resumption:

```text
apps/api/tests/e2e/p09-withdrawals.ts
apps/api/src/modules/withdrawals/testing/withdrawal-authority-fixtures.ts
```

`apps/web/e2e/withdrawals.spec.ts` and this evidence entry are also updated.
Test-guard and engineering/security review found no weakened financial assertion,
new automatic retry, payout credential or widened fixture/role boundary. The
shared setup extraction preserves its existing restricted-role integration callers.
Final focused browser repetitions passed **6/6**, three independent runs of
each corrected journey, with retries disabled
(`output/p09-t056-focused-browser-final.log`, exit 0). The command was
`pnpm --filter @template/web test:e2e e2e/withdrawals.spec.ts --grep 'non-signing SQL claim|bounded observation exhausts' --repeat-each=3`.
The fresh API build and final API E2E type profile passed with exit 0
(`output/p09-t056-api-build.log`, `output/p09-t056-api-e2e-types-final.log`);
the web E2E type profile passed with exit 0 (`output/p09-t056-web-e2e-types.log`).
The complete manifest-backed checkpoint passed with exit 0 in
`output/p09-t056-verify.log`; its actual results are recorded below.

The final **complete browser suite passed 112/112 scenarios, exit 0**
(`pnpm --filter @template/web test:e2e`,
`output/p09-t056-browser-full.log`). The unchanged P05 stale-version/proof journey,
both retained admin drafts, the controlled non-signing claim, expanded 320px
details/actions, account-wallet release/completion, blocked acceptance and bounded
polling all passed. No scenario was skipped and retries remained disabled. The
masked expanded 320px screenshot was regenerated by this full run and visually
inspected; keyboard access, bounded table scroll and zero page overflow passed.

After verifying test isolation and available capacity, the browser suite ran
alongside the long API integration phase. Its Next.js build and all browser
scenarios completed before the root checkpoint's final build stage, so builds
did not overlap. The earlier deferred browser waiter was stopped before it
started any test.

Final **`pnpm verify` passed, exit 0**. All **612/612 API integration tests**
across 48 files ran fresh (4,084.83 seconds), including the shared claim fixture's
existing cancellation/HTTP callers, real custody recovery, reservation, payout,
settlement, scheduler and worker-restart checks. All **84/84 database integration
tests** across ten files ran fresh (111.32 seconds). All **1,648 unit tests**
passed: API's 576 and web's 751 ran fresh; contracts' 312 and database's nine
reused successful Turbo results. Formatting, lint, source types and diff checks
passed. The root build ran API/web fresh and reused contracts/database builds.
Build-output verification found 13 required entries and 828 emitted files with
no test artifacts. The Prisma schema SHA-256 was checked again and remained
`A9D7006A2908AAB5DBC326A1F2CD9FEB608B34739951AE5F1A56688E6FACE089`.

Docs-guard review reconciled the current fixture boundary and actual fresh/cached
results with source and logs. Test-guard/security review retained real PostgreSQL
guard checks, original financial assertions, restricted-role admission, clock
restoration and disabled retries. The earlier production clean-code/React review
remains applicable: this resumption changed only test fixtures, browser coverage
and evidence, preserving the approved UI and all production financial rules.

**T056 is complete and checked in `tasks.md`; T051–T056 and all current P09
implementation tasks are complete.** The required implementation checkpoint is
green. No extension hooks are configured. CONVERGE was not run; no next phase,
commit, push, deployment or live transfer was performed. Earlier failed runs above
remain historical evidence and do not replace these final passing checkpoints.

## T057–T059 convergence remediation — 2026-10-10

Scope is P09 T057–T059 only. Both requirements checklists remain approved
(16/16 and 36/36); P08/T013 backend acceptance evidence is reused. Existing
unrelated working-tree changes and earlier task identities are preserved.

T057 retains P09 observation windows by authority, domain and normalized resource
selection. Distinct expanded details and disabled null readers cannot replace
each other's budget; identical readers share it. Backoff and completed-cycle
counts survive remount/query collection until authority retirement. P07 retains
its prior selection policy. T058 keeps the active-row predicate on later P09
history pages. T059 keeps a lost consume reply uncertain while the same pending
destination is still authoritative, then resolves a matching confirmed address.
Definitive invalid/stale proof and denied responses retain reopen guidance. The
credential is cleared before sending, and observation never replays consume.

Changed production owners are `apps/web/src/shared/query/financial-query.ts` and
`apps/web/src/features/employee/hooks/use-withdrawal-destination-link.ts`.
Existing account feedback now follows the resolved private outcome without
changing rendering, static copy, routes or dialogs. Five unit-test owners and
`apps/web/e2e/withdrawals.spec.ts` cover concurrent resources, shared identity,
rerender/remount/GC, independent exhaustion, page-two updates/pause/terminal stop,
delayed confirmation, definitive failure and credential/session retirement.
Returning to a previously visited page preserves its backoff; affected existing
tests allow that delay instead of assuming a fresh budget.

Clean-code-guard, security-best-practices and vercel-react-best-practices review
found no remaining in-scope production issue. Test-guard review uses real
QueryClients and transport/timer boundaries. No dependency, backend behavior,
financial retry or UI surface was added. Playwright review uses the established
repository runner and private-output reporter. Docs-guard checks this evidence
against actual source, manifest commands and logs.

Focused results:

- `pnpm --filter @template/web test` with the four changed unit-test paths:
  **56/56 passed**, recorded in `output/p09-t057-t059-focused.log`.
- The first full run found one additional employee history regression expecting
  immediate reselection. Its stale-page/clamping assertions remain intact, with
  time allowed for the retained window. All **13/13 employee-hook tests passed**
  fresh in `output/p09-t057-employee-regression.log`. The failed checkpoint is
  retained as `output/p09-t059-verify-first.log`; the complete checkpoint was
  restarted after this test-only correction.
- Targeted web ESLint, source type check, both API/web `check-types:e2e`
  profiles and `pnpm --filter @template/api build`: **passed**. Profile/build
  records are `output/p09-t059-api-e2e-types.log`,
  `output/p09-t059-web-e2e-types.log` and `output/p09-t059-api-build.log`.
- `pnpm --filter @template/web test:e2e --grep 'P09 convergence'`:
  **3/3 passed**, `P03-RUN passed`, recorded in
  `output/p09-t057-t059-browser-focused.log`. Admin multi-resource/pagination
  cases explicitly use validated response-boundary fixtures derived from real
  authenticated harness responses; they prove presentation/observation, not
  additional financial effects. The delayed consume case loses the browser
  response before executing the real harness consume, observes PENDING, then
  executes that one controlled request and observes CONFIRMED without browser
  replay. This is controlled response ordering, not live-provider confirmation.

The full web `test:e2e` suite passed fresh: **115/115 scenarios**, `P03-RUN
passed`, exit 0, recorded in `output/p09-t059-browser-full.log`. The masked
`output/playwright/p03/p09-remediation-expanded-320.png` was visually inspected:
expanded details stay within the horizontal table container, the focused refresh
control is visible, and private values remain masked. Routes, rendering, static
copy and approved dialogs are preserved.

The restarted complete `pnpm verify` checkpoint **passed, exit 0**, recorded in
`output/p09-t059-verify.log`. It ran all **756 web unit tests fresh**, **84
database integration tests fresh** (10 files, 156.45 seconds) and **612 API
integration tests fresh** (48 files, 3905.03 seconds). Its other **897 unit
tests** (API 576, contracts 312, database 9) reused successful Turbo records:
**1,653 total unit tests passed**, with fresh/cached boundaries stated here.
Formatting, lint, source types, schema validation/generation and diff checks
passed. The root build ran web fresh and reused API/contracts/database builds;
the separate API build above was fresh. Build-output verification found all 13
required entries and 828 emitted files without test artifacts. Both E2E type
profiles and the full browser suite passed as recorded above. No required check
remains unrun. Prisma schema SHA-256 after the final checkpoint remains
`A9D7006A2908AAB5DBC326A1F2CD9FEB608B34739951AE5F1A56688E6FACE089`.

Final docs-guard/test-guard review reconciled the initial failed timing assertion,
the corrected employee regression, actual cache boundaries and response fixtures
with the source and logs. The code/security/React review remains applicable:
subsequent changes were only the test timing allowance and evidence. Final
evidence/task formatting and `git diff --check` passed after recording results.

**T057–T059 are complete and checked; all 59 P09 implementation tasks are
complete, and the required P09 implementation checkpoint is green.** There are
no extension hooks configured. No CONVERGE, next phase, commit, push, deployment
or live transfer was performed. Prior P08/T013 live-provider acceptance is reused;
this remediation adds no new live-provider claim.

## T060 later destination-proof invalidation — 2026-10-10

Scope is P09/T060 only. The private destination-link attempt now retains the
reviewed non-secret version. Immediate fallback and later current-authority reads
use the same outcome classification: unchanged valid PENDING retains uncertainty,
matching CONFIRMED resolves success, and server-proven expiry or changed proof
generation/address/network resolves the existing latest-email guidance. The
confirmation observer stops after that resolution. Parsed responses, attempt and
actor identity, cancellation, private credential disposal and explicit one-shot
consume remain enforced. No presentation or backend behavior changed.

The new hook/account cases initially failed four assertions against the old
behavior (`output/p09-t060-red.log`). The final focused hook/account/shared-query
run passed **56 tests in three files** (`output/p09-t060-focused.log`). It covers
later expiry and supersession, no further confirmation reads after resolution,
one consume and no retained credential. Transient and malformed reads retain
uncertainty; malformed-contract observation resumes only through the existing
explicit safe refresh. An intermediate test incorrectly expected automatic
resume after a malformed response; its correction preserves the shared observer's
contract-failure stop policy. Existing delayed-confirmation and actor-retirement
coverage remains passing.

Both final focused Chromium scenarios passed
(`output/p09-t060-browser-focused-final.log`). They run the real Next/API/database
harness, abort the consume before execution, observe initial valid PENDING, then
change only the later destination-read response to EXPIRED or a newer pending
generation. These are **response boundary fixtures**, not real expiry/resend or
provider acceptance evidence. Persisted destination remains unconfirmed, exactly
one consume is attempted, latest-email guidance replaces uncertainty, private
link retention checks pass, and unexpected browser/API errors fail the test.
Only the intentionally aborted consume's `net::ERR_FAILED` console entry is
allowed. An earlier browser iteration raced an automatically removed refresh
button; the final assertions await automatic reconciliation. A subsequent run
had one API harness startup failure; the clean paired retry and final run passed.

The fresh API build passed (`output/p09-t060-api-build.log`). Both API/web E2E type
profiles passed (`output/p09-t060-api-types-e2e.log`,
`output/p09-t060-web-types-e2e-final.log`); final browser-file ESLint also passed
(`output/p09-t060-final-browser-lint.log`). Code/security/React/test review found
no remaining issues in this change; clean-code-guard: clean. Docs-guard verifies
these claims against the implementation and recorded logs.

The complete `pnpm verify` passed (`output/p09-t060-verify.log`, exit 0):
**1,657 unit tests** passed, comprising **760 fresh web tests** and **897 cached
API/contracts/database tests** (576/312/9). Both integration profiles bypassed
cache: **612 API tests in 48 files** passed in 4042.55 seconds, and **84 database
tests in 10 files** passed in 152.68 seconds. Formatting, lint, source types,
schema validation/generation and diff checks passed. The final browser-console
assertions were added after aggregate lint began; their explicit final ESLint
and E2E type checks passed as recorded above. Final root build ran web fresh and
reused API/contracts/database builds; the separate API build was fresh.
Build-output verification found all **13 required entries and 828 emitted files**
without test artifacts.

The full fresh Chromium suite passed **117 scenarios**, with no retries configured
(`output/p09-t060-browser-full.log`, exit 0). No required T060 check remains unrun.
Prisma schema SHA-256 remains
`A9D7006A2908AAB5DBC326A1F2CD9FEB608B34739951AE5F1A56688E6FACE089`.
Final docs/test review reconciled the actual failures, corrections, response
fixtures and fresh/cache boundaries with the implementation and logs. Final
evidence/task formatting and `git diff --check` passed after recording results.

**T060 is complete and checked; all 60 P09 implementation tasks are complete.**
No extension hooks are configured. No CONVERGE, next phase, commit, push,
deployment or live transfer was performed during this implementation. Prior
P08/T013 live-provider acceptance is reused; this change adds no live-provider
claim.

## T061–T062 route draft retention and readiness wording — 2026-10-10

Scope is P09/T061–T062 only. The employee route enables the existing concealed
state-preservation guard only for `/employee/withdraw`; the admin route adds
`/admin/withdrawals` alongside its existing task-editor case. The destination
link boundary remains outside the employee guard. Admin dialog keys retain their
actor/epoch/target owner while current permission is temporarily unavailable;
definitive detail denial, a readonly target, a committed outcome or authority
retirement clears selection and discards the private draft. No draft is stored
in browser storage. Protected content stays hidden during checks and transient
errors; existing handlers still require current authority and fresh server facts.
An employee quote from an older check cannot reopen its confirmation sheet.
Admin version changes require the existing explicit new-version review before
another explicit confirmation. The bounded observation policy is unchanged.

GET `/withdrawals/me` documentation now describes configured payout capability,
current API boot/generation admission, financial-write fencing and dispatch pause.
It distinguishes employee eligibility and accepted-request reads from signer
liveness or immediate payment. This is a description-only API change, checked
against `withdrawal-readiness.ts`, `withdrawals.service.ts` and
`custody/runtime-control.ts`; schemas and financial behavior are unchanged.

The valid pre-fix route regression failed all three cases
(`output/p09-t061-red.log`). The focused auth/withdrawal/query/transport run passed
**332 tests in 21 files** (`output/p09-t061-focused-web.log`). After extending the
three actual-parent route cases with a new actor and definitive denial, all three
passed (`output/p09-t061-route.log`). The final admin-selection review cleanup
passed all **16 screen tests** (`output/p09-t061-admin-final.log`). These tests use
the actual employee layout and admin route boundary with API-boundary fixtures;
only framework navigation is mocked. An initial test assertion incorrectly used
`not.toBeVisible()` on null, and an admin denial fixture initially used an invalid
role/status combination; both were corrected before the final passing run.
Employee recovery waits for existing bounded read backoff rather than changing
or replenishing that budget.

The focused OpenAPI suite passed **15 tests**
(`output/p09-t062-openapi.log`), and a fresh API build passed
(`output/p09-t062-api-build.log`). API and web E2E type profiles passed
(`output/p09-t062-api-e2e-types.log`, `output/p09-t061-web-e2e-types.log`).
Code/security/React review keeps retention opt-in and private to the existing
actor/target, with no command replay, credential retention or presentation change.
Test/docs review checks the real compositions and source-backed wording.

The first focused browser iteration reached employee draft recovery and fresh
review, then incorrectly required the explicit fresh quote to leave the quote
count unchanged. Its assertion now permits exactly that one new quote while
requiring every other persisted financial fact to remain unchanged. Session 503
responses are deliberate response-boundary fixtures; focus/online events run
through the real browser, protected routes and API/database harness. They are
not live provider or signer acceptance evidence.

All three corrected focused Chromium journeys passed
(`output/p09-t061-browser-focused-final.log`, exit 0). Admin departure assertions
initially navigated again before the intermediate authenticated shell restored;
the final journeys wait for that shell before returning. They preserve employee
amount and administrator hours/reason through checks and transient failures,
conceal protected controls, discard obsolete employee confirmation, require an
explicit fresh employee quote or admin version review, and send no browser
withdrawal command. Persisted state permits only the deliberately requested
fresh quote and external admin extension. New-document departure restores default
drafts, and browser storage contains no raw draft. Existing authority-revocation,
account-switch and destination-proof regressions remain part of the full suite.
Final targeted source/test/browser ESLint passed
(`output/p09-t061-final-lint.log`); its earlier whole-web iteration identified
test-only unsafe storage typing and a deferred generic, which were corrected.
The final web E2E type profile passed
(`output/p09-t061-web-e2e-types-final.log`).

The full fresh Chromium suite passed **120 scenarios**, with no retries configured
(`output/p09-t062-browser-full.log`, exit 0). This includes the three new route
journeys and existing denial/switch, destination-proof, bounded-observation and
approved phone/desktop UI checks. Route preservation adds no visible shell markup,
copy, styles or controls; the approved dialogs and feedback surfaces are reused.

**Initial checkpoint: T061 is complete; its implementation, focused regressions and required reviews
passed. T062 wording is corrected, but T062 and P09 remain incomplete because
the mandatory full `pnpm verify` checkpoint failed.**

The first complete `pnpm verify` attempt failed
(`output/p09-t062-verify.log`, exit 1). Formatting, lint, source types and all
**1,660 unit tests** passed: **763 web and 576 API tests ran fresh**, while
**312 contract and nine database unit tests were cached**. Database integration
passed **84 tests in 10 files**, fresh, in 173.14 seconds. API integration ran all
**612 tests in 48 files**, fresh, in 4084.43 seconds: **611 passed and one failed**.
The unchanged Linux multipart decoder fixture reached its 150-second supervised
process deadline with a null exit code and empty diagnostics. The aggregate
therefore did not reach its final build/output/diff stages; those are not claimed
as passed by the aggregate. No timeout, fixture assertion or production decoder
behavior has been weakened.

The first isolated unchanged decoder rerun also failed at the same deadline
(`output/p09-t062-decoder-recheck.log`, one pass/one failure, exit 1). Inspection
of that owned fixture container showed `npm install` still running before decoder
execution. Direct registry probes succeeded but were slow: Docker fetched the
304,458-byte abbreviated sharp metadata in 18.98 seconds, while a host request
timed out after 25 seconds with HTTP 200 and only 143,468 bytes downloaded. These
observations identify slow dependency acquisition; they do not establish a decoder
assertion failure or the underlying network cause. The second unchanged isolated
rerun also failed at the same deadline
(`output/p09-t062-decoder-recheck-final.log`, one pass/one failure, exit 1).
A further aggregate retry was not run while dependency setup remained blocked.
The failing fixture belongs to earlier proof-decoder coverage and was not changed
in this task scope; a passing aggregate remains required to complete T062/P09.

The previously skipped build stages were executed separately and passed:
`pnpm build` ran API and web builds fresh and reused contract/database build cache
(`output/p09-t062-build.log`, exit 0). `pnpm verify:build-output` found all **13
required entries and 828 emitted files** without test artifacts
(`output/p09-t062-build-output.log`, exit 0); `git diff --check` also passed. These
separate passes do not change the failed aggregate result or complete its gate.

### Owner-requested verification recovery — 2026-10-10

The owner requested rerunning the required tests and fixing any failure. Before
any fix, the unchanged decoder suite passed both cases
(`output/p09-t062-decoder-resume.log`, exit 0, 23.36 seconds of test execution).
This supports the earlier diagnosis of registry-dependent fixture provisioning,
rather than a decoder assertion defect. The decoder fixture now follows
`testing/linux-proof-runtime.ts`: mount the existing
`oscar-p05-e2e-npm-cache` volume and use `npm install --prefer-offline`.
Only public package cache data is shared; application files, containers and
acceptance state remain isolated. Exact direct dependency pins, all decoder
assertions, the 150-second process deadline and 180-second test timeout are
unchanged. Cold caches still require registry access; no assertion bypass or
timeout increase was added.

After this fixture correction, both decoder cases passed again
(`output/p09-t062-decoder-cache.log`, exit 0, 13.92 seconds of test execution).
A separate disposable container with `--network none` installed the same pinned
packages with `npm install --offline` successfully
(`output/p09-t062-decoder-offline-cache.log`, exit 0), confirming the available
cache can provision them without registry access. Test-guard review found no
weakened assertion or internal mock; docs-guard checked these claims against the
fixture, the existing Linux proof helper and the captured results.

A fresh standalone API build passed
(`output/p09-t062-resume-api-build.log`, exit 0). Both API and web E2E type
profiles passed again (`output/p09-t062-resume-api-e2e-types.log` and
`output/p09-t062-resume-web-e2e-types.log`, exit 0). The new complete aggregate
attempt passed (`output/p09-t062-verify-resume.log`, exit 0). The full 120-scenario browser pass recorded above is retained
as existing execution evidence for the unchanged application code. It is not
claimed as a new browser run during this recovery: only the decoder test fixture
and execution evidence changed after that browser pass.

The recovered full `pnpm verify` checkpoint passed every stage: Prisma
format/validate/generate, repository formatting, lint, source types, units,
integration, build, build-output verification and `git diff --check`. All **1,660
unit tests** passed: **576 API tests ran fresh**, while **763 web, 312 contract
and nine database unit tests** reused successful Turbo results. Both integration
suites executed fresh: **84 database tests in 10 files** (134.02 seconds) and
**612 API tests in 48 files** (3271.79 seconds), including both decoder cases
(15.824 seconds). The final aggregate API build ran fresh; web, contracts and
database builds reused cache. Build-output verification again found **13 required
entries and 828 emitted files** without test artifacts.

This successful aggregate supersedes the initial failed aggregate as the current
T062 checkpoint. Together with the fresh API build, both repeated E2E type checks
and the retained complete 120-scenario browser pass for the same application
code, it completes T062. T061 and T062 are now marked complete; no implementation
task in this selected batch remains open. No CONVERGE, next phase, deployment or
real-funds action was executed. The Prisma schema and both requirements
checklists retain their prior SHA-256 hashes. No extension hooks are configured
(`.specify/extensions.yml` absent at the final check).

## T063–T065 remediation checkpoint — October 11, 2026

T063 separates P09 display snapshots from current-check query data. Only validated
successful reads populate the actor/role/epoch/domain/normalized-selection snapshot
in the existing QueryClient. Snapshots survive source-query GC and ordinary
same-actor checks without replenishing the 20-cycle observation budget. Authority
checks conceal the snapshot; denial clears it and authority retirement removes
P09 cache entries. Disabled or different selections cannot display another
resource's facts. Employee/admin screens use retained facts for presentation and
existing inline feedback/manual refresh; quote, destination and admin command
review still require current-check data. No command replay was added.

T064 adds the reachable `503 WITHDRAWAL_UNAVAILABLE` response to
`POST /withdrawals`, using the existing `ErrorEnvelope`. Docs-guard checked the
response against `withdrawal-reservation.service.ts`, `withdrawals.errors.ts` and
the actual OpenAPI response map. No endpoint, schema or financial behavior changed.

T065 removes the unused employee withdrawal request/reservation/reversal demo
constructors, their orphaned fee/date helpers and the obsolete two-decimal fee
test. Caller searches under `apps/` and `packages/` found no remaining references.
The five approved package-income assertions and unrelated calculations remain.

Focused execution evidence:

- `output/p09-t063-hooks.log`: 46 tests in three shared/employee/admin query files
  passed with real QueryClients and HTTP-boundary fixtures.
- `output/p09-t063-t065-focused-web.log`: 151 tests in 14 files passed, covering
  shared observation, session/withdrawal owners, employee/admin components,
  employee context/account and preserved package arithmetic.
- `output/p09-t064-openapi.log`: all 15 OpenAPI tests passed, including the
  acceptance 503 response and shared error-envelope reference.
- `output/p09-t063-browser.log`: the protected-route bounded-observation scenario
  passed against the real API and production Next build. After exhaustion, real
  focus-triggered session revalidation preserved the request facts, retained the
  stopped feedback and made no additional withdrawal read; explicit refresh
  recovered. The persisted request/accounting state remained unchanged.
- `output/p09-t065-api-build.log`: fresh standalone API build passed.
- `output/p09-t065-types.log`, `output/p09-t065-web-e2e-types.log` and
  `output/p09-t065-api-e2e-types.log`: source web types and both E2E profiles passed.

The new shared regression setup initially used an out-of-scope test helper and
did not settle the initial observation count before advancing fake timers; both
setup issues were corrected and the regression passed. The initial source-type run caught an unsupported Testing
Library option and an unnarrowed list observation return type; both were corrected
before the successful repeated check. These failed attempts are not passing evidence.

Clean-code-guard, test-guard, security and React reviews checked the bounded
snapshot owner, current-data command guards, hidden/denied/retired scopes, fixed
hook order, HTTP-boundary test fixtures and unchanged P07 observation behavior.
No unresolved finding remains in these corrections. T063 and T064 are complete.
At this initial checkpoint, the aggregate and browser runs were still running; T065 remained
unchecked until the required results are recorded below.

### Browser checkpoint recovery

The initial full browser attempt (`output/p09-t065-browser-full.log`) failed in
the existing P05 late-preview scenario at its Escape-close assertion. It was
stopped after 84 scenarios: 83 passed, one failed and 36 were not run in that
attempt. These are not a passing full-browser gate.

The test in `apps/web/e2e/tasks-codes-and-review.spec.ts` now waits for the
focusable review panel before pressing Escape, rather than treating an image
request starting as keyboard readiness. Its held response is released in
`finally`, including on assertion failure. The dialog-close, focus-restoration,
late-byte and retention assertions remain; no product behavior, timeout or retry
count changed. An initial recovery assertion incorrectly targeted the outer
dialog wrapper and failed; the selector was corrected to its existing focusable
panel. The focused scenario then passed
(`output/p09-t065-browser-preview-recovery-final.log`, exit 0).

Browser recovery runs use a source copy under the ignored
`output/playwright/p03/p09-t065-browser-copy/` directory to separate Next build
outputs from the concurrent aggregate checkpoint. All 985 copied source files
match the working tree; the only configuration adjustment relocates Turbopack's
build root to the original dependency workspace
(`output/p09-t065-source-copy-verification.log`). The installed dependencies and
emitted API/contracts/database artifacts are reused without installing or
changing package versions. The copied pnpm invocation sets
`pnpm_config_verify_deps_before_run=false` solely to prevent pnpm from trying to
purge the shared dependency junctions. Initial launches were refused by pnpm's
noninteractive purge safeguard before tests ran; no install was approved.

Test-guard checked the readiness assertion and guaranteed route cleanup. The
preview test lint and web E2E type profile passed after the first correction
(`output/p09-t065-preview-lint.log`,
`output/p09-t065-web-e2e-types-final.log`). Final lint/types and a new full
120-scenario browser run were then checked against the corrected panel selector;
`output/p09-t065-browser-full-recovery.log` records that recovery attempt. Its
failure and the subsequent correction are recorded below.

The complete `pnpm verify` run passed (`output/p09-t065-verify.log`, exit 0):
Prisma format/validate/generate, repository formatting, lint, source types,
units, integration, builds, build-output verification and `git diff --check`.
All **1,661 unit tests** passed: **576 API and 764 web tests ran fresh**; **312
contract and nine database tests** reused successful Turbo results. Both
integration suites ran fresh: **612 API tests in 48 files** and **84 database
tests in 10 files**. API and web builds ran fresh; contracts/database builds
reused cache. Build-output verification found **13 required entries and 828
emitted files**, with no test artifacts. A PostgreSQL client deprecation warning
was nonfatal. The later preview-test correction also passed its final targeted
lint and web E2E type checks (`output/p09-t065-preview-lint-final.log` and
`output/p09-t065-web-e2e-types-panel.log`). This aggregate pass preceded the
retained-history correction below.

### Retained-history error feedback correction

The browser recovery run exposed a missed T063 error-feedback path: once a valid
admin page was retained, a later malformed/unavailable read displayed stale facts
but hid the detailed safe error. Its existing browser assertion failed at the
error message. T063 was reopened while correcting that path. The prior aggregate
pass remains recorded above, but is not the final checkpoint for the changed
frontend source.

The admin screen now renders the existing `TaskQueryState` error feedback beside
the retained table. The browser case keeps its exact malformed/unavailable error
assertions and replaces its obsolete disappearing-table expectation with
retained exact terms and disabled rejection/extension controls; successful
explicit refresh restores those controls. No error assertion, timeout or retry
was weakened.

The new real-QueryClient component regression first failed on the missing message
(`output/p09-t063-retained-error-red.log`), then all 18 admin withdrawal component
tests passed (`output/p09-t063-retained-error-green.log`). Targeted lint and both
E2E type profiles passed (`output/p09-t063-retained-error-lint.log`,
`output/p09-t065-final-api-e2e-types.log`,
`output/p09-t065-final-web-e2e-types.log`). Clean-code-guard, security, React and
test-guard reviews checked safe error rendering, retained display-only facts,
disabled commands and explicit refresh recovery. A new standalone API build
passed (`output/p09-t065-final-api-build.log`). The next aggregate attempt is
recorded in `output/p09-t065-final-verify.log`; its unit failure and recovery are
recorded below. T063 was then completed after its focused browser checks.

The preceding full browser recovery finished with **119 passed and one failed**;
the sole failure was the retained-history error-feedback case above. On the
corrected source, both focused browser cases passed
(`output/p09-t063-final-browser-focused.log`): malformed/unavailable admin reads
retain exact facts with safe errors and disabled actions, and exhausted status
survives real same-actor revalidation without implicit reads until manual refresh.
All 985 isolated source files were checked again with zero mismatches
(`output/p09-t065-final-source-copy-verification.log`). T063 is complete again.
The next full browser attempt is recorded in `output/p09-t065-browser-final.log`;
its early interruption for the final readiness assertions is recorded below.

### Final checkpoint restart

The next aggregate attempt (`output/p09-t065-final-verify.log`) stopped in web
units: the unchanged wallet reservation-sheet test exceeded its existing
one-second query wait. It finished with 764 passing web tests and one failure;
integration and builds did not run in that attempt. All three wallet tests then
passed unchanged in isolation (`output/p09-t065-wallet-unit-recovery.log`). No
wallet source, assertion or timeout was changed. Concurrent browser build startup
is a possible load contributor, not an established cause.

The subsequent browser attempt (`output/p09-t065-browser-final.log`) was stopped
after 22 passing scenarios to freeze the final browser assertion: successful
explicit admin refresh must re-enable rejection and extension controls, rather
than merely leave already-retained text visible. The web E2E type profile passed
again. The complete browser restart is recorded in
`output/p09-t065-browser-final-resume.log`; the aggregate restart waited until
browser build startup finished. Test-guard reviewed these observable readiness assertions
without adding mocks, retries or relaxed timeouts. These partial attempts do not
complete T065.

The final complete browser restart passed **all 120 scenarios**, with
`P03-RUN passed` and exit 0 (`output/p09-t065-browser-final-resume.log`). Both the
preview readiness regression and retained-history error/refresh assertions passed.
The isolated copy's 985 source fingerprints matched again with zero mismatches
(`output/p09-t065-final-source-copy-verification.log`). The database schema and
both requirements approval checklists retain their pre-implementation hashes.
The final aggregate restart **passed**, exit 0
(`output/p09-t065-final-verify-resume.log`): Prisma format/validate/generate,
repository formatting, lint, source types, units, integration, builds,
build-output verification and `git diff --check`. All **1,662 unit tests** passed:
**765 web tests ran fresh**, while **576 API, 312 contract and nine database
tests** reused successful Turbo results. Both integration suites ran fresh:
**612 API tests in 48 files** (3,892.60 seconds) and **84 database tests in 10
files**. The web build ran fresh; API/contracts/database aggregate builds reused
cache. The separate fresh API build passed earlier on the same production source
(`output/p09-t065-final-api-build.log`). Build-output verification found **13
required entries and 828 emitted files**, with no test artifacts. The PostgreSQL
client deprecation warning was nonfatal. Both API/web E2E type profiles passed as
recorded above; the web profile was repeated after the final browser assertions.

**T063–T065 are complete.** Failed and interrupted attempts remain documented
above; no required task checkpoint gate is failed or unrun. Docs-guard checked
these final counts and fresh/cache distinctions against the actual logs and
manifest scripts. Requirements approval markers, feature selection and unrelated
working-tree edits were preserved. No CONVERGE rerun, next phase, commit, push,
deployment or live transfer was performed. This completes the requested task
batch, without asserting P11 launch readiness.
