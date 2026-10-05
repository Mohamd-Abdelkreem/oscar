# Feature Specification: P04 - Packages, Referrals, Wallet, and Finance

**Feature Branch**: `003-auth-account-frontend` (existing branch; no branch-creation hook is configured)

**Created**: 2026-10-04

**Status**: Requirements reviewed; pre-implementation artifact findings resolved. Application implementation and acceptance gates remain pending.

**Input**: User description: "PHASE_ID=P04. Read docs/workflow/speckit-prompts.txt. Apply OPERATING CONTRACT and execute SPECIFY only."

**Roadmap Phase**: P04 - Packages, Referrals, Wallet, and Finance

**Feature Directory**: `specs/004-packages-referrals-wallet-finance`

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: One specification for the merged current P04 (original P04 + P05): package catalog and allowed configuration, purchase quotes, full-price purchases/upgrades, subscription terms and expiry, fixed-tree referral awards and skipped decisions, authorized wallet/ledger/subscription/referral views, and audited source-preserving adjustment primitives; then integrate employee packages/team/wallet, the existing account subscription/wallet values and links, and admin packages/referrals/finance. Scope is governed by [PLAN.md](../../PLAN.md), Sections 3.2-3.4, 3.8, 4, 5.2, 5.4, 6, 7/P04, 8 and 9.
- **Exclusions**: Recreating P01 money/calendar/ledger or P02-P03 identity/authentication; task publication/submission/review/reward workflows (P05); chain deposits, custody and the manual-credit endpoint (P06-P07); withdrawal requests, address management, scheduling and payouts (P08-P09); employee-detail adjustment UI, cross-domain settings/dashboard/account completion and policies (P10); deployment/recovery/release (P11). No package cancellation/refund, active same-package renewal, downgrade, sponsor reassignment, commission backfill/compression, leadership bonus, KYC, single-person account ban, admin 2FA or dual approval. Do not remove fixture providers still used by future domains. No deployment, mainnet transfer, real funds, commit or push.
- **Prerequisites**: The populated [constitution](../../.specify/memory/constitution.md) is version 1.0.0. [P01 task evidence](../001-financial-backend-foundation/tasks.md) records completed foundation and T039-T040 rollback/error remediation; [P02 acceptance](../002-identity-admin-backend/quickstart.md) records T001-T067 completion and real persisted financial/identity regressions; [P03 acceptance](../003-auth-account-frontend/quickstart.md) records T001-T065 completion, current producer checks and 48 passing browser scenarios. These are reused recorded local results, not fresh execution in SPECIFY or production approval. Older unresolved-admin-login statements are superseded for that specific surface by P03's recorded owner decisions and existing implementation. Fresh prerequisite regressions remain required during P04 implementation.
- **Frontend boundary**: Preserve the six existing P04 domain routes, existing account domain regions, URLs, navigation, layouts, popups, static copy, Arabic/RTL/Cairo/light appearance, icons, sizes, spacing and breakpoints. Runtime values and authorized handlers may replace fixtures. P03's bounded authentication/management exceptions do not authorize P04 presentation changes. Apply only the P04 C1-C2 exceptions accepted below under the current owner's delegated MVP choices; all other presentation remains frozen.
- **Owner decisions**: C1-C2 are resolved on 2026-10-04 using the owner's instruction to select recommended MVP choices. C1 permits bounded truthful P04 financial copy; C2 permits only required controls/feedback in existing surfaces. Both preserve mandatory financial/security behavior, complete P04 scope and the remaining frontend freeze.
- **Acceptance gate**: Complete and test the entire package/purchase/subscription/referral/wallet backend group before any dependent frontend integration. Then integrate existing surfaces within the accepted C1-C2 exceptions, pass their persisted/browser acceptance and the first full current regression checkpoint required by Section 9. Backend acceptance alone does not complete P04. Missing required infrastructure, execution evidence or an owner decision leaves the relevant gate open.

Apply the constitution and [operating contract](../../docs/workflow/speckit-prompts.txt). All eight [engineering guides](../../docs/engineering/README.md) were read. Their original pre-P01 inventories do not describe today's source. The earlier CLARIFY run changed only this specification and permitted built-in requirements-checklist markers. The owner-authorized pre-implementation amendment on 2026-10-04 resolves analysis I1/I2/U1 in this feature's artifacts and reviews requirements quality; it executes no application tasks.

### Actors and Current Capability

Actors are an active verified employee purchasing or inspecting their own funds/team; ancestors whose event-time membership/status determines commission eligibility; and an active verified administrator configuring packages or inspecting authorized finance/referral records. Suspended/banned/deactivated or revoked identities cannot exercise protected authority. Task-only and withdrawal-only restrictions do not become unapproved purchase bans; withdrawal-only restrictions do not independently prevent referral accrual.

Source inspection on 2026-10-04 establishes existing foundations and gaps, without claiming new P04 behavior is implemented:

| Evidence owner                                                                                                                                                                                                                                                                                                                                                    | Current capability / remaining gap                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Current persistence](../../packages/database/prisma/schema.prisma), [financial contracts](../../packages/contracts/src/financial/financial.schema.ts), [ledger service](../../apps/api/src/modules/ledger/ledger.service.ts), [business calendar](../../apps/api/src/core/business-calendar/business-clock.ts)                                                   | Exact-money/calendar/source-aware ledger, reservations, corrections, audit and request identities exist. Package, purchase, subscription and referral-award records remain P04 deliverables.              |
| [Current API composition](../../apps/api/src/router.ts)                                                                                                                                                                                                                                                                                                           | Shared identity, employee and administrator boundaries exist; P04 domain operations/views are not registered.                                                                                             |
| [Existing admin login](../../apps/web/src/app/admin/auth/login/page.tsx), [P03 acceptance](../003-auth-account-frontend/quickstart.md)                                                                                                                                                                                                                            | Dedicated admin entry and protected identity integration exist; do not recreate the historic missing-login conflict.                                                                                      |
| [Employee package sheet](../../apps/web/src/features/employee/components/packages/package-upgrade-modal.tsx), [local package actions](../../apps/web/src/features/employee/context/actions/use-employee-package-actions.ts)                                                                                                                                       | Purchase presentation/action still uses local fixtures, a discounted upgrade and timed apparent success. Those behaviors are superseded by the full-price, persisted P04 requirements.                    |
| [Wallet](../../apps/web/src/features/employee/components/wallet/wallet-screen.tsx), [team](../../apps/web/src/features/employee/components/team/team-screen.tsx), [admin finance](../../apps/web/src/features/admin/components/finance/finance-ledger-screen.tsx), [admin referrals](../../apps/web/src/features/admin/components/referrals/referrals-screen.tsx) | Approved screens exist; domain lists, totals and root selection still use fixture/local authority. Finance has existing paging; employee histories and referral views need C2 integration.                |
| [Admin package editor](../../apps/web/src/features/admin/components/packages/packages-screen.tsx), [account](../../apps/web/src/features/employee/components/account/account-screen.tsx), [web manifest](../../apps/web/package.json)                                                                                                                             | Package edit fields/modal exist without the required reason workflow; account financial values are deliberately unavailable pending domain integration. A registered browser-test harness already exists. |

### Owner Decision Gates

**C1 - Financial meaning in frozen presentation (resolved 2026-10-04).** At clarification, the existing upgrade sheet describes a prior-price discount and an administratively pending term; package income labels omit conditional-work meaning, admin referral text hard-codes initial rates, and finance text advertises reward reversal. These source behaviors remain implementation gaps.

Accepted recommended MVP choice: permit only the contradictory P04 financial wording and meaning to be corrected within existing package cards/sheet, wallet/ledger details, team/referral views and admin package/finance views. Present the full target-price debit and exact top-up, immediate activation and a fresh accepted work-date term, conditional gross before package cost/fees, current versus saved historical rates/terms, source locks/reservations and supported ledger meanings. Final task approval has no reversal flow. Preserve existing routes, section order, visual components, styling and dimensions; unrelated copy remains frozen. This bounded P04 exception is selected under the owner's instruction to choose recommended MVP answers automatically.

**C2 - Required controls and feedback in existing surfaces (resolved 2026-10-04).** At clarification, the existing admin package editor saves without an entered financial-action reason or a distinct confirmation; employee wallet/team and admin referral histories lack paging, and several views lack safe live read/failure states. These remain implementation gaps.

Accepted recommended MVP choice: reuse or minimally adapt established controls within the six existing P04 domain screens, their dialogs and in-scope account regions. Collect a reason and provide a distinct review/confirm step within the existing admin package-edit dialog before submission; provide bounded history paging and root search using existing control styles; and show loading, genuine empty/filter-empty, unavailable/denied, retry, stale conflict, pending and uncertain results. Show current accepted terms, exact expiry, source eligibility/locks and reservations in existing summary/detail areas. Permit only the minimal local space and necessary Arabic labels needed for these controls/feedback, preserving section order, Arabic/RTL/Cairo/light styling, breakpoints, navigation and unrelated dimensions. Add no route, standalone screen or new/redesigned popup. Preserve dirty drafts and prevent stale/private response admission, invented zeros, truncated history and automatic financial replay. Cross-domain settings and employee-adjustment UI remain P10. Presentation outside these listed exceptions remains gated by the frontend freeze.

## Clarifications

### Session 2026-10-04

The owner instructed CLARIFY to select recommended MVP choices automatically. These answers record only the bounded P04 exceptions described in the existing owner-decision gates.

- Q: May P04 correct contradictory financial wording in existing surfaces despite the static-copy freeze? → A: Permit bounded P04 truthful-copy corrections in the existing package, wallet/ledger, team/referral and admin package/finance surfaces; show full-price purchase, immediate activation, accepted work-date terms, conditional gross, current/historical rates and supported ledger meanings while preserving routes, layout, styling and unrelated copy.

- Q: May P04 adapt existing screens/dialogs for required confirmation, reasons, paging and live feedback? → A: Permit minimal established controls within existing P04 surfaces: an entered reason and distinct review/confirm step in the package-edit dialog, bounded paging/root search and truthful read/conflict/pending/uncertain feedback plus terms/source details. Allow only necessary local space/Arabic labels; preserve visual style and navigation without adding routes, screens or popups.

## User Scenarios & Testing _(mandatory)_

Every implementation group must create or extend actual automated test files and record executed results. Financial conservation, race and rollback acceptance must exercise real migrated persistence; browser acceptance must use the registered real application harness. Planned tests, screenshots and fixture success do not establish either gate.

### User Story 1 - Buy or Upgrade at the Actual Full Price (Priority: P1)

An employee reviews current terms, purchase-eligible funds, source allocation and required top-up before authorizing a purchase that persists immediately.

**Why this priority**: The purchase controls membership and several financial effects; charging or awarding the wrong amount corrupts every dependent view.

**Independent Test**: With existing identity/ledger foundations and isolated funded employees, obtain a quote, purchase and reload the authoritative result. UI acceptance additionally requires the backend gate and compliance with the accepted C1-C2 exceptions.

**Acceptance Scenarios**:

1. **Given** a Free employee with 20 USDT usable funds, **When** they buy a 20 USDT package, **Then** exactly 20 is debited and one new paid term is active immediately without admin approval.
2. **Given** active S1 bought for 60 and 40 usable funds, **When** O1 costs 600, **Then** the quote requires a 600 debit and 560 top-up; it cannot charge only 540 or credit the prior purchase.
3. **Given** 30 unreserved referral and 70 other funds, **When** a 20 purchase succeeds, **Then** referral becomes 10, other remains 70, total becomes 80 and every reserved component is unchanged.
4. **Given** an active subscription, **When** its same package or a lower tier is requested, **Then** the request is rejected without financial/subscription/commission effects; after expiry, a new purchase of the same package is permitted.
5. **Given** two competing purchase requests or a replay using another request key for the same purchase, **When** they execute, **Then** at most the allowed subscription transition succeeds, funds cannot be overspent and no purchase or award duplicates.
6. **Given** a purchase commits but its response is lost, **When** the employee reloads or reconciles that purchase, **Then** the recorded outcome is shown without a second debit, replacement purchase or guessed failure.

### User Story 2 - Award Only Eligible Fixed-Level Commissions (Priority: P1)

Eligible ancestors receive the exact commission belonging to their fixed sponsor-tree level at the purchase event; skipped levels remain explainable.

**Why this priority**: Awards are owned money and must not depend on a delayed job, future reactivation or a compressed tree.

**Independent Test**: Fund a buyer below five known ancestors with controlled membership/status and rates; inspect purchase, awards, skipped decisions and recipients' balances.

**Acceptance Scenarios**:

1. **Given** S1's saved price of 60 and a target O1 price of 600, **When** the upgrade succeeds with an eligible L1 at 12%, **Then** the buyer loses 600, the commission base is 540 and L1 receives 64.8 USDT exactly once.
2. **Given** an ordinary purchase or post-expiry renewal, **When** it succeeds, **Then** its full purchased price is the commission base; an upgrade with a nonpositive price difference awards zero, never a negative amount.
3. **Given** an ineligible L1 and eligible L2, **When** a purchase succeeds, **Then** L1 is skipped and L2 retains its own level/rate; there is no upward compression or redistributed award.
4. **Given** a recipient is Free, expired at the exclusive boundary or banned at the event, **When** they later reactivate, **Then** the skipped event remains skipped; withdrawal-only restrictions alone do not invalidate otherwise eligible accrual.
5. **Given** an award/rate/eligibility write fails after an earlier purchase effect, **When** the operation ends, **Then** buyer debit, subscription, every award, ledger and required audit all remain unchanged.

### User Story 3 - Keep the Accepted Term Across Time and Edits (Priority: P1)

Employees retain the terms they purchased and see the correct first work date and exclusive expiry, including purchases outside task hours.

**Why this priority**: Membership determines benefits and referral eligibility; late expiry jobs or changed catalog terms cannot rewrite entitlement.

**Independent Test**: Use controlled Baghdad times and initial 365-work-date terms, then edit catalog terms and observe membership at both expiry sides.

**Acceptance Scenarios**:

1. **Given** a weekday purchase before 18:00 Baghdad, **When** it succeeds, **Then** membership activates immediately and that date is the first counted work date; exactly 18:00 or later starts on the next work date, and a weekend purchase starts counting Monday.
2. **Given** the initial duration is 365 Monday-Friday work dates, **When** the term is calculated, **Then** Saturdays/Sundays are excluded and expiry is the start of the calendar date immediately after the final counted work date; missed tasks do not extend it.
3. **Given** an active upgrade, **When** a higher tier is purchased, **Then** it replaces the old subscription and starts a fresh complete accepted term with its own price/reward/duration/calendar/fee snapshot.
4. **Given** later catalog edits or a delayed expiry job, **When** a sensitive operation observes the saved exclusive expiry, **Then** past terms remain unchanged and expired membership cannot authorize a new award or referral withdrawal eligibility. Balances/history remain owned.
5. **Given** a purchase outside task hours or a prior same-date task entitlement, **When** membership changes, **Then** P04 posts no task reward or daily-claim reset and creates no extra/weekend task opportunity; actual daily-claim enforcement remains P05.

### User Story 4 - Understand Owned, Available, Reserved and Locked Funds (Priority: P2)

Employees see their own wallet/history; administrators see authorized financial totals/details without double-counting reservations or exposing private internals.

**Why this priority**: Clear source-aware views prevent retained commissions, reserved funds and pending rewards being treated as interchangeable.

**Independent Test**: Prepare distinct available/reserved sources and immutable operations; inspect employee/admin projections and a reasoned correction. Live withdrawal/task creation is not a prerequisite.

**Acceptance Scenarios**:

1. **Given** an expired employee with 70 unreserved other funds and 10 unreserved referral funds, **When** the wallet is read, **Then** ownership includes both, purchase eligibility includes both, and new-withdrawal eligibility excludes the 10 referral funds.
2. **Given** paid reactivation, **When** membership is observed, **Then** retained unreserved referral funds become eligible for future withdrawals without backfilled commission events or reclassifying them as deposits.
3. **Given** funds reserved by the existing foundation, **When** quoting a package or reading finance, **Then** reserved funds are excluded from spending and remain part of total ownership; reservation/release movements do not appear as a second income or expense.
4. **Given** an authorized source-specific adjustment with reason and reference, **When** it succeeds or is repeated, **Then** one new attributable correction is appended, reserved sources/history remain intact and no original receipt is rewritten or represented as a verified chain transfer.
5. **Given** another employee's wallet, purchase or ledger identifier, **When** an employee requests it, **Then** access is denied without disclosing private details; current administrators receive only their allowed financial projection.
6. **Given** multiple history pages and filters, **When** results are requested, **Then** ordering/totals match their declared scope and every authorized record is reachable without loading the entire history; unavailable results are distinct from a genuinely empty ledger.

### User Story 5 - Change Future Terms Without Rewriting Purchases (Priority: P2)

An administrator reviews current package settings, confirms an allowed edit and receives an attributable saved result; a stale quote/editor cannot silently accept changed terms.

**Why this priority**: Configuration must remain useful while preserving the buyer's accepted price and historic awards.

**Independent Test**: Edit current package/referral settings under authenticated administrator authority, then compare old snapshots and a new quote/event. Existing package editor integration follows C2's accepted reason/confirmation exception; the general settings UI remains P10.

**Acceptance Scenarios**:

1. **Given** a fresh initial catalog, **When** it is read, **Then** S1/S2/O1/O2/A1 show the approved prices/rewards and initial 365 work dates/21% fee, with conditional gross totals matching those terms.
2. **Given** an allowed admin edit, **When** it commits, **Then** current terms advance their change counter and actor/time/reason are recorded; prior purchase, reward, fee and commission decisions remain identical.
3. **Given** a quote/editor prepared before a material term or membership change, **When** submitted, **Then** it is rejected as stale or returned for review/reconfirmation; the system cannot debit newly changed terms silently.
4. **Given** two conflicting edits or an administrator losing authority before commitment, **When** saving, **Then** no unauthorized or lost-update save occurs and the losing attempt cannot create partial audit/financial effects.
5. **Given** changed future referral rates, **When** a later purchase succeeds, **Then** only that event uses the new rates and its views retain the saved historical rates for earlier awards.
6. **Given** an uncertain configuration save, **When** its original outcome is not observed, **Then** the original intent remains guarded; an explicit retry uses the same reviewed identity/payload and returns one committed edit or authoritative proof that a newer counter prevents that original intent from committing. Closing, remounting or losing local observation cannot authorize a replacement. Missing original payload or current authority leaves recovery read-only.

### User Story 6 - Use the Existing Screens Against Persisted Truth (Priority: P2)

Employees and administrators use approved package, team/referral and wallet/finance screens with current server outcomes and safe feedback.

**Why this priority**: P04 is incomplete until its tested backend is usable through the selected existing screens.

**Independent Test**: After backend acceptance, within the accepted C1-C2 exceptions, perform purchase and reads through real employee/admin sessions, reload and switch account/root/filter scopes.

**Acceptance Scenarios**:

1. **Given** successful backend acceptance and approved surfaces, **When** a purchase or package edit is confirmed, **Then** screens update only from the validated committed result or an authoritative reread; timers/local reducers cannot manufacture success.
2. **Given** a pending, stale, restricted, malformed or unavailable response, **When** interacting, **Then** approved feedback distinguishes that result without invented zero balance, Free membership, empty history or automatic financial replay.
3. **Given** Mohammed sponsors Ahmed and Ahmed sponsors Yasmin, **When** the employee root is Mohammed, **Then** Ahmed is L1 and Yasmin L2; selecting Ahmed as an authorized admin root makes Yasmin L1 and shows Ahmed separately from descendants.
4. **Given** logout, account switching or an admin root change during a request, **When** an older response arrives, **Then** it cannot populate the new scope or enable an obsolete write/detail action.
5. **Given** the integrated routes on phone/desktop, **When** navigating, filtering, inspecting detail and confirming, **Then** approved appearance, readable Arabic/mixed-direction amounts, accessible focus/actions and usable narrow layouts are preserved within explicit owner exceptions.
6. **Given** the existing admin package column and finance metric, **When** current data spans expiry, upgrades, filters or several pages, **Then** active subscription counts come from effective saved terms and neutral-operation counts cover all matching operations, without fixture values, page-only counts or removed presentation.

### Edge Cases

- Insufficient usable funds, zero top-up, a one-micro-USDT remainder, unsupported precision, overflow or a tampered price/amount produces the exact quote or safe rejection without partial writes. Purchase quotes do not themselves reserve/spend.
- Higher configured tier with a lower/equal edited price remains a tier upgrade; debit its full target price and floor the nonnegative price-difference commission base at zero. Tier identity is not inferred from current price.
- Buyer or recipient membership expires while a concurrent operation waits; evaluate current transactional authority/event-time eligibility, rather than an earlier page read or an expiry job.
- Opposing purchases, a purchase versus reservation/adjustment, and purchases sharing ancestors cannot overspend, duplicate awards or leave half a replaced subscription.
- Same request identity with changed intent conflicts; same purchase with another/missing client key still cannot duplicate effects. An intentional later post-expiry purchase is a distinct event.
- Failed dependency, unavailable persistence or a process crash before commitment leaves no successful partial purchase; lost acknowledgement after commitment is reconciled by the original identity.
- An unreceived configuration command may be explicitly retried with its unchanged reviewed intent; a committed lost acknowledgement returns that saved edit even after later counter changes. A newer locked target version can prove an uncommitted original intent is superseded; absent outcome, generic conflict/denial or missing original payload cannot prove it failed.
- Sponsor absence or fewer than five ancestors produces only existing levels; existing no-self/no-cycle/immutable-sponsor rules remain intact. Distinct same-person accounts are permitted.
- Free/expired funds remain owned; purchase reactivation must not consume reserved money, erase source locks or create awards for past skipped events.
- A filtered-empty or last/out-of-range page and simultaneous inserts must not fabricate totals, strand users or show a previous root's detail. Current rates and historical award rates are distinct.
- No chain, email, queue or testnet provider is required to approve a P04 purchase. A missing future deposit/payout service cannot be replaced with fake credit/payment; normal navigation to those existing routes does not activate their future workflows.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Deliver the complete current merged P04 with a tested backend gate before frontend integration and a separate complete P04 checkpoint afterward. Preserve exclusions, predecessor work and the accepted C1-C2 exception boundaries. (US6; scope/gates)
- **FR-002**: Every protected read/write MUST enforce current verified identity, role, active account/session, owned resource and applicable state at execution. Employees read/purchase for themselves; administrators use explicitly permitted configuration/finance/referral authority. No submitted actor or hidden control grants permission. (US4/AC5; US5/AC4)
- **FR-003**: Reject client-authoritative balances, entitlements, prices, calculated top-up, source allocations, commissions, sponsor changes and successful outcomes; derive them from accepted server terms/state. Preserve existing authentication, request protection, validation and redaction. (US1; edge cases)
- **FR-004**: Initialize S1/S2/O1/O2/A1 respectively at prices 60/120/600/1200/2600 USDT and approved-task rewards 2/4/16/38/67, initially 365 counted work dates and 21% withdrawal fee. Conditional gross totals are 730/1460/5840/13870/24455, assuming every eligible task is approved before cost/fees; no guaranteed return or calendar-year income claim. (US5/AC1)
- **FR-005**: Expose current package terms and allowed future-term settings with a change counter; preserve the configured tier order independently of edited price. Allowed edits apply only to new accepted operations and require current administrator authority, explicit confirmation, validated reason and attributable audit. (US5/AC2-4; C2)
- **FR-006**: Snapshot purchased package/tier, price, approved-task reward, counted duration/calendar, fee terms, purchase/activation time, first/final work dates and exclusive expiry. Later settings changes MUST NOT mutate historic purchase/subscription/award terms. (US3/AC3-4; US5/AC2)
- **FR-007**: Provide a current purchase quote identifying permitted purchase/upgrade, full debit, usable funds, referral-first proposed allocation, top-up=max(0, full target price minus usable funds), accepted terms and stale-state identity. A quote makes no financial or membership change. (US1/AC1-3; US5/AC3)
- **FR-008**: Revalidate quote terms, funds, membership and authority at commitment. Materially changed terms require a safe stale/conflict result or renewed review and confirmation; never silently purchase on changed terms. (US5/AC3-4)
- **FR-009**: Both purchases and upgrades MUST debit the full target price without prior-price credit, consume only unreserved referral funds first then other unreserved funds, and activate immediately without admin approval. External transfers must become wallet funds through their later verified deposit workflow first; no direct-to-package payment. (US1/AC1-3)
- **FR-010**: Permit at most one active paid subscription. An active higher-tier upgrade replaces the current term and starts a fresh full accepted term. Reject downgrades and active same-package renewal; after expiry permit a new package purchase. No package cancellation/refund. (US1/AC4-5; US3/AC3)
- **FR-011**: Initial terms count exactly 365 Monday-Friday dates in server-authoritative Asia/Baghdad. Weekday purchases before 18:00 count that date; exactly 18:00 or later count the next work date; weekends start Monday. Any permitted future duration edit retains the counted-work-date calendar and is snapshotted. (US3/AC1-2)
- **FR-012**: Store activation separately from first counted date; expire exclusively at the start of the calendar date after the final counted work date. Missed tasks do not extend the term; sensitive eligibility reads/writes MUST observe expiry even if scheduled maintenance is late. (US3/AC1-4)
- **FR-013**: Expiry returns current membership to Free while retaining balances, source ownership and all history. Membership activation outside task hours grants no extra task window, reward or daily-claim reset; P05 owns actual submission/approval enforcement. (US3/AC4-5)
- **FR-014**: Use P02's fixed sponsor identity/tree without reassignment, self-ID sponsorship or cycles. Compute L1-L5 relative to the viewed root; the root is separate and deeper descendants cannot become a compressed paid level. No prohibition on distinct same-person accounts. (US6/AC3; edge cases)
- **FR-015**: Initial referral rates are L1-L5 at 12%, 6%, 4%, 2%, 2%. Authorized changes affect future purchase events only; expose current rates and preserve historical event rates. General settings-screen integration remains P10. (US5/AC5)
- **FR-016**: Ordinary new purchases and post-expiry renewals use the purchased full price as commission base. Active upgrades use max(0, target purchased price minus previous subscription's saved purchase price), regardless of the full debit. Never derive the prior price from today's catalog. (US2/AC1-2)
- **FR-017**: Award only existing ancestors with active paid subscriptions who are not banned at the purchase event, under current account authority rules. Withdrawal-only restriction does not independently block accrual. Free/expired/banned levels are skipped without compression, redistribution or future backfill. (US2/AC3-4)
- **FR-018**: Record event-time recipients/levels, rates, base, eligibility/skipped reasons and exact awards with the purchase. Evaluate eligibility at the atomic event, not through later processing/reactivation. Each purchase/recipient/level has at most one award. (US2/AC1-5)
- **FR-019**: Commit buyer debit, replacement/new subscription, all referral decisions/credits, immutable financial history and required audit as one indivisible outcome. Failure of any dependent effect, including a caught failure, rolls everything back. (US2/AC5; edge cases)
- **FR-020**: Preserve exact USDT to six fractional digits, bounded micro-unit arithmetic and percentage rates; floor each nonnegative percentage-derived award to one micro-USDT. Exchanged amounts MUST be validated canonical decimal strings; reject invalid precision/range rather than rounding command intent. (US2/AC1-2; edge cases)
- **FR-021**: Bind repeat-request identity to actor, operation and intent. Matching replay returns the recorded/in-progress outcome; changed intent conflicts. Business purchase/award uniqueness remains effective with a different or absent client key. (US1/AC5-6; edge cases)
- **FR-022**: Concurrent purchase, reservation, adjustment, activation, expiry and shared-ancestor effects MUST preserve nonnegative source balances, one permitted current subscription transition and unique awards. Losing/conflicting operations leave no partial posting or audit. (US1/AC5; US5/AC4; edge cases)
- **FR-023**: Permit authorized reconciliation of the original purchase after lost response/restart; an unknown result MUST NOT trigger automatic resubmission, a fresh debit or presumed refund. Persistence failures produce safe unavailable/conflict outcomes, never apparent success. (US1/AC6; US6/AC2)
- **FR-024**: Provide employee-owned and distinct authorized admin views of subscriptions, wallet totals, available/reserved referral/non-referral sources, purchase-eligible funds, retained withdrawal-ineligible referral funds and current withdrawal eligibility/restrictions. Membership-sensitive values use current saved expiry. P04 implements no withdrawal request. (US4/AC1-3/5)
- **FR-025**: Total ownership MUST equal all available/reserved source components. Purchases exclude reservations; expiry changes eligibility without erasing/reclassifying funds. Paid reactivation unlocks retained unreserved referral eligibility without backfill; pending task work never appears as available credit. (US4/AC1-3)
- **FR-026**: Provide immutable, clearly labeled ledger history/detail and finance totals for actual credits/debits and ownership-neutral reservations/releases. Do not count reservation/release as new income/expense, count a purchase twice or invent future task/deposit/payout events. (US4/AC3/6)
- **FR-027**: Reuse/extend only needed audited source-specific adjustment primitives: current administrator authority, exact positive credit/debit intent, entered reason/reference, duplicate safety and nonnegative available funds; preserve reservations and origin. Corrections append new entries and never rewrite receipts/postings or impersonate chain deposits. Employee-detail adjustment UI and manual-credit endpoints remain later scope. (US4/AC4)
- **FR-028**: Provide bounded, stable, filtered/paginated wallet/ledger/referral history and admin root selection, with declared total/summary scope and a unique order tie-breaker. Employee team root is their own identity; administrators can choose an authorized root. Every permitted record must be reachable without an unbounded full-history/tree read or page-only global totals. (US4/AC6; US6/AC3; C2)
- **FR-029**: Employee views expose only their authorized wallet/team information, existing member presentation and own earned commissions; broader admin projections remain restricted. Exclude credential/private/internal storage and signing data from responses, ordinary diagnostics and browser retained state. (US4/AC5; US6/AC4)
- **FR-030**: After the entire backend gate, replace fixture authority in the six P04 domain screens and existing account subscription/wallet regions with validated authoritative data and committed commands. Preserve the existing admin package active-subscription column and finance neutral-operation metric through declared server count scopes, not fixture/page-only values. Preserve P03 account identity/password/logout; leave unrelated task/deposit/withdrawal/settings domains with their owning phases and no new simulated financial success. (US6/AC1-2/6)
- **FR-031**: Show the full-price quote/top-up, accepted terms, exact expiry, conditional gross, current source eligibility/locks/reservations and relative referral levels in the approved existing surfaces. Apply C1's accepted bounded truthful-copy exception; presentation outside the accepted exceptions remains gated. (US1/AC2; US3; US4; US6/AC3; C1-C2)
- **FR-032**: Preserve drafts across transient refresh failures, recheck current version/authority in handlers, guard one pending financial intent across dialog close/remount, and update affected domain views only from validated results/reconciliation. Uncertain configuration recovery retains the original reviewed intent; an explicit retry cannot change its identity/payload, and a replacement requires matching committed outcome or authoritative proof that the original cannot commit. Missing original payload/current observation remains uncertain rather than guessed. No optimistic financial change, automatic mutation retry or fixture fallback. (US5/AC3-4/6; US6/AC1-2)
- **FR-033**: Distinguish genuine empty/filter-empty from loading/unavailable/denied, stale conflict, pending and uncertain outcomes through the existing surfaces within C2's accepted bounded exception. Old account/root/filter responses MUST NOT populate a new scope, leak private data or revive denied action authority. (US4/AC6; US6/AC2/4; C2)
- **FR-034**: Preserve approved normal rendering and existing navigation, Arabic/RTL/Cairo/light typography/style/dimensions outside explicit owner exceptions. Verify keyboard/focus/pending confirmations, readable isolated amounts/identifiers and usable 320/390/430-pixel phone plus desktop flows. (US6/AC5)
- **FR-035**: Create/extend actual automated files for the phase's contracts, calendar, purchase/commission, wallet/tree projections, authority, source locks, replay/races/rollback, snapshots and UI adapters/controls. Run the complete backend acceptance before frontend work, then real persisted/browser flows and full current checkpoint regressions. Report fresh versus reused results and unavailable checks; no implementation/test pass is asserted by this specification. (All stories; scope/gates)

### Key Entities _(include if feature involves data)_

- **Package and current financial settings**: Stable configured tier identity/order, current price/reward/counted duration/fee, current five rates and change counters; future allowed edits do not rewrite accepted operations.
- **Subscription**: Employee's purchased membership with immutable accepted terms, activation and first/final work dates, exclusive expiry and replacement history; at most one current active paid membership.
- **Purchase and quote**: Quote describes current intent/terms/eligibility without financial effects; a purchase preserves its identity, buyer, prior subscription where applicable, full debit, source allocation, commission base and committed outcome.
- **Sponsor relationship and relative team view**: Existing fixed parent relationship; root-relative L1-L5, authorized member details and bounded summaries/history.
- **Referral decision and award**: Purchase, recipient/fixed level, event eligibility or skipped reason, saved rate/base and exact amount; a skipped decision creates no owed future credit.
- **Wallet, source allocation and ledger operation**: Existing owned available/reserved source components and append-only effects. Purchase uses unreserved referral first; provenance/reservations remain intact.
- **Administrative change/audit**: Current authorized actor, target, server event time, entered reason/reference, accepted counter/terms and attributable committed change; no private secrets.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All initial package quotes match the five approved terms. The S1-to-O1 example shows debit 600, top-up 560 with 40 usable funds, commission base 540 and eligible L1 award 64.8; zero prior-price discounts occur. (FR-004/007-010/016; US1-US2)
- **SC-002**: In every replay and controlled competing-spend/activation/adjustment case, there is zero overspend, duplicate purchase/award or partial subscription/audit effect; controlled dependent failure preserves all pre-operation financial/domain values. (FR-018-023/027; US1-US2/US5)
- **SC-003**: All before/exactly/after-18:00, weekend, final-work-date and exact-expiry cases produce the approved Baghdad results, including exactly 365 work dates for initial terms. Membership is accurate at expiry without waiting for maintenance. (FR-006/011-013; US3)
- **SC-004**: Every tested eligible/Free/expired/banned/withdrawal-blocked ancestor and rate-change event produces the saved fixed-level outcome; zero compressed levels, redistributed awards or backfilled commissions occur. (FR-014-018; US2/US5)
- **SC-005**: Every wallet/finance projection reconciles total ownership and recorded available/reserved sources exactly; reserved funds never enter a purchase quote, Free/expired referral funds never appear eligible for a new withdrawal, and reservation/release adds zero income/expense. (FR-024-027; US4)
- **SC-006**: All employee/admin permission and stale-authority cases deny unauthorized operations/data with zero private cross-account disclosure; account/root changes admit zero obsolete responses or writes. (FR-002-003/028-029/032-033; US4-US6)
- **SC-007**: Each of the six P04 domain routes and the in-scope account regions completes its purchase/read/edit journey with persisted results after reload, current totals and access to every filtered history page. Each applicable failure state has an approved truthful outcome; no timer/fixture result is counted as completion. The backend gate must pass first; integration must stay within the accepted C1-C2 exceptions. (FR-028/030-033; US6)
- **SC-008**: Integrated phone/desktop journeys have zero page overflow, clipped Arabic, hidden required actions or inaccessible confirmation/detail controls at focused 320px, representative 390/430px and desktop checks. Zero unapproved route/popup/style/copy changes occur. (FR-034; US6)
- **SC-009**: Both delivery-group gates have actual automated acceptance evidence and the P04 full current regression checkpoint passes with no unclassified required failure/unavailable suite. Existing P01-P03 acceptance is preserved; backend-only completion or a reviewed checklist cannot be reported as complete P04. (FR-001/035)

## Assumptions

- Initial durations/fees/rates and exact financial formulas are approved rules, not open questions. Future configuration remains within the roadmap's permitted terms; counted work dates are never converted to ordinary elapsed calendar days.
- P02 sponsor/identity and P01 money/calendar/ledger capabilities are reused. Existing code provides foundations, not evidence that P04 subscriptions, awards or public views already exist.
- P04's wallet tests may arrange foundation reservations or valid existing reward/credit records without implementing P05/P06/P08 workflows. Future financial integrations must use the same provenance/history rules.
- P04 general financial settings records support future-rate snapshots; the general settings editor remains P10. The existing admin package editor is the P04 configuration surface.
- Frontend acceptance requires real application/persistence/browser access and applicable owner-approved surfaces. No approval is inferred from P03 exceptions or the existence of shared controls.
- Live company mail, provider/testnet/custody funding, deployment/restore and independent release review remain their later gates. One-admin authority/no-2FA and compromised-admin/host residual risks persist; this phase provides no security or return guarantee.
