# P01 Validation Guide

**Status**: Future implementation validation, not an executed result or permission to implement. **Feature**: [spec.md](spec.md). **Design**: [plan.md](plan.md), [data-model.md](data-model.md), [financial boundary](contracts/financial-boundary.md), [internal service](contracts/ledger-service.md).

Run from the repository root after authorized P01 implementation creates the proposed files below. Package scripts exist now; those file filters do not establish that the tests/services already exist. P01 has no financial HTTP workflow, so validation exercises the real internal service and persistence, not invented curl endpoints or browser controls.

## Prerequisites

- Node 24 and pnpm 11.17.0, existing workspace installation, deliberately updated/pinned Luxon dependency and lockfile from implementation.
- Available Docker-compatible runtime and image access for existing Testcontainers `postgres:18.4` integration suites. They override DATABASE_URL with disposable databases and run migrations; never substitute a live/developer database or mocked Prisma.
- Existing local-only configuration required by the database CLI/build and API test setup. Keep secrets out of command arguments/output; no provider, Redis, signing credentials, testnet or mainnet funds are required for P01.
- Scope auth fixture cleanup before combined suites; financial history must survive until container teardown. Preserve unrelated working-tree changes.

## Build prerequisite packages and inspect the baseline

The generated Prisma client may be absent. Existing database build runs generation; direct API checks require workspace dependency artifacts.

```sh
pnpm --filter @template/contracts build
pnpm --filter @template/database build
pnpm --filter @template/contracts test
pnpm --filter @template/database test
pnpm --filter @template/api test
```

At implementation start, run relevant existing suites before changes to distinguish existing failures from new ones; repeat affected checks after the work. These commands are instructions, not baseline evidence recorded by PLAN.

## Validate contracts, arithmetic and calendar

```sh
pnpm --filter @template/contracts test src/financial/financial.schema.test.ts
pnpm --filter @template/api test src/core/financial/money.test.ts src/core/business-calendar/business-clock.test.ts
```

Expected: micro/max amounts retain exact units; invalid/noncanonical inputs fail; full-range percentage multiplication floors without floating-point error; gross equals fee+net. Strict output shapes contain canonical strings and no private fields. All approved calendar cutoffs match the spec.

Validate CHK010 through the shared schema/converter and the real proposed calendar; these are expected outcomes, not results already executed:

| Input hours                                                                      | Expected duration/outcome                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `"1"`                                                                            | Exactly 3,600,000 counted milliseconds                                               |
| `"1.5"`, `"0001.5000"`                                                           | Exactly 5,400,000 counted milliseconds; redundant zeros preserved in validated input |
| `"0.0000025"`, `"0.0000025000"`                                                  | Exactly 9 counted milliseconds                                                       |
| `"0.0000001"`, `"0.000001"`                                                      | Reject 0.36/3.6 millisecond durations without rounding or altering the deadline      |
| Numeric `1.5`, `"0"`, `"-1"`, `"+1"`, `" 1"`, `"1e3"`, `"1,000"`, `".5"`, `"1."` | Reject type/value/plain-decimal grammar                                              |
| Result outside calendar years 0001-9999                                          | Reject without clamping or replacing the existing deadline                           |

Exercise eight normalized integer/seven normalized fractional digits, redundant raw zeros, exact divisibility and safe millisecond conversion per the [extension contract](contracts/financial-boundary.md#counted-hour-extension-precision). Friday 23:30 Baghdad plus `"1.5"` counted hours must end Monday 01:00; positive extensions continue from the existing deadline. Cover weekday/weekend/year crossings and years 0001-0099 without inheriting native Date.UTC's year adjustment. Luxon isValid alone does not validate the approved explicit-offset/precision/year contract.

For two host-timezone runs in PowerShell, preserving the prior setting:

```powershell
$p01PreviousTimezone = $env:TZ
try {
  $env:TZ = 'UTC'
  pnpm --filter @template/api test src/core/business-calendar/business-clock.test.ts
  $p01UtcCalendarExit = $LASTEXITCODE
  $env:TZ = 'America/New_York'
  pnpm --filter @template/api test src/core/business-calendar/business-clock.test.ts
  $p01OtherCalendarExit = $LASTEXITCODE
  if ($p01UtcCalendarExit -ne 0 -or $p01OtherCalendarExit -ne 0) {
    throw 'P01 calendar validation failed.'
  }
} finally {
  if ($null -eq $p01PreviousTimezone) {
    Remove-Item Env:TZ -ErrorAction SilentlyContinue
  } else {
    $env:TZ = $p01PreviousTimezone
  }
}
```

Expected in both processes: weekday 12:00 open/18:00 closed; weekend closed; first counted purchase date respects cutoff; exactly 365 work dates including first; following calendar-midnight expiry even on Saturday; Friday 12:00 plus 72 counted hours is Wednesday 12:00; exact blocked-weekend dispatch normalizes to Monday. Calendar results are Baghdad-based regardless of host TZ.

## Validate migrated persistence and service outcomes

```sh
pnpm --filter @template/database test:integration
pnpm --filter @template/api test:integration src/modules/ledger/ledger.service.integration.test.ts src/modules/ledger/ledger-concurrency.integration.test.ts src/modules/ledger/ledger-reconciliation.integration.test.ts
```

The database suite must include expanded inventories and actual financial constraint/fresh/populated-upgrade/redeploy files. The populated-upgrade test must establish a legacy-only migrated disposable database and real auth/refresh fixtures before applying P01; merely running global setup against an empty latest schema is insufficient. Preserve migration history and auth checks; no auto-created wallets or invented legacy funds.

Required observable sequences:

1. Credit 70 non-referral plus 30 referral; purchase debit 20 leaves 70/10 available; reserve gross 75 with both sources eligible moves 70/5 to reserved and leaves 5 referral available. Release after an eligibility change restores exactly 70/10 available once. Free/expired new reservations exclude referral while purchase spending still uses it.
2. Repeat one business credit/debit 100 times with same/different/missing request keys: one effect. Same key/business source with changed consequential intent conflicts. A newly bound alias later rejects changed use; another actor's textual key gives no private outcome. Authorized replay returns the original snapshot, including after later balance changes.
3. Use independent real connections/start barriers for two 80 debits against 100: one commit, final 20. Debit/reserve and release/release races conserve all four components and leave no losing partial records. Retry exhaustion is a safe unresolved conflict, not success.
4. Trigger a real failure through the service's owning-domain callback after finance writes and a fixture-owned dependent user-field write: postings, projections, allocation, operation/result, audit and dependent write all roll back. Retry after a simulated lost reply recovers committed identity without another effect.
5. Deny missing/mismatched/stale authority, wrong wallet and unauthorized replay without exposing another outcome or mutating records. Sanitize unknown nested driver failures; sentinel secrets must not reach errors/logs.
6. Reconstruct mixed operations/corrections and active reservations in one authorized read-only RepeatableRead snapshot, beginning with static SET TRANSACTION READ ONLY before any observation/data reads. Assert every operation's exact complete source posting set/magnitude/origin, immutable walletBefore plus deltas equals saved walletAfter, required audit and reserve/release allocation/link agreement. A RESERVE's historical ACTIVE outcome remains valid after a later RELEASE. Compare ledger/projection/ACTIVE-allocation aggregates alongside these per-operation checks.
7. Seed isolated fixture-owned faults with direct INSERTs permitted by existing row guards: a declared 10 credit with posting/projection 9; two declared 10 credits posting 9/11 with matching totals; a completed operation with no postings; a missing audit; or inconsistent saved outcome/allocation evidence. Reconciliation must report each admissible fault even when aggregate totals agree, return only authorized safe discrepancies and leave the fixture byte-for-byte unchanged. If a guard rejects a fault, assert that constraint and choose another admissible fault; never disable guards or amend history to make the fixture. Separate mutable-projection corruption remains a scoped fault case. Immutable history rejects UPDATE/DELETE/TRUNCATE, financial FKs restrict account erasure, and auth refresh cascade remains intact for auth-only fixtures.

The [reconciliation contract](contracts/ledger-service.md#reconciliation-errors-and-diagnostics) and [data model](data-model.md#sql-guards-reconciliation-and-upgrade-evidence) define per-kind evidence and guard-preserving fault setup. Missing operation rows must not disappear through an inner join from postings. Include concurrent-write snapshot consistency and exact cumulative sums beyond single-movement int64 bounds; never clamp diagnostic differences or route them through the bounded single-posting schema.

No callback/mock transaction or sequential Promise.all on one connection replaces these database claims. Payout consumption, external finality, queues, restore and financial endpoints remain later-phase tests.

## Affected shared regressions and static/build checks

```sh
pnpm --filter @template/contracts test
pnpm --filter @template/api test src/core/date-only.test.ts src/core/serialization/decimal.test.ts
pnpm --filter @template/api test:integration src/modules/auth/auth.service.integration.test.ts src/app.integration.test.ts
pnpm --filter @template/contracts lint
pnpm --filter @template/database lint
pnpm --filter @template/api lint
pnpm check-types
pnpm build
pnpm verify:build-output
git diff --check
```

Add existing Prisma-error-mapper tests to the focused API run only if that mapper changes. Run artifact formatting with the current Prettier script/CLI on the owned paths, without rewriting unrelated files. Root `pnpm verify` includes schema-writing db:format and full suites; it is not a read-only PLAN check. Full regressions remain required at P05/P09/P12/P14/P15 and release.

## Report the actual gate

Before implementation, review the existing custom requirements checklist and align all affected shared-contract, ledger-snapshot, calendar and reconciliation tasks (including T007/T009/T011, T025-T027 and T033-T035) with this amended design through the separately selected TASKS stage, preserving existing task IDs, then rerun ANALYZE. This guide changes no approval/task markers. Record exact commands, fresh/cached results, failed checks and unavailable services in the implementation result. Baseline, dependency compatibility, SC-001-SC-007 including CHK010/CHK035 acceptance, migrated PostgreSQL checks, affected auth/shared regressions and relevant static/build checks must pass to close P01. Missing Docker/image/database execution leaves the gate incomplete; do not claim provider/deployment/recovery readiness from P01. No tasks, implementation, next phase or real-money operation is authorized by this guide.
