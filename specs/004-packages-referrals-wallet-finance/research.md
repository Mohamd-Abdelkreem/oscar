# P04 Research Decisions

**Date**: 2026-10-04. Research/design only; no application tests or implementation. See [spec.md](spec.md) and [plan.md](plan.md) for intent/gates. Three read-only research agents inspected transaction/persistence, frontend/harness and security/library boundaries. All eight engineering guides, constitution and roadmap were read. Current source supersedes historical inventories. No unresolved planning clarification remains.

## 1. Compound financial transaction

**Decision**: Existing `LedgerService.runInTransaction(context, work)` with sequential transaction-bound debit/credit; domain writes in child callbacks, positive award decision inserted in its credit callback.

**Rationale**: `ledger.service.ts` supplies same transaction and rollback-only caught failure; `ledger.transaction.ts` supplies ordered locks, Serializable, three narrow conflict attempts, maxWait 5000/timeout 10000. P01 T039-T040 records persisted regressions. No additional financial owner is needed.

**Alternatives considered**: Delayed award job/outbox, separate transactions or ad hoc Prisma transaction duplicate infrastructure or weaken event-time atomicity. Nested/overlapping children are rejected; caught direct transaction writes outside children do not receive child poison protection.

**Evidence**: Existing `apps/api/src/modules/ledger/` owners; [Prisma ORM v7 transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions), [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html) and [isolation](https://www.postgresql.org/docs/18/transaction-iso.html). Installed 7.9.1/project source wins; unversioned ORM8 examples are unsuitable.

## 2. Durable quote and buyer generation

**Decision**: Owned immutable quote, ten-minute review expiry, unique purchase/quote and unique buyer purchase sequence. Snapshot expected prior sequence/effective membership/disclosed components and terms. Preserve quote ID across uncertainty.

**Rationale**: Independent quotes from one generation cannot both commit under buyer lock; later renewal advances generation. Persisted review identity provides reconciliation without a membership pointer/version registry. HTTP request aliases supplement business identity.

**Alternatives considered**: Request-key-only duplicates with a new key; quote-only permits two distinct reviewed transitions. Stateless signed tokens still need durable consumption/recovery and introduce signing config. Public partially committed PENDING purchase is unnecessary.

## 3. Replay before staleness, through alias protection

**Decision**: Current authority, recorded purchase, transaction-bound debit with saved identity/amount and incoming key, then immutable event subscription stateAtPurchase=CURRENT/outcome with no award children. Live NOT_OBSERVED remains uncertain. Outcome reads share buyer lock and use fresh post-lock ReadCommitted lookup/time; expired absent result is EXPIRED_UNCOMMITTED because an ongoing purchase has finished and delayed future command fails its post-lock expiry check. No quote mutation/cancellation.

**Rationale**: Current catalog/expiry cannot invalidate historic success. Direct stored-result return would bypass existing ledger request-key/payload conflict/binding. Saved wallet-after is event history; refresh live balances.

**Alternatives considered**: Re-award, replacement quote after timeout, timer success or presumed refund contradict FR-021-023.

## 4. Current authority and one event instant

**Decision**: Declare all immutable ancestor users/existing wallets, ordered ledger locks, actor session lock and current `readSessionAuthority`, consistent package/settings locks, one event instant per attempt for every saved effect.

**Rationale**: Current auth middleware checks persisted AuthSession; P02 writes share user/session lock order. Ancestors require current account/membership rather than sessions. Missing eligible recipient wallet is integrity failure. `ledger.effects.ts` converts unexpected ordinary guard errors to INTERNAL, so expected auth exceptions belong outside that wrapper or need typed LedgerError translation.

**Alternatives considered**: Middleware-only authority, delayed eligibility and browser/per-credit clocks permit race/inconsistent decisions.

## 5. Fixed-level zero/skipped outcomes

**Decision**: Immutable decisions at actual L1-L5; positive credits only. Save skipped/eligible-zero reason, event rate/base/eligibility. Full debit differs from positive prior-price-difference upgrade base.

**Rationale**: Existing positive ledger magnitude constraints remain. `percentageUnits` floors exact bigint bps; current rates start 1200/600/400/200/200. History must not be reinterpreted after reactivation.

**Alternatives considered**: Zero/negative financial operations, compression, redistribution or backfill violate financial rules.

## 6. Existing calendar and explicit current state

**Decision**: Backwards-compatible counted-duration parameter/default 365 in `BusinessClock.subscriptionTerm`, bounded whole-week/remainder calculation and resulting date/gross validation. Effective expiry is derived even while CURRENT awaits lazy EXPIRED transition. Named partial CURRENT uniqueness.

**Rationale**: Existing calendar implements approved cutoff/weekend/exclusive rules but hardcodes duration. No new calendar dependency/worker is necessary. [PostgreSQL partial indexes](https://www.postgresql.org/docs/18/indexes-partial.html) support a state predicate; `now()` is not an appropriate active-index predicate.

**Alternatives considered**: Elapsed calendar year, price-ordered tier or cron as entitlement authority are wrong or unnecessary.

## 7. Focused configuration counter/audit

**Decision**: Five stable package rows, singleton referral settings, simple counters, reason/confirmation/expected-version/actor-command identity and immutable before/after configuration change. General settings UI remains P10.

**Recovery amendment (2026-10-04)**: Freeze the original reviewed configuration intent across dialog close/remount and allow an explicit same-intent retry. Current authority and matching saved-command lookup precede version checks under compatible actor/target locks with fresh ReadCommitted reads. Absent saved command plus greater target version yields CONFIGURATION_SUPERSEDED for that original PATCH; monotonic counters and the same locked conditional update prevent delayed execution. NOT_OBSERVED, lower/equal-version absence, failed barriers or unavailable exact payload remain uncertain. No extra intent table, cancellation endpoint, stored negative result or automatic replay is required. Representation bounds are the current money/bps/calendar limits plus proposed PostgreSQL Int counters/duration, rather than commercial caps.

**Rationale**: Financial audit currently belongs to a money operation; fake zero operations for catalog edits are inappropriate. Focused configuration history supports future-only edits and uncertain response recovery without a version registry.

**Alternatives considered**: PackageVersion subsystem, rewriting subscription terms or adapting unrelated identity audit semantics expand scope or falsify history.

## 8. Bounded live projections and aggregates

**Decision**: Existing page/limit metadata, stable unique sort, SQL scope/filter/count and RepeatableRead rows/count/summary. Live across requests; refresh/out-of-range recovery, no frozen-session claim. Separate exact nonspendable aggregate decimal contract bounded to 38 micro-unit digits.

**Presentation amendment (2026-10-04)**: Admin catalog returns AdminCatalogItem with live effective activeSubscriptionsCount outside immutable PackageTerms. Admin finance summary supplies distinct neutralOperationsCount after all operation filters and before pagination. Preserve the existing column/metric with consistent server observations, including expiry/upgrade and multi-page/posting cases, rather than fixture or page-only counts.

**Rationale**: Existing pagination is page 1/default 25/max 100/zero pages. SQL aggregate numeric can exceed a single-wallet int64 total; read formatting must not overflow/coerce to Number. Team levels are root-relative query results; employee root is self, bounded L5 members; admin totals use SQL aggregates.

**Alternatives considered**: Full-history/tree client loading, page-only totals, silent int64 aggregate overflow and persistent snapshot subsystem are wrong or unnecessary for this scope.

## 9. Scoped integration, exact display and fixture preservation

**Decision**: Feature APIs/hooks plus focused remount-safe purchase runtime and required verified opaque per-account quote handle before dispatch, claimed under account-scoped Web Lock. Existing handles block new intents across reload/tabs; no private payload/credential storage. Adapt C1-C2 surfaces only. Decimal-string display with legacy number compatibility; omit employee descendant email/private earnings. Retain future-domain fixture providers and existing finance/within-team search via SQL-bounded q filters.

**Rationale**: Six screens remain fixture-driven; account financial cells are unavailable. Number-based MoneyAmount and fixture providers still serve later domains. Member-row renders name/joined/package/level/viewer-attributable commission, not email. C1-C2 allow bounded copy/control corrections, not global redesign.

**Alternatives considered**: Global financial context, whole-provider removal, broad visual extraction or Number money conversion violate scope/exactness.

## 10. Financial retry and response admission

**Decision**: retry:false + networkMode:always; no offline/persisted/resumed mutation or mutation-scope queue. P04 writes stay outside existing 401 replay allowlist. Malformed success is uncertain. Read admission checks session check/account/role/epoch/selection and consumes AbortSignal.

**Rationale**: Installed query-core 5.101.4 pauses/resumes online-mode initial dispatch even with retry:false; mutation scope queues rather than rejects duplicates. Existing runtime epoch/account/role check alone misses a same-epoch revalidation check change. Credential-command mount patterns lack financial recovery identity and discard obsolete observation.

**Alternatives considered**: Optimistic money, component-only pending, automatic 401/offline replay, cancellation alone and universal credential/financial framework fail requirements.

**Evidence**: [TanStack v5 cancellation](https://tanstack.com/query/v5/docs/framework/react/guides/query-cancellation), [mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations), installed retryer/mutation and current transport/session owners. Installed Next 16.2.12 server/client, App Router useRouter and React Compiler guides were inspected; router refresh does not replace Query invalidation.

## 11. Existing real harnesses and security scope

**Decision**: Reuse migrated PostgreSQL Testcontainers and P03 real Chromium web/API/DB harness. Explicit full E2E + both E2E type scripts at checkpoint. Apply security-best-practices Express/Next/React/general frontend with one-admin/no-2FA and frozen-UI overrides.

**Rationale**: Current manifests already register Playwright 1.63.0 and scripts. Root verify omits browser acceptance. P01-P03 final recorded results are planning prerequisites, not fresh P04 tests. Real isolated ledger-funded fixtures do not claim chain deposits. Preserve auth/CSRF/limits/no-store/projections/redaction/current authority; no signer/key/provider introduced.

**Alternatives considered**: Duplicate test runner, mocked Prisma for money, developer DB fallback, screenshots/format checks as acceptance, new 2FA/dual approval or security guarantees are insufficient or out of scope. Backend/frontend execution and independent launch/custody/recovery remain gates.
