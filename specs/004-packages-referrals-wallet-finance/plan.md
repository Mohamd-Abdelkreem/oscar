# Implementation Plan: P04 - Packages, Referrals, Wallet, and Finance

**Branch**: `004-packages-referrals-wallet-finance` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P04 - Packages, Referrals, Wallet, and Finance

**Feature Directory**: `specs/004-packages-referrals-wallet-finance`

**Input**: Clarified P04 spec, constitution 1.0.0, [roadmap](../../PLAN.md), and PLAN prompt/operating contract in [speckit-prompts.txt](../../docs/workflow/speckit-prompts.txt).

**Status**: Design only. P04 models, modules, endpoints and named P04 tests below are proposed unless expressly identified as existing. No application code, tasks, checklist approvals or application tests are produced by PLAN. Setup resolved the selected feature without an override. The spec's branch field records the earlier SPECIFY context; this header records the current branch returned by setup and Git.

## Summary

Deliver one merged P04 in two ordered groups: complete package/configuration, quote/purchase/subscription, fixed-level referral, wallet/ledger/finance and correction backend acceptance; then wire six existing domain screens and account financial regions. Purchases debit the full target price, spend unreserved referral funds first and activate immediately. Upgrade commission uses only the positive difference against the prior saved price. Both calculations, membership replacement, event-time referral decisions and required ledger/audit commit through the existing compound financial transaction.

A persisted owned quote supplies disclosed terms, stale-state checks, business replay identity and read reconciliation. Buyer purchase sequence and database uniqueness prevent two independent quotes from the same generation succeeding. Current counters govern future configuration; immutable snapshots govern history. Sensitive membership reads observe exclusive expiry rather than a timely job. P04 needs no queue, provider or expiry worker.

## Technical Context

**Language/Version**: TypeScript 5.9.3; Node `>=24 <25`, pnpm `>=11 <12`, pinned pnpm 11.17.0. Manifest constraints, not a fresh runtime check.

**Primary Dependencies**: Existing Express 5.2.1, Prisma/client/adapter-pg 7.9.1, pg 8.22.0, Zod 4.4.3, Luxon 3.7.2; Next 16.2.12, React 19.2.8, TanStack Query 5.101.4, Axios 1.19.0, React Hook Form 7.84.0 and resolvers 5.7.1. Preserve Cairo/Tailwind/Radix controls and explicit constructor composition. No dependency/lockfile change planned.

**Storage**: Existing PostgreSQL wallets, append-only operations/postings/audit, request identities, reservations, fixed sponsors and auth sessions. Add package/settings, quotes, purchases, subscriptions, referral decisions and configuration audit in a forward migration. PostgreSQL 18.4 is the current test image. No Redis, private proof storage, custody or external transfer participates in purchase.

**Testing**: Existing Vitest 4.1.10, Testing Library 16.3.2, Supertest 7.1.4, Testcontainers 12.1.0 and Playwright 1.63.0. API/database integration harnesses migrate disposable PostgreSQL; P03 registered real web/API/DB Chromium E2E. Current manifests supersede the guides' historical inventories.

**Target Platform**: Current Node API and Next App Router browser application; Linux/Docker deployment remains P11.

**Project Type**: Existing `@template/api`, `@template/contracts`, `@template/database`, `@template/web` monorepo.

**Performance Goals**: At most five ancestor award decisions per purchase; bounded SQL lists, page 1/limit 25/default/max limit 100; no whole-history loading or request-level tree materialization. Preserve the ledger's three recognized-conflict attempts, 5-second acquisition wait and 10-second transaction timeout. The roadmap's 1000 employees over a year is not a concurrency/latency guarantee. Inspect representative filtered queries/indexes during implementation; no invented SLA.

**Constraints**: Exact micro-USDT/basis points; source and reservation conservation; current authority/ownership; atomic dependent effects; no automatic financial replay; Baghdad dates; frozen frontend except spec C1-C2. Exclude refund/downgrade/active same-tier renewal, commission compression/backfill, task claim/reset, chain/manual-credit endpoint, withdrawal workflow, employee-adjustment UI, general settings UI and cross-domain dashboards.

**Scale/Scope**: Five paid tiers, L1-L5, `/employee/packages`, `/employee/team`, `/employee/wallet`, `/admin/packages`, `/admin/referrals`, `/admin/finance` and existing account subscription/balance/link regions only. Retain future-domain fixture providers until their consumers migrate.

## Constitution Check

Checks use constitution 1.0.0, all eight engineering guides and current source. PASS means design compliance, not implementation acceptance.

| Gate                       | Before research                                                  | After design / evidence                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| I - Scope/evidence         | PASS: pointer/spec select current merged P04; tree checked       | PASS: one plan suite, existing/proposed owners identified; other phases/pointer/spec/roadmap preserved                                       |
| II - Frontend preservation | PASS: accepted C1-C2 and P03 login evidence recorded             | PASS: existing routes/dialogs; only specified wording/reason/review/paging/search/feedback exceptions                                        |
| III - Ownership/design     | PASS: actual manifests/layers inspected                          | PASS: compound ledger, shared contracts, migrations, feature APIs/hooks and central transport; no new framework/dependency                   |
| IV - Backend prerequisites | PASS for planning: P01/P02/P03 recorded final acceptance         | PASS design: gate B precedes every frontend batch; fresh affected predecessor checks still required during implementation                    |
| V - Financial/custody      | PASS: purchase/source/calendar/referral rules identified         | PASS: atomic replay-safe composition, snapshots, exclusive expiry and corrections; custody/payout/recovery execution belongs to later phases |
| VI - Security              | PASS: current persisted session and user/session lock APIs exist | PASS: transactional recheck, projections, CSRF/no-store/redaction and scoped admission; one-admin/no-2FA risk retained                       |
| VII - Verification         | PASS: actual harnesses/scripts identified                        | PASS: concrete test files/races/rollback/browser/full checkpoint below; no fabricated runs                                                   |

No unresolved business clarification or constitutional waiver is needed. C1-C2 are recorded feature-specific decisions. P03's existing dedicated admin login and acceptance resolve the operating contract's historical missing-screen concern for this surface; do not recreate it or amend the constitution. Independent launch review, live mail, deployment and custody/provider gates remain later obligations.

## Project Structure

### Documentation (this feature)

```text
specs/004-packages-referrals-wallet-finance/
  spec.md                         # Existing clarified input; unchanged
  checklists/requirements.md       # Existing; approval markers unchanged
  plan.md
  research.md
  data-model.md
  contracts/http.md
  contracts/ui-integration.md
  quickstart.md
```

`tasks.md` belongs to a later separately selected TASKS command and is not generated here.

### Source Code (repository root)

All paths in the proposed column are future targets; keep adjacent module conventions and avoid empty mandatory layers.

| Owner                 | Existing reuse                                                                      | Proposed targets                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence           | `packages/database/prisma/schema.prisma`, client factory, inventory/migration tests | `prisma/migrations/20261004000000_packages_referrals_wallet/migration.sql`, `tests/integration/p04-domain.integration.test.ts` under database                                             |
| Contracts             | `packages/contracts/src/financial/financial.schema.ts`, HTTP schemas, index         | `packages/package.schema.ts`, `subscriptions/subscription.schema.ts`, `referrals/referral.schema.ts`, `wallet/wallet.schema.ts` under contracts/src, colocated tests                      |
| Catalog/configuration | Router/module/OpenAPI composition                                                   | `apps/api/src/modules/packages/{packages.routes,packages.controller,packages.service,packages.mapper,package-configuration.service}.ts`                                                   |
| Purchase/subscription | Compound ledger and current session authority                                       | `apps/api/src/modules/subscriptions/{subscriptions.routes,subscriptions.controller,purchase-quote.service,subscription-purchase.service,subscriptions.service,subscriptions.mapper}.ts`   |
| Referrals             | Immutable P02 sponsor relation                                                      | `apps/api/src/modules/referrals/{referrals.routes,referrals.controller,referrals.service,referral-commissions,referrals.mapper}.ts`                                                       |
| Wallet/finance        | Existing ledger mapper/reconciliation/correction                                    | `apps/api/src/modules/wallets/{wallets.routes,wallets.controller,wallets.service,wallets.mapper,wallet-history.query}.ts`                                                                 |
| Shared financial      | Existing money/calendar/ledger/auth owners                                          | Bounded calendar duration extension; exact nonspendable aggregate formatting/validation as needed                                                                                         |
| Employee API/hooks    | Current auth/session, central Axios/Query                                           | `apps/web/src/features/employee/api/{packages,wallet,referrals}.api.ts`, matching hooks, `hooks/purchase-command.hooks.ts`, `utils/purchase-command-runtime.ts`, `utils/money-display.ts` |
| Admin API/hooks       | Existing admins adapter/hooks and common controls                                   | `apps/web/src/features/admin/api/{packages,finance,referrals}.api.ts`, matching hooks and focused package-command ownership                                                               |
| Existing presentation | Employee packages/team/wallet/account; admin packages/referrals/finance             | Adapt their existing components in place; shared MoneyAmount retains number compatibility for later fixture callers                                                                       |
| Browser support       | `apps/api/tests/e2e/{control,server}.ts`, `apps/web/e2e/support/fixtures.ts`        | Focused P04 fixture helper and three E2E suites below                                                                                                                                     |

**Structure Decision**: Services own policy/transactions, controllers/routes adapt validated HTTP, contracts own wire shapes, Prisma/SQL own persistence, Query owns browser server state. No repository/DI framework, outbox, version registry, universal command platform, worker or speculative provider layer.

## Backend Design

### Current foundation and prerequisites

Existing `LedgerService.runInTransaction(context, work)` exposes the same Prisma transaction and transaction-bound primitives. It locks declared users/wallets/reservations deterministically, retries recognized conflicts and enforces rollback-only child failure even when caught. Sequential children are supported; nested/overlapping effects are rejected. Existing `correctAvailable` already supports positive exact source/direction, reason/reference, current admin authority and replay protection. Reuse it without registering an adjustment endpoint in P04.

Recorded evidence is reused: P01 T039-T040 task evidence records 67 persisted regressions and rollback/safe-error fixes; P02 quickstart records completion through T067; P03 quickstart final acceptance records T001-T065, 139 contracts, 280 web, 108 producer regressions and 48 browser scenarios. Final entries supersede historical intermediate open gates. PLAN runs no predecessor tests; fresh affected regressions remain required for implementation gate B.

### Quotes and stale-state identity (FR-005-013, FR-020-023)

Create an immutable owned quote via authenticated CSRF-protected POST, valid for ten minutes. This is review freshness, not a financial hold. Save package/referral versions/terms, wallet components, latest committed buyer purchase sequence, observed current subscription/effective action and preview first/final work dates/exclusive expiry. Return full debit, usable funds, partial funded allocation and exact top-up. Do not represent insufficient funding with the existing fully funded source-allocation schema. Quote creation spends/reserves nothing.

The purchase submits only quote identity/confirmation and optional request key. Under locks, recheck current authority, ownership/expiry, counters, purchase sequence, effective membership, components and recomputed disclosed dates. Material change rejects as stale; insufficient funds never debit. Activation uses event time, not quote creation. Higher tier is independent of price; active same/lower tier is denied; expired membership allows ordinary new purchase.

Unique `Purchase.quoteId` and `(buyerId,buyerSequence)` protect consumption; create sequence expected+1 under the buyer lock. Two distinct quotes from the same generation cannot both commit, even with different/missing request keys. A later renewal obtains a quote against the latest sequence. Quote bodies/creation frequency are bounded; no cleanup worker or quote-per-render behavior.

For replay, find the recorded purchase before current-term stale checks, recheck current session/ownership, then call transactional debit with original saved identity/amount and incoming key so alias/payload conflict logic still executes. Skip children and map the immutable purchase-time outcome, including subscription stateAtPurchase=CURRENT; later lifecycle state belongs to membership/history reads. Replay remains valid after quote expiry/catalog changes; an alias conflict rolls back. Read reconciliation returns COMMITTED, live NOT_OBSERVED or safely EXPIRED_UNCOMMITTED. It acquires the same buyer user lock as purchase, then rechecks session, reads quote/purchase and samples current time using ReadCommitted observations after the lock. Thus it waits for a purchase already holding that lock, and an expired absent quote cannot later be consumed by a delayed command that also rechecks expiry after acquiring the lock. Only that locked expired observation is terminal without a purchase; live absence remains uncertain. Return safe original quote terms for renewed review, never automatic replacement/refund.

### Atomic compound purchase (FR-014-022)

1. Pre-resolve immutable existing L1-L5 sponsor IDs and existing wallets without deciding eligibility. Declare buyer/ancestor wallets and every ancestor authority user. Missing declared wallets fail closed; an otherwise eligible recipient without a wallet is an integrity failure, not a skipped award.
2. Enter the existing compound ledger transaction. After its deterministic participant locks, lock actor sessions and package/settings in consistent order. Capture one event instant per attempt and call `readSessionAuthority` with USER. Ancestors need current account/subscription eligibility, not logged-in sessions. All terms/eligibility/postings/audit use that instant via context clock; reset derived state on retry.
3. Reconcile replay or validate the fresh quote. Snapshot actual fixed levels/rates/recipient eligibility. Ordinary purchase/post-expiry renewal base is full price; upgrade base is max(0,targetPrice-priorSavedPrice). Floor through existing bigint percentage arithmetic.
4. Call transaction-bound `debitForPurchase`. Its domain-write callback inserts Purchase, transitions prior CURRENT to REPLACED/EXPIRED, then inserts the new CURRENT Subscription and skipped/eligible-zero decisions, in that order to satisfy immediate partial uniqueness. Financial operation/postings/projections/audit remain ledger-owned. No task/reward/daily-claim write.
5. After the debit child finishes, sequentially credit each positive award; each credit callback inserts its final immutable decision linked to the credit. No nested credit or Promise.all effects. Zero awards have decision rows and no ledger credit.
6. Map saved outcome. Every dependent failure rolls back all effects; caught callback/child failures poison the scope. Do not swallow direct transaction writes outside ledger callbacks. No external I/O in the transaction.

Keep expected session/role denial in the outer callback before effects, or translate expected guard denial to LedgerError: ledger guard wrapping converts unexpected ordinary errors to LEDGER_INTERNAL. Post-effect failures roll back and cannot become an auth-refresh replay response. Reuse the three-attempt conflict policy; no second retry loop or retry of stale terms/unknown failures.

### Configuration and membership (FR-004-006, FR-011-018)

Seed stable five tiers and rates in a forward migration. Counters start at one; P04 cannot reorder/add/delete tier codes. Edits require current ADMIN, confirmation, reason, expected version and stable command UUID. A focused immutable configuration-change record stores before/after/actor/time and replay identity; no fake money operation is created for catalog audit. Conditional target update and audit commit together. Future rates/terms never rewrite accepted history; general settings UI remains P10.

Use the existing positive int64 micro-USDT and 0..10000 bps bounds. Proposed Int duration/counters are 1..2147483647; fresh edit expectedVersion is at most 2147483646. Conditional gross must fit the existing amount schema, and the shared calendar must keep both Baghdad dates and serialized UTC instants in years 0001..9999. Validate the resulting term at current acceptance time and again at quote/commit; no commercial cap or silent clamp is invented.

Configuration recovery retains the exact original UUID/target/version/fields/reason/confirmation outside dialog reset. A visible explicit retry resubmits only that intent, with no automatic mutation retry. In a focused ReadCommitted transaction, acquire compatible ordered actor/session and target locks and use fresh post-lock reads. Current authority and saved actor-command lookup precede version validation: matching saved intent wins committed replay, differing intent conflicts. With no saved command, equal version permits one atomic save; a greater version returns CONFIGURATION_SUPERSEDED, proving this matching original PATCH cannot later execute because all writes share the target lock/conditional version and counters never decrease. A lower version is generic stale; lock/read/conflict failures and NOT_OBSERVED remain uncertain. Only validated matching commit or superseded evidence can release a dispatched guard, followed by a current reread. Scope retirement detaches presentation and clears private payloads without claiming an unknown save failed; unavailable exact payload/observation stays uncertain. No new cancellation protocol, configuration intent table or money operation is needed.

Extend `BusinessClock.subscriptionTerm` with validated counted duration/default 365. Use whole weeks plus bounded weekday remainder, reject unsupported resulting calendar/gross bounds. Save activation UTC, first/final Baghdad dates and exclusive UTC expiry. A partial unique index permits one CURRENT row per employee. CURRENT may be logically expired until lazy transition on purchase; every sensitive read uses activation <= now < expiry and CURRENT state. Expiry changes eligibility, not balances/history, and needs no worker.

### Projections and corrections (FR-024-029)

Explicit employee/admin DTOs and no-store. Ownership equals all four components; purchases exclude reservations. New-withdrawal fund eligibility is unreserved non-referral plus unreserved referral only while effectively paid. Report account/withdrawal restrictions separately and identify address/limits/scheduling as future P08-P09 authority. Task-only restriction does not block purchase; withdrawal-only restriction does not block purchase/accrual. Failure cannot become zero/Free/empty.

Preserve the admin package active-subscription column through AdminCatalogItem `{terms,activeSubscriptionsCount}`, rather than adding live data to immutable PackageTerms. Count effective CURRENT subscriptions by saved package code at one serverNow (activation<=now<expiry), independent of task/withdrawal restrictions. Aggregate in SQL with catalog rows and current admin authority under one RepeatableRead observation; exact expiry and upgrade counts do not depend on maintenance. Do not load employees or preserve fixture/guessed counts.

One list row per operation, source postings in detail. Credit/debit totals use signed available+reserved movement; RESERVE/RELEASE add zero income/expense. Avoid multiplying buyer debit by joining award rows. Admin totals include actual persisted operations only. Exact SQL numeric aggregates use a separate nonspendable aggregate-decimal schema/formatter, bounded to 38 micro-unit digits; many wallets/history sums must not overflow single-wallet bigint transport or pass through Number.

AdminFinancePage.summary preserves the existing neutral-operation metric with required neutralOperationsCount. Count distinct RESERVE/RELEASE operation IDs after every operation filter and before paging, within the same RepeatableRead rows/count/summary observation. Source joins cannot duplicate an operation. Counts are nonnegative safe integers; a failed/malformed count is unavailable. Page changes do not change a same-filter summary, and credit/debit direction filters legitimately exclude neutral operations.

Reuse page/limit metadata, deterministic time/id or level/joined/id order and SQL filters/counts. Obtain internally consistent rows/count/summary under RepeatableRead and recheck session there. Empty metadata has zero pages. Lists remain live across requests: inserts can move offsets. Supply scoped first-page refresh/out-of-range recovery; every authorized quiescent record remains reachable. Do not claim a frozen cross-page snapshot or page-only global summary.

Employee root is self, expansion stops at L5 and SQL paginates; return name/joined/package/relative level and only viewer-attributable earnings, omitting descendant email/wallet/private earnings. Admin root search is bounded name/email/referral-code search with separate identity/path/count projection; preserve distinct within-team name/email/ID and finance title/employee/reference/source searches via bounded SQL q filters before count/summary/paging. Root level counts are unfiltered; member pagination totals are filtered. Deeper admin descendant totals are aggregate SQL, not a full-tree payload. Root and commission beneficiary are explicit; admins may inspect skipped decisions, employee earnings are own awarded/zero outcomes. Detail queries constrain ownership/root rather than fetch-then-hide.

Reuse audited source-specific corrections, preserving reservations/origin/history. Employee-detail adjustment UI and manual-credit endpoint remain excluded.

## Frontend Integration (only after gate B)

Follow [UI contract](contracts/ui-integration.md). Runtime-parse adapters; keys include account/role/epoch/check/domain/root/filter/page. Consume AbortSignal and guard current session check/selection at admission: epoch alone cannot handle a revalidation denial. No previous-root placeholder detail or late restoration of authority.

A focused purchase runtime owns pending/uncertain quote outside sheet mount. Before dispatch, require and read back a minimal opaque per-account quote handle in browser storage, claiming it under an account-scoped Web Lock; fail closed if persistence/locking is unavailable. Other tabs/reloads reconcile an existing handle before admitting a new intent. This is a recovery pointer, never a persisted mutation or credential/amount/payload. Retain unresolved handle across account retirement while clearing private payloads. Once any dispatch/uncertainty exists, clear only matching handle after authorized COMMITTED or locked EXPIRED_UNCOMMITTED; failed retries/reconciliation never clear it. A locally verified pre-dispatch failure may release a newly claimed handle only if no request for that intent was ever dispatched. Financial/config writes use retry:false and networkMode:always, no optimistic state, offline pause/resume, mutation-scope queue or automatic 401 replay. P04 writes stay outside the transport replay allowlist. Malformed success is uncertain; server outcome remains authority.

Validated results invalidate matching wallet/subscription/quote/catalog/referral/finance scopes. Historic wallet-after cannot patch today's balance. Logout/account changes clear private payloads/drafts/selections and detach old presentation; late success cannot populate another account. Allowed current reads are needed after denial. Admin edits preserve dirty drafts through transient errors and expose version conflict.

The package hook freezes the reviewed configuration intent in its focused actor-command owner, surviving close/remount. NOT_OBSERVED exposes observation and explicit same-intent retry while the exact original payload and current authority are available. A matching CONFIGURATION_SUPERSEDED response releases only that intent after the server barrier above, then fetches current detail for fresh review. Reload/tab/account retirement never resumes a queued mutation, guesses missing fields or admits a late obsolete response; known uncertainty without original payload remains read-only. Adapter/hook/browser cases cover never-arrived saves, delayed original versus explicit retry, committed lost acknowledgement and supersession.

Adapt existing cards/sheet, team/wallet/detail, admin package editor/referral/finance and account financial cells. C1 corrects contradictory financial wording; C2 adds only required established reason/review/paging/search/feedback in existing surfaces. Reason + distinct review/confirmation stay inside the current edit dialog; no new popup/screen/settings editor. String-format exact money with at least two and up to six needed fractional digits, preserving markup/classes and untouched number-based fixture compatibility.

Remove these P04 surfaces' fixture authority and discounted/timed-success package action exposure; preserve future-domain providers/consumers. Update obsolete purchase-demo assertions deliberately, retaining unrelated task/withdrawal and incident tests. Account identity/password/logout and future withdrawal-address region remain as implemented by P03.

## Delivery Order and Verification

Dependency-safe groups below are design ordering, not tasks or extra roadmap phases.

| Group / gate                  | Concrete future test ownership                                                                                                                                                                                              | Required evidence                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts/persistence         | Proposed four domain schema tests; existing financial/HTTP tests, DB inventory/migration tests; `packages/database/tests/integration/p04-domain.integration.test.ts`                                                        | Initial terms, strict authority rejection, fresh/populated/repeated migration, immutable snapshots, owner/quote/sequence/award/current-subscription constraints, retained P01-P02 protections                           |
| Catalog/calendar              | `apps/api/src/modules/packages/package-configuration.integration.test.ts`; `modules/subscriptions/subscription-calendar.test.ts`; existing business-clock tests                                                             | Version/reason/confirmation/current-session races, future-only rates/terms; before/exact/after 18:00, weekday/weekend, 365/edited duration, final-date midnight/exclusive expiry, range/gross bounds                    |
| Purchase/referrals            | `modules/subscriptions/subscription-purchase.integration.test.ts`; `modules/referrals/referral-commissions.integration.test.ts`; existing ledger service/concurrency/reconciliation tests                                   | Full debit vs difference, nonpositive/zero floor, referral-first locks, independent quotes/keys/devices, competing reserve/correction/ban/expiry/shared ancestor, replay/lost ack and caught late-failure full rollback |
| Views/HTTP                    | `modules/wallets/wallet-projections.integration.test.ts`; `modules/referrals/referral-tree.integration.test.ts`; `modules/subscriptions/subscriptions-http.integration.test.ts`; existing auth/admin/app/OpenAPI tests      | Exact conservation/neutral reservations/aggregate totals; owner/admin allowlists, CSRF/session/forged inputs, foreign IDs, bounded root levels/history, filtered totals/pages/inserts                                   |
| **Gate B - backend accepted** | All above and affected predecessor lint/types/build/integration                                                                                                                                                             | All backend operations/views complete and migrated real DB evidence passes, no unresolved required finding. Only then frontend work starts                                                                              |
| Adapters/intent               | Colocated proposed `*.api.test.ts`, `*.hooks.test.tsx`; employee purchase runtime/money-display tests; existing transport/Query/session regressions                                                                         | Exact requests/formatting, malformed success, no retry/offline queue, remount/double-submit/unknown, stale account/root/filter/check admission, validated invalidation/dirty drafts                                     |
| Screens/dialogs               | Proposed employee `components/packages/{package-upgrade-modal,packages-screen}.test.tsx`, `team/team-screen.test.tsx`, `wallet/wallet-screen.test.tsx`; admin package/referrals/finance screen tests; existing account test | Full quote/top-up/terms/sources, reason/review, current vs saved rates, paging/detail, truthful empty/error/denial/conflict/pending/uncertain, accessible focus/handlers                                                |
| Browser/checkpoint            | `apps/web/e2e/packages-and-subscriptions.spec.ts`, `wallet-and-ledger.spec.ts`, `referrals.spec.ts`; existing ui-preservation suite/API fixture support                                                                     | Persisted purchase/edit/reload/reconciliation/root/ownership; six routes/account regions; focused 320px, representative 390/430px/desktop Arabic/RTL/Cairo/focus; P03 regressions                                       |
| **Gate F - complete P04**     | Full current unit/integration/lint/types/build/build-output and full E2E plus both E2E type scripts                                                                                                                         | Gate B remains satisfied; frontend persisted/browser acceptance and full checkpoint execute. Required failed/unavailable checks keep P04 incomplete                                                                     |

API paths abbreviated in the table are under `apps/api/src/`; web tests are under the corresponding existing feature. Full proposed tests/commands are in [quickstart.md](quickstart.md).

Use real migrated PostgreSQL, distinct connections and explicit lock/start barriers for races, injected clocks, and controlled late callback/database failures for rollback. Inspect all purchase/subscription/decision/operation/posting/request-alias/audit counts and every source. No mocked transaction evidence. Real HTTP guards/redacted errors and isolated ledger-funded browser fixtures are required. Retained foreign keys may require bounded fixture cleanup changes; never disable history guards or delete unrelated data to pass.

Apply code/test/security/React/browser/docs skills at relevant implementation batches; those future reviews are not claimed as executed by PLAN. Docker/Postgres/browser/ports availability and fresh predecessor regressions remain execution gates.

## Risks and Open Execution Gates

- Backend, frontend and full P04 checkpoint are unexecuted. Planning and recorded predecessor results do not prove P04 behavior.
- Live offset pagination is dynamic; implementation must preserve scoped refresh/out-of-range recovery and matching per-response totals.
- Retained history affects migration inventory/test cleanup. Preserve sponsor/auth/ledger incident regressions and distinguish named constraint failures from replay.
- One-admin/no-2FA and compromised-admin/host risks remain for independent launch review; no security/return guarantee.
- Presentation beyond C1-C2 needs an owner decision. Newly missing required surfaces cannot be silently added or requirements dropped.

## Complexity Tracking

No constitutional violation requested. Persisted quote + buyer sequence are minimal durable review/replay guards; compound ledger and partial CURRENT index reuse existing owners. Counters/snapshots avoid version registries. No waiver applies.
