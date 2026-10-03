# P01 Validation Guide

**Status**: Validation procedures for the implemented P01 foundation; commands and expected outcomes below are not recorded passes. **Feature**: [spec.md](spec.md). **Design**: [plan.md](plan.md), [data-model.md](data-model.md), [financial boundary](contracts/financial-boundary.md), [internal service](contracts/ledger-service.md).

Run from the repository root. The entrypoints and test files below exist in the current implementation. P01 has no financial HTTP workflow; validation exercises the internal service and disposable persistence.

## Implemented entrypoints and ownership

| Owner                    | Entrypoints / files                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared contracts         | `packages/contracts/src/financial/financial.schema.ts`, exported through `packages/contracts/src/index.ts`: amount/rate/source/date/result schemas, `positiveCountedHoursSchema` and `countedHoursToMilliseconds`.                                                                                                       |
| Exact arithmetic         | `apps/api/src/core/financial/money.ts`: `parseUsdtAmount`, `parseSignedUsdtDelta`, `formatUsdtAmount`, `formatSignedUsdtDelta`, `addUnits`, `subtractUnits`, `totalUnits`, `percentageUnits` and `feeAndNetUnits`.                                                                                                       |
| Baghdad calendar         | `apps/api/src/core/business-calendar/business-clock.ts`: injected-clock `BusinessClock`, with `now`, `businessDate`, `isTaskWindowOpen`, `subscriptionTerm`, `isSubscriptionActive`, `initialWithdrawalDeadline`, `extendDeadline` and `normalizeNewDispatch`.                                                           |
| Internal accounting      | `apps/api/src/modules/ledger/ledger.service.ts`: `LedgerService.execute`, `recoverOperation`, `runInTransaction` and `reconcileWallet`. `runInTransaction` supplies the same transaction client and a handle exposing `credit`, `debitForPurchase`, `reserveForWithdrawal`, `releaseReservation` and `correctAvailable`. |
| Accounting collaborators | `ledger.types.ts`, `ledger.effects.ts`, `ledger.transaction.ts`, `ledger.mapper.ts` and `ledger.errors.ts` in the ledger module; read-only checks in `ledger-reconciliation.ts` and `ledger-reconciliation.evidence.ts`.                                                                                                 |
| Persistence              | Six financial models in `packages/database/prisma/schema.prisma`; forward migration `packages/database/prisma/migrations/20261002000000_financial_foundation/migration.sql`, following the retained authentication migration.                                                                                            |

Trusted composition supplies the allowlisted business namespaces/process IDs, actor, participant wallets, clock, observation/mutation guards and action-specific eligibility/release-safety callbacks. These are server-only inputs; an ID or schema-valid intent does not grant authority. Database-only dependent writes use the same transaction. Authorized replay returns the original result and skips dependent writes. Standalone recovery returns `null` when no committed identity is found; it does not infer success or safe release.

Amount/calendar validation raises bounded `RangeError` messages. Ledger failures use `LedgerError` from `ledger.errors.ts`, including `LEDGER_FORBIDDEN`, `LEDGER_IDENTITY_CONFLICT`, `LEDGER_INSUFFICIENT_FUNDS`, `LEDGER_RESERVATION_CLOSED` and `LEDGER_UNRESOLVED`. Guards must reject intentional denials with `new LedgerError("LEDGER_FORBIDDEN")`; unexpected faults become sanitized `LEDGER_INTERNAL` errors. Their original `cause` is retained as a non-enumerable field for protected diagnosis. The existing HTTP boundary logs only the safe code, request ID, status and message for these errors; never log the error/cause object directly or expose its private payload. Recognized transient Prisma conflicts retain bounded retry handling. Treat unresolved operations as requiring identity recovery; do not infer a refund or blindly repeat a transfer. These are internal codes, not a newly registered HTTP contract.

Each `runInTransaction` attempt becomes rollback-only after any transaction-bound primitive fails. Catching a child error cannot permit commit or further primitives, including after an earlier child succeeded. A retry starts a fresh scope; authorized replay still skips dependent writes.

## Prerequisites

- Node 24 and pnpm 11.17.0 with the existing workspace installation. The API pins runtime `luxon` 3.7.2 and development `@types/luxon` 3.7.6; the lockfile contains these additions.
- Available Docker-compatible runtime and image access for existing Testcontainers `postgres:18.4` integration suites. They override DATABASE_URL with disposable databases and run migrations; never substitute a live/developer database or mocked Prisma.
- Existing local-only configuration required by the database CLI/build and API test setup. Keep secrets out of command arguments/output; no provider, Redis, signing credentials, testnet or mainnet funds are required for P01.
- The app/auth suites scope fixture cleanup, refresh reads and counts to their owned accounts. Financial fixtures in `apps/api/src/modules/ledger/testing/financial-fixtures.ts` retain history until container teardown. Preserve unrelated working-tree changes.

## Build prerequisite packages

The generated Prisma client may be absent. Existing database build runs generation; direct API checks require workspace dependency artifacts.

```sh
pnpm --filter @template/contracts build
pnpm --filter @template/database build
```

Run these builds sequentially before direct API checks. Historical baseline assessment belongs to T002; the acceptance commands below validate the current foundation and do not reconstruct a pre-change baseline.

`packages/database/prisma.config.ts` requires `DATABASE_URL` even for generation. If local CLI configuration is absent, use this PowerShell procedure for these builds, or for the `pnpm check-types` / `pnpm build` commands below. The placeholder is test-only and these commands do not migrate or connect to that database; integration global setups replace it with their disposable container URL.

```powershell
$p01PreviousDatabaseUrl = $env:DATABASE_URL
try {
  if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $env:DATABASE_URL = 'postgresql://p01_test:p01_test@127.0.0.1:1/p01_codegen_only'
  }
  pnpm --filter @template/contracts build
  if ($LASTEXITCODE -ne 0) { throw 'Contracts build failed.' }
  pnpm --filter @template/database build
  if ($LASTEXITCODE -ne 0) { throw 'Database build failed.' }
} finally {
  if ($null -eq $p01PreviousDatabaseUrl) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_URL = $p01PreviousDatabaseUrl
  }
}
```

## Validate contracts, arithmetic and calendar

```sh
pnpm --filter @template/contracts test src/financial/financial.schema.test.ts
pnpm --filter @template/api test src/core/financial/money.test.ts src/core/business-calendar/business-clock.test.ts
```

Expected: micro/max amounts retain exact units; invalid/noncanonical inputs fail; full-range percentage multiplication floors without floating-point error; gross equals fee+net. Strict output shapes contain canonical strings and no private fields. All approved calendar cutoffs match the spec.

Validate the accepted CHK010 precision contract through the shared schema/converter and calendar; these are expected outcomes:

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

The web build requires a valid `NEXT_PUBLIC_API_URL`; a localhost URL is sufficient for this build-only check. `apps/web/next.config.ts` caps prerender workers at two, and `turbo.json` excludes development-server output from the production build cache. On a memory-constrained host, use this serial build procedure. Loose environment mode passes the temporary native thread limit through Turbo; all three process environment values are restored afterward:

```powershell
$p01BuildEnvironment = @{}
foreach ($p01Key in @('DATABASE_URL', 'NEXT_PUBLIC_API_URL', 'RAYON_NUM_THREADS')) {
  $p01BuildEnvironment[$p01Key] = [Environment]::GetEnvironmentVariable($p01Key, 'Process')
}
try {
  if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $env:DATABASE_URL = 'postgresql://p01_test:p01_test@127.0.0.1:1/p01_codegen_only'
  }
  if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_API_URL)) {
    $env:NEXT_PUBLIC_API_URL = 'http://localhost:5000/api/v1'
  }
  $env:RAYON_NUM_THREADS = '2'
  pnpm build --concurrency=1 --env-mode=loose
  if ($LASTEXITCODE -ne 0) { throw 'Workspace build failed.' }
} finally {
  foreach ($p01Key in $p01BuildEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($p01Key, $p01BuildEnvironment[$p01Key], 'Process')
  }
}
```

After the build, verify the ledger fixture directory is absent from emitted output. The root build-output checker rejects test filenames but does not detect helper names:

```powershell
if (Test-Path -LiteralPath 'apps/api/dist/modules/ledger/testing') {
  throw 'Ledger test helpers were emitted into production output.'
}
```

Check owned source/config/test/docs formatting without rewriting unrelated files. Generated Prisma files and migration SQL are excluded by `.prettierignore`:

```sh
pnpm exec prettier --check packages/contracts/src/financial packages/database apps/api/src/core/financial apps/api/src/core/business-calendar apps/api/src/modules/ledger specs/001-financial-backend-foundation/quickstart.md
```

Add `src/infrastructure/database/prisma-error.mapper.test.ts` to the focused API run only if its production mapper changes. Root `pnpm verify` includes schema-writing `db:format` and full suites; it is broader than this P01 gate. Full regressions remain required at P05/P09/P12/P14/P15 and release. Root Turbo types/build runs may reuse cached results; report cache status separately from freshly executed package tests.

## Report the actual gate

The requirement checklists record written-evidence reviews, not runtime passes. Preserve their approval markers. Review SC-001-SC-007 against the actual schema/money/calendar, real PostgreSQL service/race/reconciliation, fresh/populated/repeated migration and affected auth/shared results. Record exact commands, fresh/cached outcomes, failed checks and unavailable services in the implementation result; task markers alone are not execution evidence.

Missing required persistence evidence or failed static/build checks leaves P01 incomplete. P01 acceptance covers internal primitives; it does not establish provider confirmation, production session hardening, signing, settlement, recovery or live-money readiness. Stop at the selected task scope; this guide authorizes no subsequent workflow stage, deployment or real-money operation.
