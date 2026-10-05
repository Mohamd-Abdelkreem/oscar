# P04 Data Model

**Status**: Proposed design; no schema/migration applied. Existing User/AuthSession/Wallet/FinancialOperation/RequestIdentity/LedgerPosting/ReservationAllocation/AuditRecord foundations retain checks, append-only guards and immutable sponsors. See [plan.md](plan.md) and [HTTP](contracts/http.md).

New record IDs are UUID unless stated. Money is bounded bigint micro-USDT, positive where specified; rates are integer bps 0..10000. Instants are UTC timestamptz, work dates date-only Baghdad. Financial-history relationships use Restrict, never cascade deletion. Typed financial/date columns support constraints; validated snapshot JSON is not the sole financial authority.

## Package (`packages`, proposed)

Fields: stable `code` primary key S1/S2/O1/O2/A1; unique fixed `tierOrder` 1..5; positive `priceUnits`, `dailyRewardUnits`; positive integer `countedWorkDates` with representable resulting calendar/conditional gross; `withdrawalFeeBps`; `version >=1`; `updatedAt`; `updatedByUserId` nullable for initial migration, current admin for edits.

Duration/version use proposed PostgreSQL Int bounds 1..2147483647; a fresh edit's expected version is at most 2147483646. Positive price/reward and bigint reward*duration fit the existing signed-int64 micro-USDT amount range. Resulting Baghdad dates and UTC instants stay in the existing calendar's supported years 0001..9999. Apply these representation checks during configuration acceptance and again at quote/commit, with no invented commercial cap.

Initial prices 60/120/600/1200/2600 and rewards 2/4/16/38/67 USDT, 365 work dates, fee 2100 bps. Conditional gross 730/1460/5840/13870/24455. Codes/order cannot be edited, added/deleted/disabled by P04. Counters increment without reset/wrap. No PackageVersion table.

## ReferralSettings (`referral_settings`, proposed)

Singleton `id=1`, `version >=1`, five level bps fields, `updatedAt` and admin `updatedByUserId` with initial null. Rates start 1200/600/400/200/200. Each rate follows existing bps range; no unapproved sum/compression rule. Purchases save the set/version. General settings-screen integration is P10.

## ConfigurationChange (`configuration_changes`, proposed)

Immutable `id`, `actorUserId`, `commandId` UUID, `targetKind` PACKAGE/REFERRAL_SETTINGS, conditional `packageCode`, `intentHash`, `expectedVersion`, `committedVersion`, `reason` 1..500 non-whitespace characters, `beforeSnapshot`, `afterSnapshot`, `occurredAt`. Snapshot contains only allowed configuration/counters, never auth/provider secrets. Unique `(actorUserId,commandId)`; changed target/intent conflicts. Named checks enforce target shape and committedVersion=expectedVersion+1. Edit and audit commit together; replay maps saved change, not current settings.

Index actor/command and target/time/id. Protect UPDATE/DELETE/TRUNCATE. UUID is intent identity, not permission. Existing source-specific corrections retain financial AuditRecord/reference semantics; no fake money operation for configuration.

Replay lookup under the actor/target lock barrier precedes current-version checks. The configuration service uses fresh post-lock ReadCommitted observations for save/retry: with no saved command, a greater target version proves a matching original expected-version intent is superseded. CONFIGURATION_SUPERSEDED is a derived rejection from the original PATCH, not a persisted negative command record or cancellation. Equal version may accept the exact original retry once; lower version and failed observation remain nonterminal. Target counters never decrease or wrap, and conditional update plus audit stays atomic.

## PurchaseQuote (`purchase_quotes`, proposed)

| Field                                               | Rule                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| id, buyerId, packageCode                            | Owned server-generated quote; current USER authority at create/consume |
| createdAt, expiresAt                                | Server creation, exclusive ten-minute review deadline                  |
| packageVersion, referralSettingsVersion             | Saved current counters                                                 |
| savedRatesBps                                       | Immutable five-rate snapshot in L1-L5 order matching saved version     |
| expectedBuyerPurchaseSequence                       | Latest committed sequence; zero before first purchase                  |
| observedSubscriptionId                              | Nullable CURRENT row, including logically expired row                  |
| action                                              | PURCHASE/UPGRADE based on effective membership                         |
| acceptedTerms                                       | Typed immutable terms described under Subscription                     |
| walletSnapshot                                      | Four source components + total ownership                               |
| fullDebitUnits, usableUnits, topUpUnits             | full price, available sum, max(0,price-usable)                         |
| fundedReferralUnits, fundedNonReferralUnits         | Partial funding, unreserved referral first                             |
| firstWorkDate, finalWorkDate, subscriptionExpiresAt | Disclosed term preview, recomputed before commitment                   |
| intentHash                                          | Canonical accepted intent fingerprint, internal only                   |

Funded components sum to min(full debit,usable); funded total+top-up=full debit. No reserve/spend/membership write. Partial funding uses its own contract, not full sourceAllocation. Immutable; index buyer/time/id and justified expiry lookup. No cleanup worker in P04. Quote ID grants no authority. Committed replay/reconciliation survives quote expiry; fresh consumption must match saved state/counters/date preview. EXPIRED_UNCOMMITTED is a derived terminal read only after the shared buyer lock excludes ongoing purchase and fresh post-lock ReadCommitted lookup/time confirms expiry with no purchase; no quote mutation or cancellation/refund occurs.

## Purchase (`purchases`, proposed)

Immutable fields: `id`, unique `quoteId`, `buyerId`, positive bigint `buyerSequence`, `action`, `packageCode`, nullable `previousSubscriptionId`, unique `debitOperationId`, `purchasedAt`, typed `acceptedTerms`, `fullDebitUnits`, `sourceReferralUnits`, `sourceNonReferralUnits`, `commissionBaseUnits`, `referralSettingsVersion` and saved rates.

Unique `(buyerId,buyerSequence)` and `(id,buyerId)`. Quote expected sequence leads to expected+1 under buyer lock. Indexed latest buyer sequence avoids full-history scan. Price equals full debit >0; nonnegative sources sum to full debit; commission base is full price for PURCHASE or max(0,price-prior saved price) for UPGRADE. Previous subscription/quote/debit wallet ownership must agree through composite references/narrow insert guards. Debit must be PURCHASE_DEBIT/PACKAGE_PURCHASE, namespace `p04.purchase`, key quote ID, on buyer wallet.

Result maps immutable purchase-time terms/dates and stateAtPurchase=CURRENT, saved decisions and debit outcome, never mutable subscription lifecycle/current catalog/wallet. Live subscription state is a separate membership/history field. Validated JSON snapshots store canonical decimal strings, not JSON bigint or floating money; typed columns remain authoritative for constraints. No partially committed PENDING purchase row; commit is atomic while client observation can be uncertain. Protect snapshot/history mutation including TRUNCATE. Do not synthesize history from fixtures.

## Subscription (`subscriptions`, proposed)

`id`, `ownerUserId`, unique `purchaseId`, `packageCode`, immutable accepted terms, `activationAt`, `firstWorkDate`, `finalWorkDate`, `expiresAt`, `state` CURRENT/REPLACED/EXPIRED, nullable `replacedAt` and `replacementPurchaseId`. Unique `(id,ownerUserId)`, same-owner purchase references, owner/activation/id index and named partial unique `subscriptions_one_current_per_owner` WHERE state=CURRENT.

CURRENT denotes unreplaced term; effective active additionally requires activation<=now<expiry. An expired CURRENT reads Free without maintenance; the next purchase lazily transitions to EXPIRED. Active upgrade transitions to REPLACED then creates a full new term. Lifecycle writes cannot alter terms/dates. REPLACED needs later same-owner replacement/time; EXPIRED transition observes saved boundary; terminal rows cannot revive. Protect narrow transitions/immutability with SQL guards and checked conditional writes, not now-dependent index.

Accepted terms: code/tierOrder, purchased price, daily reward, counted duration, fee bps, package counter, zone Asia/Baghdad, Monday-Friday calendar, 18:00 first-date cutoff and exclusive-expiry policy. Save activation separately from first counted date. Missed work dates still count. P04 never resets task claims, posts task rewards or cancels an existing eligible reservation.

## ReferralDecision (`referral_decisions`, proposed)

| Field                                        | Rule                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| id, purchaseId, recipientUserId              | Event and existing ancestor                                                         |
| level                                        | Actual relative 1..5                                                                |
| decision                                     | AWARDED / ELIGIBLE_ZERO / SKIPPED                                                   |
| skippedReason                                | FREE / EXPIRED / BANNED / ACCOUNT_UNAVAILABLE, only SKIPPED                         |
| zeroReason                                   | ZERO_BASE / ZERO_RATE / FLOORED_ZERO, only ELIGIBLE_ZERO                            |
| rateBps, commissionBaseUnits, awardUnits     | Saved exact event values; eligible award floor(base*rate/10000)                     |
| recipientSubscriptionId, eligibilitySnapshot | Observed membership/expiry/account role/status/version/verification; no credentials |
| creditOperationId                            | Unique and required only AWARDED; recipient's REFERRAL credit                       |
| occurredAt                                   | Same purchase event instant                                                         |

Unique `(purchaseId,recipientUserId,level)` and `(purchaseId,level)`. Missing ancestors produce no owed row. SKIPPED/ELIGIBLE_ZERO have zero/no credit; AWARDED positive/credit. Insert positive decision only in credit callback; do not insert then update immutable history. Credit origin REFERRAL_COMMISSION, namespace `p04.referral`, business key purchase/recipient/level. Owner/amount/origin links receive named guards.

Index recipient/time/id and purchase/level. No compression/redistribution/backfill. Withdrawal-only block is not independent accrual denial. Otherwise eligible recipient without wallet causes total rollback.

## Existing Wallet/Ledger and Read Models

No second wallet/balance setter. All four source bounds, request aliases, operation uniqueness, posting shapes, reservation exact allocation/release and append-only audit survive. Purchase consumes referral available then other available. Expiry changes eligibility without reclassification/erasure.

Read DTOs add effective membership/purchase funds/referral lock and separate account/withdrawal restriction. One history row per operation, detail with source deltas; sum available+reserved movement for ownership credit/debit. RESERVE/RELEASE are neutral. Multi-wallet/history sums use exact SQL numeric plus separate nonspendable aggregate schema/formatter, at most 38 micro-unit digits; command/wallet int64 bounds stay unchanged.

AdminCatalogItem wraps current PackageTerms with live activeSubscriptionsCount, aggregated by saved subscription package code using CURRENT plus activation<=serverNow<expiry. It is not a stored package counter or purchase snapshot. AdminFinancePage.summary adds neutralOperationsCount: distinct matching RESERVE/RELEASE operation IDs before pagination, independent of posting multiplicity. Both counts are nonnegative safe integers from successful consistent SQL observations; no full employee/history payload or guessed zero is needed.

Employee team is self-root name/joined/package/relative level/viewer-attributable earnings, without descendant email/wallet/private earnings. Admin DTO separately permits identity email/path and totals. Levels are relative query results, not permanent User fields; sponsor stays immutable. Paginated projections are live with consistent per-response rows/counts/summary and explicit refresh recovery.

## Migration and Retention

Proposed `packages/database/prisma/migrations/20261004000000_packages_referrals_wallet/migration.sql`; use next unused timestamp if occupied at implementation. Never rewrite applied history. Add tables/checks/owner links/state index/guards/query indexes and approved initial package/rate data. Existing employees stay Free without an actual purchase; do not invent terms/awards or reset auth/wallets/sponsors.

Update inventory/migration tests deliberately: fresh deploy, populated P01-P02 upgrade, repeat deploy, retained identities/sources/reservations/history, owner/reference failures, one-CURRENT uniqueness, snapshot rejection and late-failure rollback. Immutable tables constrain fixture cleanup: isolated identities/business keys/disposable DBs; no disabled triggers/cascading historical deletes.
