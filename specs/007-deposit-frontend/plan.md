# Implementation Plan: P07 - Deposit Frontend

**Branch**: `007-deposit-frontend` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P07 - Deposit Frontend

**Feature Directory**: `specs/007-deposit-frontend` (verified against the active pointer/spec)

**Input**: Clarified specification and delegated decisions C1–C3. Execute PLAN only under [the operating contract](../../docs/workflow/speckit-prompts.txt). Internal gates below are not additional roadmap phases or implementation authority.

## Summary

Wire existing employee/admin deposit screens to accepted P06 receiving instructions, detection, persisted history and audited manual credits. Preserve exact amounts, current authority, account isolation, ready-only QR/copy and one retained identity for an uncertain grant. Reuse existing feature adapters/hooks, private transport, query scopes, confirmation and feedback.

C3 admits one small ADMIN-only paginated employee-target lookup, including first-credit employees. Test it before dependent frontend work. C1/C2 permit only specified obsolete deposit copy/status corrections and runtime placement in existing surfaces. No route, popup, redesign, financial policy or custody behavior is added.

Decisions: [research](research.md). Boundaries: [data model](data-model.md), [HTTP](contracts/http.md), [UI integration](contracts/ui-integration.md). Future validation: [quickstart](quickstart.md). All implementation below is proposed.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node `>=24 <25`, pnpm `>=11 <12` (packageManager 11.17.0), verified manifests.

**Primary Dependencies**: Next 16.3.6/App Router, React 19.2.8, Query 5.101.4, Axios 1.19.0, Zod 4.4.3, qrcode.react `^4.2.0`, existing Cairo/Tailwind/Radix; Express 5.2.1, Prisma 7.9.1 and existing P06 services. Owner decision on 2026-10-07 permits the test-only `jsqr` 1.4.0 dependency and its lockfile entry for independent rendered-image decoding.

**Storage**: Existing PostgreSQL User/Wallet and custody/deposit/ledger/audit records. Lookup requires no migration. Browser storage holds only a validated actor-scoped original-action handle; full reviewed payload stays in memory.

**Testing**: Vitest 4.1.10, Testing Library 16.3.2, Playwright 1.63.0, migrated PostgreSQL 18.4/Docker and private E2E IPC. Browser runner builds Next and uses Chromium/one worker/no retries. P05 regression also requires Linux Node 24 Docker. Owner decision on 2026-10-07 replaces separate-phone QR scanning with independent decoding of rendered screenshot pixels for both accounts, before/after reload, compared with API, visible and copied addresses at all four acceptance widths.

**Target Platform**: Existing desktop/phone Arabic RTL web and Node 24 API. P06 protected signer/recovery/worker boundaries are reused. No services or deployment started by PLAN.

**Project Type**: Existing monorepo; two feature API/hook integrations, one admin-module read extension and bounded shared/test-support changes.

**Performance Goals**: API pages default 25/max 100; UI admin history 10, employee history/targets 25. Retain one current page plus at most one selected identity. Relevant GET delays 5/10/20/30/60 seconds, capped at 20 completed automatic observations including failures. No infinite polling/list accumulation or chain-latency promise.

**Constraints**: Exact canonical USDT strings/server micro-USDT arithmetic; current session/role/ownership; no optimistic credit/local balance/audit, commercial deposit limit/hold/approval/rejection, raw provider errors or guessed explorer. Preserve App Router/private transport/P04–P05 defaults and frozen UI outside C1/C2.

**Scale/Scope**: Approved MVP/P07 only. P10 employee CRUD/detail/audit/dashboard/settings, P08/P09 withdrawal, P11 release and P06 financial/custody redesign remain excluded.

## Constitution Check

_Before research and after design: constitution 1.0.0. PASS describes design compliance; implementation acceptance is open._

| Principle                       | Before research                                                                               | After design and evidence                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I — Scope/evidence              | PASS: P07 pointer/spec/branch and working tree verified; whole roadmap/guides read.           | PASS: existing/proposed facts separated; only plan-owned files. Spec/checklist/pointer/roadmap unchanged.                                                                                        |
| II — Frontend preservation      | PASS: C1/C2 resolve bounded deposit conflicts.                                                | PASS: existing regions/shared controls only. Admin sign-in exists in current source; historical missing-screen warning is not a current P07 route gap. Constitution/prompt text stays unchanged. |
| III — Ownership/design          | PASS: actual owners/manifests/patterns inspected.                                             | PASS: shared lookup contract, existing admin read boundary, focused adapters/hooks/runtime; no migration/dependency/generic platform.                                                            |
| IV — Backend prerequisites      | PASS for planning: P01–P05 foundations/P06 recorded acceptance reused; missing C3 identified. | PASS for ordering: G1 requires tested lookup/backend/harness before dependent integration. Future gate OPEN; superseded separate CONVERGE prerequisite not reinstated.                           |
| V — Financial/custody integrity | PASS: P06 ledger/idempotency/recovery authoritative.                                          | PASS: exact amounts, chain/manual separation, no timer credit, original action/404 uncertainty and live refetch. Withdrawals/signing/reservations unchanged; affected regressions retained.      |
| VI — Authority/protection       | PASS: current identity/role/ownership and secret boundaries apply.                            | PASS: transactional lookup authority, scope retirement/safe errors/CSRF, no automatic write replay. Single-admin/no-2FA/no-dual-approval risks retained.                                         |
| VII — Verification              | PASS: real commands/harnesses and compatibility gaps identified.                              | PASS: actual test paths, DB/browser/device/full checkpoint defined. No implementation/app-test/startup pass claimed.                                                                             |

No principle is waived. Later implementation applies the engineering guides and applicable clean-code-guard, test-guard, security-best-practices, vercel-react-best-practices, playwright and docs-guard. PLAN applies docs-guard to its documents; research inspected installed framework guidance.

## Project Structure

### Documentation (this feature)

```text
specs/007-deposit-frontend/
  spec.md                         # existing; read-only
  checklists/requirements.md      # existing; read-only
  plan.md
  research.md
  data-model.md
  contracts/http.md
  contracts/ui-integration.md
  quickstart.md
```

No tasks.md/additional checklist is generated.

### Source Code (repository root)

| Responsibility          | Existing owner to extend                                                                                                                                                      | Proposed files                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Lookup contracts        | `packages/contracts/src/admin/admin.schema.ts`, `index.ts`, `admin/admin.schema.test.ts`                                                                                      | None; existing exports/tests.                                                                                              |
| Lookup API              | `apps/api/src/modules/admins/admins.{routes,controller,service,mapper}.ts`, `apps/api/src/infrastructure/openapi/openapi.ts`                                                  | `apps/api/src/modules/admins/manual-credit-targets.integration.test.ts`                                                    |
| Employee deposits       | `apps/web/src/features/employee/components/deposit/deposit-card.tsx`; existing address-qr/screen wrapper as needed                                                            | `features/employee/api/deposits.api.ts`, `hooks/deposits.hooks.ts`, colocated API/hook/card tests                          |
| Admin deposits          | `apps/web/src/features/admin/components/deposits/deposits-screen.tsx`; existing confirmation/select/pagination                                                                | `features/admin/api/deposits.api.ts`, `hooks/deposits.hooks.ts`, `utils/manual-credit-command-runtime.ts`, colocated tests |
| Shared private boundary | `apps/web/src/shared/query/financial-query.ts`, `services/api/{api-client,safe-error}.ts`, employee `components/common/copy-action.tsx`, existing exact-money/Baghdad helpers | Focused safe-error/copy tests if needed; extend affected current tests.                                                    |
| E2E support             | `apps/api/tests/e2e/{server,control,p04-finance}.ts`, existing P05 funding callers, guarded fixture admission/funding owners, `apps/web/e2e/support/fixtures.ts`              | `apps/api/tests/e2e/p07-deposits.ts`, `apps/web/e2e/deposits.spec.ts`                                                      |

Web feature-relative paths are under `apps/web/src/`. No database migration/route/layout/P10 employee-deposit-tab work. Stop fixture/local-grant authority in these two screens; preserve unrelated fixture providers.

## Delivery Gates and Architecture

Internal batches for future task generation; no task IDs or execution authority.

### G1 — Backend prerequisite and deterministic support

Deliver the [minimal lookup](contracts/http.md) using `AdminsService.read`, current session locking/ADMIN checks, strict snapshot list/count and USER-with-wallet predicate. No added eligibility policy; execution still revalidates grant actor/target.

Repair isolated E2E metadata/admission: register/acknowledge a guarded known-clean disposable API boot before custody fixtures; pass admission through app/P04/P05 callers; inject public Nile metadata/deterministic providers. Preserve integration-only fixture guard, production fail-closed default and negative cases. No HTTP fixtures/inherited live secrets.

**Exit evidence**: strict contracts/migrated-DB lookup tests; affected admin/session/deposit/manual/fence regressions; isolated ready/nonready/history/grant flows and retained P04/P05 financial assertions. Dependent frontend waits.

### G2 — Shared private reads and original-action runtime

Add required P07 query namespace/options/retirement cleanup; classify deposit/target GETs as private. Preserve CSRF/safe errors/auth renewal/denial. Writes have no automatic retry. Runtime-validate success; reject obsolete completions before state/cache mutation. Same-scope accepted rows can survive transient refresh errors visibly; denied/retired data disappears.

Persist/read back one actor-scoped handle before grant dispatch under Web Lock/storage notifications. Freeze actual employee/amount/reason/reference at confirmation. Unknown outcome triggers GET only; 404/conflict/malformed/network failure cannot authorize replacement. No cancel/clear escape or new protocol. See [UI contract](contracts/ui-integration.md).

**Exit evidence**: scoped stale/denied/malformed reads, bounded nonoverlapping polling, lock/storage failure, duplicate clicks/tabs and original-action recovery; P04/P05 defaults intact.

### G3 — Employee instructions/history

GET address/history independently after USER admission. Validated UNASSIGNED permits one guarded POST outside query retries; parse 200 READY/202 nonready. Lost reply means GET. Only READY exposes address/QR/copy. Detection health stays separate from history; manual rows have no chain fields. Reuse exact money/explicit Baghdad formatting.

Use C2's existing regions/feedback/navigation for readiness/errors/empty/manual/copy failure. Correct only C1's obsolete demo/minimum/approval/rejection text. Await clipboard success; retain full inspectable LTR address on failure.

**Exit evidence**: first entry/nonready/unavailable/malformed, two-account reload/retirement, exact replay/manual history and clipboard refusal pass. Timers never credit.

### G4 — Admin history/choices/grant

Wire existing search/pagination/history-kind filter. Load one 25-target page while the form is relevant; reuse AdminSelect/AdminPagination. Keep at most one selected ID/name/email option across paging; distinguish duplicate names. Lookup failure disables review/submit with safe feedback and keeps draft. Optional API q needs no new search control.

Canonical amount string replaces float/cent-step authority. Existing async confirmation reviews employee/full amount/reason/external reference and guards pending/close/reset. Valid committed outcome clears matching handle and refetches P07 history/P04 wallet-finance. Historical `walletAfter` never overwrites live wallet. Remove fake TxID/local balance/audit/global reference-dedup authority.

**Exit evidence**: first-credit/multiple-page targets, exact 1.000001, invalid input, duplicate submit, same reference on distinct actions, committed reply loss/reload/original GET and uncertain 404. Denial blocks handlers until newer authority.

### G5 — Browser preservation and full checkpoint

Run [quickstart](quickstart.md)'s focused browser/DB, shared regressions and full P07 checks. Inspect desktop/390px/430px, with focused 320px address/table/confirmation: Cairo/RTL/LTR, focus/keyboard, bottom-navigation clearance, no overflow/clipping/console or privileged employee requests. Independently decode rendered QR screenshot pixels; compare decoded/API/visible/copied values for both accounts before/after reload at 320/390/430/1280px.

**Exit evidence**: automated files/runs, required services, root regression/separate E2E type profiles/full browser suite and independent QR/preservation records. Missing evidence stays open. No P08/deployment/funds authorization follows.

## Verification Strategy

| Boundary      | Required future files                                                                                                                                                                                          | Acceptance focus                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts     | `packages/contracts/src/admin/admin.schema.test.ts`                                                                                                                                                            | Strict allowlists/search/page bounds/unsafe offsets/meta agreement/empty.                                                                                                                         |
| Backend       | `apps/api/src/modules/admins/manual-credit-targets.integration.test.ts`                                                                                                                                        | Anonymous/USER/stale/revoked/disabled ADMIN denial; varied existing USER status/first-credit wallet; duplicate names/search/pages/ties/snapshot totals; minimal/no-store output/read under fence. |
| Employee      | `apps/web/src/features/employee/api/deposits.api.test.ts`, `hooks/deposits.hooks.test.tsx`, `components/deposit/deposit-card.test.tsx`                                                                         | Strict status/precision, provisioning once, failure polling, readiness/history separation, stale scope/denial/empty/error/copy.                                                                   |
| Admin/runtime | `apps/web/src/features/admin/api/deposits.api.test.ts`, `hooks/deposits.hooks.test.tsx`, `components/deposits/deposits-screen.test.tsx`, `utils/manual-credit-command-runtime.test.ts`                         | Exact intent/handle/readback/lock/storage/pending/reload/original GET/404/live refetch; no replacement or auto write.                                                                             |
| Shared        | Existing `financial-query.test.ts`, `api-client.test.ts`, money/time/confirmation/private-scope tests; proposed `services/api/safe-error.test.ts`, employee `components/common/copy-action.test.tsx` if needed | Earlier semantics/safe projections/retirement/no write replay/exact display/clipboard truth.                                                                                                      |
| Browser/DB    | `apps/web/e2e/deposits.spec.ts` and private IPC                                                                                                                                                                | Two accounts/reload, canonical repeated event/two logs/weekend, chain/manual/first target/exact grant/lost reply/revocation, no local effects/unchanged source-reservation allocations.           |

Abbreviated test paths stay under the preceding full feature prefix; shared paths are under `apps/web/src/`. Reuse `apps/web/src/test/p04-query.tsx` and `p04-network.ts` fresh QueryClient/session/transport wrappers with adapter doubles/deferred responses. Financial claims require migrated PostgreSQL/private IPC. Extend existing P06 manual-credit/history integration tests only for a demonstrated missing case. Synthetic browser fixtures send no funds and do not replace protected process/testnet evidence.

## Remaining Gates and Risks

No owner/business clarification remains. Lookup/harness/frontend/checkpoint/independent QR acceptance is defined above; actual execution evidence belongs in quickstart. An uncertain original action can remain 404 indefinitely: existing alert must retain this limitation and observation; browser locks/storage do not own money integrity. Provider/recovery latency has no guarantee. Admission stays disposable-only; absent Docker/Linux/independent QR evidence leaves gates open. Approved compromised-admin/host/no-2FA risks and P11 independent review remain.

## Complexity Tracking

No constitutional violation proposed. C3 lookup and focused handle satisfy FR-017/020/021; existing transaction/authority owners remain authoritative. No migration/dependency/generic framework/additional artifact justified.
