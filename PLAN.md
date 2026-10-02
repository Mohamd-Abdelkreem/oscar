# OSCAR MVP: Lean Spec Kit Implementation Plan

**Decision baseline:** October 2, 2026  
**Repository:** `D:\MINE\Software Engineering\Projects\Mostaql\oscar`  
**Structure:** 15 implementation phases; backend first, then frontend for each domain group.  
**Status:** Planning only. Financial backend implementation and test execution have not been performed by writing this document.

## 1. Instructions for the Implementing AI

The owner will install and configure Spec Kit, prepare the constitution, and provide the project ready for development. **There is no Spec Kit installation, initialization, or constitution-writing phase in this plan.** Read the supplied constitution and repository instructions; do not reinstall the toolkit, overwrite the constitution, or ask for a redundant setup approval.

Start with P01, which implements actual financial backend code. A quick check of the existing build/test baseline is a task within implementation, not a new setup phase. Report missing prerequisites instead of pretending they exist.

Use this file as the latest business-rule baseline. It supersedes older PDFs, prompts, and fixture assumptions for deposits, upgrades, task rewards, referrals, subscription duration, and withdrawal cooldowns. Existing approved screens must be preserved. No customer-facing feature is removed by this simplification.

Implement one selected phase, using small dependency-ordered task batches. A batch is not another formal phase and needs no separate specification, constitution, approval, or report framework. Stop after the selected phase and report changed files, actual tests run, results, and remaining blockers. If a phase is too large for one turn, execute a bounded task range and do not claim the whole phase passed early.

Complete the backend phase or phases for a group before connecting that group's frontend. Backend completion includes applicable migrations, validated contracts, authorization, services, endpoints, workers, failure handling, and actual test files. Do not connect a money-changing screen to a partially implemented service or a mock success action.

Keep the existing monorepo and boilerplate patterns. Do not introduce an event bus, general outbox framework, microservices per module, generic accounting product, complex version registry, or unnecessary abstraction. Preserve unrelated working-tree edits and the existing Next.js App Router.

### Skills and Verification

- Read applicable `AGENTS.md` / `CLAUDE.md` and relevant installed Next.js guides before framework-dependent edits.
- Use `security-best-practices` with applicable Express/Next.js/React references for secure implementation.
- Apply `clean-code-guard` after nontrivial production changes and `test-guard` to changed tests.
- Use `vercel-react-best-practices` for frontend work, `playwright` for browser verification, and `docs-guard` for changed technical docs.
- If a skill is unavailable, report it and apply its stated principles; do not claim it was loaded.
- Every phase creates or extends actual automated test files. Run focused tests for affected behavior plus relevant shared regressions; do not rerun every unrelated suite after every small task.
- Run full regression at the major checkpoints specified in Section 9 and before release. No real-money operation is authorized by this document.

### Completion Rule

Use a short phase report: phase ID, scope completed, changed files, tests added/changed, commands actually run, pass/fail results, and unresolved risk. A phase with missing required infrastructure or unexecuted financial tests remains incomplete. Owner approval is needed for actual deployment spending and real-money launch, not for routine task paperwork.

## 2. Verified Starting Point

The repository is a pnpm/Turborepo workspace with Next.js 16, React 19, Tailwind CSS 4, Express 5, Prisma 7/PostgreSQL, and TypeScript. Preserve the installed versions and lockfile; resolve additional package versions against the repository's Node 24 and pnpm 11 constraints rather than blindly upgrading existing dependencies.

Existing architecture:

```text
Next.js screens and domain hooks
    -> shared @template/contracts
    -> centralized Axios transport
    -> Express routes / controllers / services
    -> Prisma / PostgreSQL
```

Existing implementation boundaries to preserve:

| Existing Location | Current Role / Planning Consequence |
| --- | --- |
| `apps/api/src/router.ts` | Auth, users, health, and OpenAPI are wired; OSCAR financial/task/TRON routes are not implemented here yet. |
| `packages/database/prisma/schema.prisma` | Currently contains User and RefreshToken, not the proposed OSCAR domain models. |
| `packages/contracts/src/` | Existing auth/account/HTTP schemas; add validated domain contracts alongside them. |
| `apps/web/src/services/api/api-client.ts` | Central transport; do not duplicate token, refresh, or error handling in domain components. |
| `apps/web/src/features/auth/api/auth.api.ts` and `hooks/auth.hooks.ts` | Existing real authentication adapters/session hooks to reuse. |
| `apps/web/src/features/users/api/users.api.ts` and `hooks/users.hooks.ts` | Existing account integration patterns. |
| `apps/web/src/shared/query/query-client.ts` | Existing query policy; preserve bounded read retries and no automatic mutation retries. |
| `apps/web/src/features/employee/` and `features/admin/` | Approved screens currently backed substantially by fixtures and local state. |
| `apps/web/src/app/providers.tsx` | Currently mounts admin fixture state globally; remove it after migrating its production consumers. |
| `packages/database/tests/schema-contract.test.ts` and `tests/integration/migration.integration.test.ts` | Auth-only model/table expectations must be deliberately updated as migrations add OSCAR models. |

The auth foundation already includes useful security protections. Extend it instead of replacing it: password hashing, hashed single-use verification/reset/refresh tokens, role/status checks, validation, refresh-cookie controls, CSRF protection for cookie-authenticated flows, and redacted logging. Reverify these protections after changes.

Vitest, Testing Library, Supertest, and PostgreSQL Testcontainers are already available. A configured Playwright end-to-end suite must be added; saved browser snapshots are not a substitute for automated E2E tests. Production application/worker/signer deployment also requires work; a database-only development Compose configuration is not a finished VPS deployment.

All new model names, test names, worker entrypoints, and API capabilities below are proposed deliverables, not claims about existing files or endpoints.

## 3. Confirmed Business Rules

### 3.1 Identity and Interface

- Employee experience: Arabic-only, RTL, Cairo, light theme, mobile-first web with the existing app-like bottom navigation.
- Admin experience: the existing normal web dashboard, also responsive on phones.
- Administrators sign in with their own email and password through a dedicated admin login screen. Reuse shared authentication/password/session services, but enforce current ADMIN role and active status on the server before dashboard access. There is no public admin registration or client-selected role.
- Registration uses email/password, optional referral code, and activation through an email verification link. Do not implement registration OTP or Google OAuth.
- Users may sign in on multiple devices. Password reset/change are required.
- Multiple accounts belonging to one person are not prohibited. Do not add KYC, device-based single-account bans, or a hidden ban on referrals between such accounts.
- A referral sponsor cannot be changed after registration. An account cannot sponsor itself by its own ID, and the tree must not contain cycles.
- Multiple administrators may exist; all have the same ADMIN role. One admin can authorize an administrative action. No admin 2FA or second-admin approval is required by the owner.
- Suspended/banned accounts cannot log in. Withdrawal-only and task-only restrictions are separate controls.
- First admin is bootstrapped through a protected setup procedure; additional admins receive email invitations to set their own password.
- Resend is the email provider. The company domain, sender, and support address must be configured before launch.

### 3.2 Packages and Subscription Dates

| Package | Purchase Price (USDT) | Reward Per Approved Daily Task (USDT) | Counted Work Dates | Initial Withdrawal Fee | Conditional Gross Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| S1 | 60 | 2.00 | 365 | 21% | 730.00 |
| S2 | 120 | 4.00 | 365 | 21% | 1,460.00 |
| O1 | 600 | 16.00 | 365 | 21% | 5,840.00 |
| O2 | 1,200 | 38.00 | 365 | 21% | 13,870.00 |
| A1 | 2,600 | 67.00 | 365 | 21% | 24,455.00 |

These are initial configurable terms, not a guaranteed investment return. The gross total assumes 365 eligible tasks are completed and approved, before package cost and withdrawal fees. It is not income within a 365-calendar-day year.

- A user has at most one active paid subscription.
- Purchase and upgrade both debit the full target package price from purchase-eligible, unreserved funds. Previous package cost is not credited against the purchase.
- External transfers first become wallet balance. There is no separate direct-to-package payment flow.
- Upgrade replaces the current subscription and starts a new full term. Upgrade is to a higher configured package tier; do not implement an unapproved downgrade flow.
- Same-package renewal is prohibited while that subscription is active. After expiry, a package may be purchased again.
- Activation is immediate after a successful atomic purchase; no admin approval is required.
- Subscription duration is 365 Monday-Friday work dates in `Asia/Baghdad`; Saturdays and Sundays do not count.
- On a weekday, a purchase before 18:00 counts that date as day one. Exactly 18:00 or later starts counting on the next work date. A weekend purchase starts counting Monday. Store purchase/activation time separately from the first counted work date.
- Expiry is the start of the calendar date immediately after the 365th counted work date, converted to UTC for storage. Use an exclusive expiry boundary. A missed task still consumes its work date; it does not extend the subscription.
- Purchases outside task hours may activate membership immediately, but do not create an extra task window or a weekend task.
- Admin edits apply to new purchases. Existing subscriptions retain purchase-time price, reward, duration/calendar rules, and fee terms. Snapshot these terms.
- Expiry returns the account to Free; balances and history remain. There is no package cancellation/refund feature.

### 3.3 Wallet Sources and Spending

USDT is the only balance asset. There is no points system.

Keep one understandable total in the UI, but retain accounting provenance. The backend must distinguish referral commissions from other funds, and distinguish available funds from reserved withdrawal funds. The ledger records more detailed origins such as deposit, approved task reward, commission, package debit, fee, and authorized admin adjustment.

- Purchase-eligible funds include unreserved referral funds and unreserved non-referral funds, even when referral funds are temporarily locked for withdrawal.
- Purchases consume referral funds first, then other funds. Reserved funds are never purchase-eligible.
- With an active paid subscription, unreserved referral funds may be withdrawn. While Free/expired, they remain owned and retained but are not eligible for a new withdrawal.
- Free/expired users may withdraw their unused deposits and approved task rewards, subject to the normal limits, restrictions, and fee.
- Paid reactivation unlocks retained referral funds for new withdrawals; it does not create commissions for events that happened while the account was ineligible.
- Pending task submissions are displayed separately and are not available wallet credits.

Engineering default for deterministic withdrawal allocation: reserve eligible non-referral funds first, then eligible referral funds. Persist the exact source breakdown. Rejection/cancellation returns that breakdown, not an undifferentiated credit that would turn locked commissions into withdrawable deposits.

### 3.4 Referrals

- Fixed relative levels L1-L5, initially 12%, 6%, 4%, 2%, and 2%; admin may change rates for future events.
- Ordinary new purchases and post-expiry renewals use the purchased package price as the commission base.
- An upgrade charges the full target price, but its commission base is only the positive difference between the target purchase price and the previous subscription's snapshotted purchase price. A nonpositive difference produces zero commission, never a negative commission.
- Eligible recipients must have an active paid subscription and must not be banned at the purchase event. Free/expired/banned recipients do not accrue commissions for that event.
- Snapshot recipient eligibility, levels, rates, base, and resulting amounts in the same transaction as the purchase. A delayed job must not reinterpret eligibility after reactivation.
- Replaying a purchase cannot generate another commission. Each purchase/recipient/level award is uniquely identified.
- MVP default: an ineligible ancestor's level is skipped without moving other ancestors upward or redistributing the skipped commission. Reactivation affects future events only.
- Withdrawal-only restriction does not itself ban referral accrual; a full account ban does.
- Do not implement leadership ranks, team-threshold bonuses, fee discounts, or eligibility compression without a separately approved specification.

### 3.5 Tasks, Codes, and Proofs

- One common daily task opportunity; at most one submission/reward claim per employee per Baghdad business date, independent of subscription ID.
- Tasks are available Monday-Friday, 12:00 inclusive to 18:00 exclusive, Baghdad time. Saturday/Sunday show the approved holiday empty state, not a task.
- Admin manages task content, publication date, external link, image, and code gating. The server controls availability; the browser clock is not authoritative.
- A code-gated task requires a valid enabled task code. Admin can create/enable/pause a code and see accounts and times of successful usage.
- Pausing a code blocks new unlocks only. Existing unlocks remain valid, subject to the task window and normal account eligibility.
- Screenshot and execution declaration are required. A valid submission snapshots the active subscription and reward amount.
- Submission does not credit available balance. Admin approval credits the reward exactly once; rejection is final and grants no reward.
- Approval is final. Do not implement later approval reversal or reward clawback.
- A valid submission may still be approved after subscription expiry or a later account ban. Its reward is the submission-time amount; the ban continues to block withdrawals and login.
- Pending screenshot replacement is allowed within the original submission deadline and before a final decision. It changes evidence, not reward entitlement, and does not create a new submission.
- Proofs are private server files, not public assets. Allow validated PNG/JPEG/WebP, maximum 5 MB per uploaded file, with decoded-dimension limits and safe image processing.
- Retain proof files for at least 30 days from upload. Pending-review proofs are exempt from age-based deletion. Once final, age-expired files may be cleaned up; retain financial/submission/audit metadata.

### 3.6 Deposits and TRON Custody

- Support the configured USDT TRC-20 contract on the configured TRON network only. Mainnet and testnet must be explicitly separated.
- Each employee receives a unique company-controlled deposit address. The mapping never comes from a client-supplied address or TxID claim.
- The backend detects a successful, confirmed eligible transfer and credits it once, including weekends. There is no 72-hour deposit hold and no admin deposit rejection step.
- Immediate credit means immediately after the application's detection and verification of the confirmed transfer, not a promise of zero blockchain/provider latency.
- There is no commercial deposit minimum/maximum currently approved. Validate positive amounts, supported precision, representable storage ranges, network, recipient, and token nonetheless.
- Company-controlled addresses do not forward money by themselves. A separate sweep transfer moves funds to company treasury. Sweeps never generate another employee credit.
- Use TronWeb/TronGrid directly, not a custodial payment provider. Employees never receive or control the private keys for their platform deposit addresses.
- Authorized admin adjustments/manual credits are separately recorded ledger operations. They do not edit a genuine chain receipt or impersonate a confirmed blockchain transfer.

TronWeb generates address/key pairs locally; account generation and on-chain activation are different operations. Keep generation in the protected custody boundary and verify activation/resource behavior on testnet. [TRON accounts](https://developers.tron.network/docs/account), [TronWeb account generation](https://tronweb.network/docu/docs/API%20List/utils/createAccount/).

### 3.7 Withdrawals

- Initial limits: 16-500 USDT gross per request, configurable by admin.
- Initial fee is 21% for all packages, Free, and expired accounts. Fee rates may be configured for future requests; active subscription/request snapshots are preserved.
- Fee is deducted from gross. The company separately pays TRON resource/network costs; these must not be additionally deducted from the employee.
- Reserve gross atomically when the request is accepted. Reservation reduces available funds, not total ownership. Successful payout settles the reservation; safe rejection releases it exactly once.
- One active withdrawal per employee across devices and concurrent requests. Include scheduled, signing, submitted, and unknown-outcome states in this constraint.
- A new request is allowed after confirmed completion or safe rejection/failure with reservation release. The old 24-hour cooldown is removed.
- The delay is 72 counted hours excluding Saturday/Sunday in Baghdad. Count all hours of other weekdays, not only 12:00-18:00 task hours.
- Auto-dispatch occurs when the calculated deadline is reached and execution preconditions pass. Admin approval is not required.
- Admin may reject an unsent scheduled request or add positive counted hours to its existing deadline, with a reason. Do not reset the original 72-hour clock or restore the obsolete per-request hold action.
- Persist gross, fee, net, source allocation, recipient, address version, eligibility, and schedule policy at request acceptance.
- Later subscription expiry does not cancel an already eligible reserved request, including its referral portion.
- A ban, withdrawal block, or admin destination change safely cancels an unsent scheduled request and releases its original reservation. Destination changes never redirect an existing request.
- Once sending may have started, do not release funds or claim cancellation merely because the account/address changes. Reconcile the immutable original transfer first.
- A timeout/unknown response is not a failed payout. It remains active and reserved until its chain outcome is resolved.
- Employee saves their withdrawal address once after email-link confirmation. Later changes are admin-only, audited, and subject to the unsent cancellation rule.

### 3.8 Administrative Scope

Include employee search/detail, restrictions, safe deletion, packages, tasks/codes/proof review, deposits, scheduled withdrawals and extensions, finance, referrals, audit, settings, admin invitations, and dashboard summaries.

Every material administrative mutation requires a confirmation dialog; sensitive financial/address/account actions also require a reason and server-side authority. Audit actor and time come from authenticated server context, never hard-coded frontend identity.

There is no banner-management page, announcements module, in-app notification system, support-ticket system, or dark mode. Support routes to company email; FAQ/terms/privacy are versioned approved content.

## 4. Calculation Examples and Required Assertions

### Purchase / Upgrade

```text
Target price:             20 USDT
Unreserved usable balance: 5 USDT
Required top-up:          15 USDT
Balance after deposit:    20 USDT
Purchase debit:           20 USDT
Balance after purchase:    0 USDT
Subscription: a fresh 365-work-date term
```

Previous package price does not reduce that debit. If its snapshotted price was 10, upgrade commission base is 10, and L1 at 12% receives 1.20, provided the referrer is eligible. These are deliberately separate formulas.

For S1 -> O1: purchase debit is 600, regardless of the earlier 60 payment. With 40 usable funds, top-up is 560. Upgrade commission base remains 600 - 60 = 540; eligible L1 receives 64.80.

### Source Preservation

```text
Other available funds:    70 USDT
Referral available funds: 30 USDT
Total:                   100 USDT
Purchase price:           20 USDT
After referral-first spending:
Other funds:              70 USDT
Referral funds:            10 USDT
Total:                     80 USDT
```

If the subscription later expires, a new withdrawal can use the 70 other funds, not the retained 10 referral funds. Those 10 remain usable for a package purchase and become withdrawal-eligible on paid reactivation.

### Gross / Fee / Net

```text
Gross requested: 100 USDT
Platform fee:     21 USDT
Employee receives: 79 USDT
Company pays network resources separately.
```

Reserve 100, not 79. If safely rejected, restore the original 100 source allocation. If successfully completed, settle 79 payout plus 21 fee with no second deduction.

### Weekend Clock

Friday at 12:00 Baghdad + 72 counted hours is Wednesday at 12:00 Baghdad: 12 hours Friday, 24 Monday, 24 Tuesday, and 12 Wednesday. A Saturday request starts accumulating counted hours on Monday. Deposits and confirmation/reconciliation still run throughout weekends.

Engineering boundary rule: if a countdown reaches zero exactly at the start of a blocked weekend interval, normalize new dispatch to the next eligible weekday instant. Do not pause settlement of an already broadcast transaction merely because its confirmation occurs during a weekend.

### Referral Perspective

If Mohammed invites Ahmed and Ahmed invites Yasmin, Ahmed is Mohammed's L1 and Yasmin is Mohammed's L2. When viewing Ahmed as the root, Yasmin is L1. Levels must be relative to the selected root, not permanent labels on employees.

### Reward Finality

Submitting S1 work captures 2 USDT but does not add available funds. Later upgrading to O1 does not change this submission to 16 USDT. Approval adds exactly 2 once, even after expiry/ban. The upgrade cannot unlock a second rewarded submission for that same Baghdad date.

## 5. Lean MVP Architecture and Non-Negotiable Controls

### 5.1 Existing Structure, Not Additional Platforms

Keep Next.js feature components/hooks -> shared contracts -> centralized Axios -> Express routes/controllers/services -> Prisma/PostgreSQL. Add domain modules beside existing modules, not parallel versions of the same infrastructure.

Worker and signer may use proposed `apps/api/src/worker.ts` and `apps/api/src/signer.ts` entrypoints from the existing API build. Run them with separate process/container identities, database permissions, and secrets. Importing the public router must not load custody secrets or expose signing operations. Additional workspace packages are optional only if a demonstrated build boundary requires them.

### 5.2 Exact Money and a Small Immutable Ledger

- PostgreSQL owns balances, source components, reservations, purchases, submissions, awards, withdrawals, deadlines, and audit. Redis is not the wallet database.
- Store bounded integer micro-USDT using PostgreSQL bigint-compatible fields and exact server arithmetic. Return canonical decimal strings in JSON; never use floating-point arithmetic for money.
- Initial fee/referral rates use integer basis points: 2100 and 1200/600/400/200/200. Floor percentage-derived amounts to one micro-USDT; preserve exact verified deposit units.
- Keep a small append-only ledger of known operations with atomic wallet/source projections. Reconcile credits, debits, source transfers, reservations, releases, and settlements. Do not build a general accounting chart or reporting engine.
- Preserve referral versus non-referral provenance and available versus reserved amounts. Expiry changes eligibility, not ownership; cancellation returns the exact reserved source allocation.
- All money changes use one transactional service. Use nonnegative database constraints, unique business sources, deterministic locking/conditional updates, and bounded conflict retries.
- HTTP idempotency is scoped to actor/operation/key and bound to payload. A repeated business source must remain duplicate-safe even with a different or missing client key.
- Purchases, referral awards, task approvals, deposits, and reservations commit their financial effects atomically. Do not hold DB transactions across external network calls.
- Admin corrections are new audited entries with reason/reference, not edits to historic receipts or postings.

### 5.3 No Generic Outbox; Durable Business Records Instead

The MVP has no notification product and does not need a universal event-delivery framework. Purchases/commissions and approvals settle in their database transaction. Deposit addresses/events store their own indexing cursor and deduplication identity. Withdrawal rows store their state, deadline, schedule version, reservation, and attempt identity.

A background worker periodically scans eligible durable records and claims work atomically. BullMQ/Redis can provide fast wakeups and bounded retries, but publication may be best-effort because the database scan repairs missed wakeups. A queue failure cannot erase an accepted reservation or authorize another payment. Stale jobs recheck the current row and become no-ops where appropriate.

Keep tests for crash after commit, lost wakeup, duplicate workers, stale extension jobs, and Redis restart. Retry safety belongs to the application's state transitions, not a promise of exactly-once queue delivery. [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs).

### 5.4 Counters and Snapshots, Not a Version Registry

Current package/settings rows have a simple incrementing version counter. Store complete immutable terms on subscriptions, purchases, referral awards, task submissions, and withdrawal requests. Admin edits are audited. A stale quote is revalidated or rejected; a later edit cannot rewrite a purchased reward, accepted fee, original commission decision, or destination.

There is no separate PackageVersion/PolicyVersion administration subsystem or approval workflow. The counter identifies stale data; the saved operation terms preserve history.

### 5.5 TRON Safety

Verify the configured network, allowlisted token contract, decoded recipient, raw amount, successful execution, and chosen confirmed/solidified canonical receipt criterion. Deduplicate by network + transaction ID + receipt log index because a transaction can emit multiple transfer events. [TRON integration](https://developers.tron.network/docs/exchangewallet-integrate-with-the-tron-network).

Generate independent deposit key pairs inside the protected custody boundary. Before publishing an address, obtain acknowledged recoverable encrypted off-VPS key/address/employee-assignment records; a nightly backup after publication is not enough. Keep decryption secrets separately protected. Do not reassign an old address.

The signer accepts only authenticated durable intents with fixed operation/network/token/source/destination/amount and policy limits. No arbitrary signing or key-export endpoint. Persist signed bytes, transaction ID, attempt identity, and broadcast intent before broadcast. Reuse the same attempt on retry; unknown outcomes remain active/reserved until reconciled.

For the initial MVP, company treasury sweeps are operator-triggered through a protected fixed-destination tool. Company resource funding may be a documented manual operation with caps. Do not implement automatic batching optimization, repeated automatic TRX top-ups, staking, or energy-market trading. **Employee deposits remain automatically credited, and employee payouts remain automatically dispatched after their deadline; company treasury operations do not add admin approval to those flows.**

Protect keys and signing payloads from API output, public env variables, logs, browser builds, fixtures, and ordinary diagnostics. Maintain limited treasury funds, basic alerts, and an emergency new-dispatch pause. Container isolation does not defeat a VPS host compromise.

### 5.6 Access, Files, and Recovery

Server authorization is independent of frontend guards. Reject attempts to set client-authoritative balance, role, subscription, reward, sponsor, approval, fee, deadline, or payout result. Refresh current role/status/session authority on sensitive requests.

Reuse existing cookie/refresh/CSRF/input/log protections. Add compatible frontend security headers, private proof access, bounded safe raster processing, and cross-user ownership tests. Admin sensitive actions require reason and confirmation; current-password reauthentication may be checked directly on the action, without a custom multi-step authorization platform or a new OTP/2FA flow. Follow [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) for binding authority to the intended operation.

The owner chose one-admin authority and no admin 2FA. An audit trail does not guarantee against an authorized compromised admin. Record residual risk and require independent money/security review before launch; do not promise 100% protection.

Recover database commits, private assets where required, custody records, and immutable signing attempts. Backups must include tested off-VPS PostgreSQL WAL/point-in-time recovery for post-snapshot off-chain purchases/rewards/adjustments, not only blockchain history. Fence financial writes/dispatch during restore and reconcile chain activity before resuming. An unresolved recovery gap cannot be repaired by guessing balances.

## 6. Fifteen-Phase Map

| Phase | Scope | Layer / Gate |
| --- | --- | --- |
| P01 | Money, Baghdad calendar, foundation schema, ledger/source/idempotency | Backend foundation |
| P02 | Identity, role/status enforcement, admin email/password login and account lifecycle | Backend foundation |
| P03 | Real auth, dedicated admin login, account basics, protected layouts | Frontend after P01-P02 |
| P04 | Packages, purchases, referrals, wallet/ledger projections | Backend |
| P05 | Packages/team/wallet and admin package/referral/finance views | Frontend after P04 |
| P06 | Private proof files, daily tasks/codes, final review/reward | Backend |
| P07 | Employee tasks and admin task/code/submission workflows | Frontend after P06 |
| P08 | Protected custody, assigned addresses, deposits, operator treasury tools | Backend |
| P09 | Employee deposit and admin deposit history | Frontend after P08 |
| P10 | Withdrawal address/quotes/reservations/calendar/DB scheduling | Backend |
| P11 | Payout signing/broadcast/confirmation/recovery | Backend |
| P12 | Employee/admin withdrawals and initial address flow | Frontend after P10-P11 |
| P13 | Cross-domain employee administration, settings, aggregates, policy APIs | Backend |
| P14 | Final admin/home/account/policy integrations | Frontend after P13 |
| P15 | Integrated verification, Linux/Docker deployment, restore, testnet/UAT, release | Final verification and operations |

Execute P01-P15 in order. A later phase cannot bypass its preceding gates just because one of its modules could technically start earlier. Small independent tasks inside a phase may run in parallel when file ownership/dependencies make that safe.

## 7. Detailed Implementation Phases

### P01 - Financial Backend Foundation

**Start here; this is implementation, not Spec Kit setup.** Briefly run/check the existing baseline, then implement exact money parsing/rates/JSON contracts and the single Baghdad calendar for tasks, counted subscription dates, and withdrawal hours.

Add real migrations for source-aware wallets, immutable ledger records, operation idempotency, and audit. Preserve auth models and deliberately extend the existing auth-only schema/table inventory tests. Implement transactional credits/debits/reservations/releases, source reconciliation, unique business identities, nonnegative balances, deterministic locks, and payload-bound idempotency. Do not add an outbox table or generic event engine.

**Test files:** `money.test.ts`, `business-clock.test.ts`, `financial.schema.test.ts`, `ledger.service.integration.test.ts`, `ledger-concurrency.integration.test.ts`; extend database migration/schema tests. Use real migrated PostgreSQL for persistence/concurrency.

**Required assertions:** Precision/overflow/rounding; exclusive task cutoffs; exact 365 work dates and weekday 72-hour clock; duplicate credit/debit; competing spend; rollback; original-source release; idempotency payload conflicts; ledger/projection agreement.

**Gate:** Foundation contracts/migrations/services and focused tests pass. No frontend or client input can directly set money.

### P02 - Identity, Authorization, and Admin Backend

Reuse existing auth/user modules. Implement email-link activation/reset, immutable sponsor registration, wallet creation, account restrictions, owner-safe profiles, current role/status/session checks, and safe session invalidation. Do not introduce a second auth system.

Implement administrator email/password sign-in using the existing password/session services and shared auth contracts. The admin sign-in boundary accepts only a currently active ADMIN, with server-enforced checks, rate limiting, generic credential errors, and no public role assignment. Reuse password recovery/change and logout/session revocation for administrators; a frontend redirect is not authorization.

Implement protected application-admin bootstrap, single-use Resend invitations, ADMIN list/read, and activation/deactivation with last-admin/self-lockout safety as appropriate. This is application functionality, not constitution/toolkit setup. Prevent public role assignment and stale banned/deactivated sessions. Keep existing rate limits and production-secret validation/redaction; Redis may be added to the existing limiter when needed, without another auth framework.

Harden production auth configuration rather than merely preserving its current length checks. Fail startup for missing required auth secrets, known example/default placeholders, and unintended key reuse or refresh/verification/reset fallback to the access-token key. Require strong distinct production keys for the existing purposes; keep credentials out of logs and templates. Do not add a new secret-management framework. Extend configuration tests for these failures and valid production configuration; development/test defaults must not silently apply in production.

**Test files:** `oscar-auth.integration.test.ts`, `authorization.integration.test.ts`, `admin-invites.integration.test.ts`, `session-revocation.integration.test.ts`; extend existing auth-configuration tests.

**Required assertions:** Link/invite replay, invalid/cyclic/self-ID sponsor, mass assignment, anonymous/admin API access, cross-user data access, suspended sessions, reset/logout and admin lifecycle; valid admin email/password login, wrong credentials, employee credentials at the admin entry, disabled admin access, and absence of public admin registration; production rejects missing/placeholder/reused auth keys and accepts strong correctly separated keys without secret exposure.

**Gate:** All identity/admin contracts needed for P03 exist and are authorized. Withdrawal-specific restriction cancellation will be completed with P10-P11 before that financial workflow is connected.

### P03 - Authentication and Account Frontend

Connect the five employee auth routes, account basics/password/logout, protected employee/admin layouts, and admin identity/list/invitation controls. Add the proposed `/admin/auth/login` screen with email/password, clear loading/validation/error states, shared password-recovery access, and successful navigation to `/admin`. Keep this public sign-in screen outside the protected dashboard layout to avoid redirect loops. Reuse real auth/user adapters, shared form components, and centralized QueryClient/Axios; do not duplicate the auth backend. Keep existing employee role-aware destinations.

Introduce a real Playwright config/script if absent. Replace simulated auth and hard-coded admin identity, not the approved design. Financial account widgets wait for their domain gates. Keep safe query-cache clearing and guest/employee/admin access boundaries.

**Test files:** `employee-auth.integration.test.tsx`, `admin-login-screen.test.tsx`, `account-screen.test.tsx`, `admins-list-screen.test.tsx`, auth adapter tests, `identity-and-admin-access.spec.ts`.

**Gate:** Admin email/password sign-in, logout, reload, and recovery work; employee/anonymous/disabled-admin sessions cannot access dashboard data. Real sessions survive reload; banned/deactivated access fails; private caches do not leak between accounts; auth/account screens pass focused mobile/accessibility checks.

### P04 - Packages, Referrals, and Wallet Backend

Implement current package/settings records with version counters and immutable operation snapshots, not separate version-registry tables. Add catalog/admin edits, fixed sponsor tree, purchase quotes, transactional full-price purchase/upgrade, fresh work-date expiry, and event-time referral awards/skipped eligibility decisions.

In one transaction, debit referral-first usable funds, change the subscription, and post eligible commissions. Upgrade commission uses the positive difference from the previous subscription price snapshot, even though the purchase debits the full target price. Enforce one subscription and no early same-package renewal. Check expiry timestamps on sensitive actions rather than relying on a timely expiry job.

Add employee/admin wallet, ledger, subscription, and relative-root referral projections with bounded filters/pagination. Add audited adjustment primitives; original receipts/history cannot be overwritten. No backfill of commissions skipped while Free/expired/banned.

**Test files:** `subscription-purchase.integration.test.ts`, `subscription-calendar.test.ts`, `referral-commissions.integration.test.ts`, `wallet-projections.integration.test.ts`, `referral-tree.integration.test.ts`.

**Required assertions:** Full debit versus difference commission; referral-first spending while expired; snapshots after edits; recipient eligibility; no compression/backfill; concurrent spend/activation; atomic rollback; source locks; owner/admin DTO separation.

**Gate:** Backend catalog/purchase/referral/wallet services and views are complete and tested before P05.

### P05 - Packages, Team, Wallet, and Finance Frontend

Connect employee packages/team/wallet and admin packages/referrals/finance. Display server-generated price/top-up/source allocation, exact expiry, conditional gross total, current withdrawal eligibility, reservations, and retained referral funds. Levels are relative to the selected root.

Use runtime-validated shared response schemas, feature API adapters/hooks, reusable dialogs/buttons/selects, and confirmed query refresh. Do not optimistically change balances or membership. Remove migrated domains' fixture authority; retain test fixtures only. Use clear ledger labels.

**Test files:** `package-upgrade-modal.test.tsx`, `wallet-screen.test.tsx`, `referrals-screen.test.tsx`, adapter/hook tests; `packages-and-subscriptions.spec.ts`, `wallet-and-ledger.spec.ts`, `referrals.spec.ts`.

**Gate:** Persisted server behavior, stale/conflict handling, source restrictions, and responsive views pass. Run the first full current regression checkpoint.

### P06 - Private Proofs, Tasks, Codes, and Review Backend

Implement safe server-local image upload/storage/access and cleanup, daily task publication/eligibility, task codes/unlocks, screenshot/declaration submission, pending evidence replacement, admin review, and approved reward posting.

Use a database claim unique by employee + Baghdad business date, independent of subscription. Snapshot reward/entitlement at submission. Approval/status/ledger/audit commit together; approval and rejection are final. Valid work remains reviewable after later expiry/ban; code pause affects new unlocks only. Protect files from traversal, false MIME, oversized/pixel-bomb inputs, unauthorized access, and deletion during review. Pending proofs remain exempt from 30-day cleanup.

**Test files:** `proof-storage.integration.test.ts`, `task-codes.integration.test.ts`, `task-submissions.integration.test.ts`, `task-approval.integration.test.ts`, `daily-reward-concurrency.integration.test.ts`, `proof-retention.test.ts`.

**Required assertions:** Weekday/time/package restrictions; daily claim across upgrades/devices; required declaration/owned image; no pending credit; approve/reject race; repeated approval; reward snapshot after edits/expiry/ban; final rejection; paused code retained unlock; private 5 MB files and retention.

**Gate:** Entire proof/task/code/review backend works before P07; no rewarded duplicate or public proof access.

### P07 - Tasks, Codes, and Review Frontend

Connect employee tasks and admin task list/new/detail/edit, code list/new/detail, and submissions. Remove employee task components' imports from admin fixture state; employee entitlement comes from the employee API.

Upload actual files and store returned asset IDs; blob previews are temporary. Render upcoming/open/closed/holiday/pending/approved/rejected/restricted states accurately. Pending rewards do not increase available balance. Final decisions remove reversal/resubmission/edit actions as applicable. Reuse confirmations and preserve inline icon/label alignment.

**Test files:** Extend `task-card.test.tsx` and `screenshot-upload.test.tsx`; add `task-code-gate.test.tsx`, `submissions-screen.test.tsx`, adapters, and `tasks-codes-and-review.spec.ts`.

**Gate:** Upload/review persists, code behavior matches the backend, one approval adds one captured reward, and mobile review/dialog flows work.

### P08 - TRON Custody, Deposits, and Basic Treasury Backend

Implement the protected custody/signer process, unique address provisioning, encryption/recovery records, and immutable signing-attempt primitives. Publish an address only after its key/assignment has acknowledged encrypted off-VPS recovery. Handle concurrent provisioning/lost replies without address reuse or key exposure.

Implement bounded TronGrid detection with durable cursors, pagination/replay windows, canonical finality verification, network/token/recipient/receipt validation, and transaction-log deduplication. Receipt and exact ledger credit commit together. Credit 24/7 after verification, with no deposit delay/rejection. Runtime scans repair missed work directly from persisted records.

Deliver employee assigned-address/history DTO endpoints and authorized paginated admin deposit-history endpoints. Deliver the ADMIN-only manual-credit endpoint needed by P09, reusing the ledger primitives with exact amounts, reason/reference, payload-bound idempotency, source classification, and server-derived audit. Label manual credits separately; never fabricate or edit a chain receipt.

Add a protected operator-triggered fixed-treasury sweep tool, safe resource-funding instructions/caps, and basic reconciliation. No automatic energy trading, complex sweep batching, or automatic top-up engine. Sweeps do not change employee balances. Treasury funding is an operator responsibility; employee payout scheduling will remain automatic.

**Test files:** `custody-recovery.integration.test.ts`, `key-storage.security.test.ts`, `deposits.integration.test.ts`, `deposit-recovery.integration.test.ts`, `treasury-sweeps.integration.test.ts`; separate opted-in `custody.testnet.test.ts`, `deposits.testnet.test.ts`, `sweeps.testnet.test.ts`.

**Required assertions:** Fresh key recovery after VPS loss; no secret leak; duplicate/multiple logs; wrong token/network/recipient; unfinalized/disappearing candidate; fractional amount; pagination/restart; weekend credit; safe sweep/lost acknowledgement; no second employee credit; owner/admin DTO separation and manual-credit role, reason/reference, duplicate/payload-conflict, source, and audit enforcement.

**Gate:** Real controlled testnet provisioning/deposit/sweep evidence and isolated tests pass before P09. Missing testnet prerequisites mean this gate remains incomplete.

### P09 - Deposit Frontend

Connect employee deposit and admin history. Show the assigned public address/QR/copy, configured token/network, truthful detection state, persisted amount/history, and optional configured explorer links. User input/TxID never authorizes a credit.

Remove deposit 72-hour/rejection UI. Admin manual credit is distinctly labeled and uses reason/reference/confirmation through audited ledger primitives. Poll with bounded backoff while relevant; server facts determine the balance.

**Test files:** `deposit-card.test.tsx`, `deposits-screen.test.tsx`, adapters/hooks, and `deposits.spec.ts`.

**Gate:** Correct account/address/amount persists after reload, duplicates never appear as extra credits, and network-delay/error/phone QR/address states work. Run the second full current regression checkpoint.

### P10 - Withdrawal Reservation and Weekday Scheduling Backend

Implement initial employee address confirmation through a user/address-bound single-use email link. Implement server quote/acceptance with applicable fee snapshot (initially 21%), bounds, net, destination/version, source allocation, entitlement, deadline, and idempotency. Reserve gross atomically and enforce one active request in PostgreSQL across every scheduled/signing/submitted/unknown state.

Use withdrawal rows as durable work records: dueAt, state, scheduleVersion, immutable reservation, eligibility, and attempt identity. A periodic DB scan atomically claims due work and repairs missed Redis wakeups; every job rereads authoritative state/deadline. Add positive weekday-hour extensions to the existing deadline and make old jobs harmless.

Implement safe rejection/cancellation services, exact source release, account-ban/withdrawal-block integration, and the cancellation primitive for future admin address replacement. Cancel only safely unsent scheduled requests. Subscription expiry alone does not cancel an accepted request. No 24-hour cooldown or per-request hold action.

**Test files:** `withdrawal-reservation.integration.test.ts`, `withdrawals-concurrency.integration.test.ts`, `withdrawal-clock.test.ts`, `withdrawal-scheduler.integration.test.ts`, `withdrawal-cancellation.integration.test.ts`.

**Required assertions:** One active request across devices; mixed source locks/refunds; concurrent purchase; fee snapshots; Friday/weekend/cutoff rules; expiry continuation; stale extension jobs; repeated rejection; lost wakeup/Redis restart; cancellation-versus-claim race.

**Gate:** Durable reservations/scheduling and all active-state constraints pass. Admin address-replacement endpoint/UI is finalized in P13/P14; never redirect a live request.

### P11 - Automatic Payout and Recovery Backend

Extend protected signer policies for fixed USDT treasury payouts. Validate durable request/network/token/source/recipient/net and independent resource/treasury limits. Persist signed attempts, TxID, and broadcast intent before broadcast; retries reuse the same attempt.

Verify successful canonical-final receipt before atomic settlement/status/fee/audit. Unknown responses, process crashes, lost signer replies, and lost broadcast acknowledgements remain active/reserved until reconciled. Do not refund or create another payment because of a timeout. Replacement requires proof the prior attempt cannot execute/succeed; otherwise escalate. Company network costs never add employee deductions.

Complete worker claims/cancellation race handling, basic liquidity/resource alerts, and a protected emergency new-dispatch pause. Do not pause confirmation/reconciliation of already sent transfers on weekends or during a dispatch pause.

**Test files:** `signer-security.test.ts`, `payout-recovery.integration.test.ts`, `withdrawal-settlement.integration.test.ts`, `worker-restart.integration.test.ts`, and opted-in `payouts.testnet.test.ts`.

**Gate:** Testnet payout, finality, lost-ack/crash/retry, and source settlement evidence pass. Both P10 and P11 must pass before P12.

### P12 - Withdrawal Frontend

Connect employee withdrawal/account initial destination and admin withdrawals. Display server gross/rate/fee/net, eligibility, fixed destination, state, calculated due date, and remaining counted hours. Disable creation for all active states, including UNKNOWN, and allow it after safe terminal completion/rejection.

Use confirmation for requests/rejections/extensions and the initial address flow. Replace hold with a positive-hours extension dialog. Handle expiry continuation, stale/refetch/cross-tab conflicts, and uncertain payout status without claiming refund/failure. Admin address replacement waits for P14.

**Test files:** `withdrawal-form.test.tsx`, `withdrawal-status-card.test.tsx`, `withdrawals-screen.test.tsx`, extension/address/adapters, and `withdrawals.spec.ts`.

**Gate:** Real reservation/lifecycle persists, concurrent attempts create one request, weekend countdown is accurate, and mobile tables/dialogs work. Run the third full current regression checkpoint.

### P13 - Cross-Domain Administration Backend

Finish employee indexed search/detail across account, subscriptions, finance, tasks/evidence, deposits, withdrawals, referrals, codes, sessions, and audit. Reuse established services for restrictions, source-preserving adjustments/manual credits, and destination replacement with safely unsent cancellation.

Add deactivation/soft deletion without financial/sponsor/address/audit cascades or address reassignment. Preserve in-flight payouts and retained deposit attribution. Complete allowed settings counters/audits, dashboard aggregates, admin lifecycle, and approved FAQ/terms/privacy/support projections. Actors/times come from server identity; ordinary settings never expose custody/email secrets.

**Test files:** `employee-administration.integration.test.ts`, `settings-api.integration.test.ts`, `audit-log.integration.test.ts`, `dashboard-projections.integration.test.ts`.

**Gate:** Every operation needed by final admin/home/account/policy screens is authorized and tested, including restriction/address races and financial history preservation.

### P14 - Final Admin, Home, Account, and Policy Frontend

Connect employee home/account completion/support/FAQ/terms/privacy and admin home/employees/detail/settings/admins/audit. Bind all detail tabs and existing confirmations to real APIs. Complete admin address-replacement/adjustment/restriction/deletion workflows here, after P13.

Use real company email when configured; do not invent a contact address. Update approved Arabic copy to all latest rules. Complete cross-domain query refresh and remove production fixture authority, global AdminStateProvider, hard-coded CURRENT_ADMIN, and fake mutation actions. Keep only UI input/filter/dialog/preview state and isolated test fixtures.

**Test files:** `employee-detail-screen.test.tsx`, admin action dialog tests, home/settings/audit tests, policy assertions, `employee-administration.spec.ts`, `summaries-settings-and-policy.spec.ts`.

**Gate:** All 36 existing OSCAR routes plus the new admin sign-in route (37 total) and required popups are connected, policies are truthful, and no production mock can alter financial truth. Run full functional/security regression before deployment work.

### P15 - Integrated Verification, Deployment, Restore, and Release

Finish the cross-domain security/money/route review using existing phase tests, adding only missing regression cases. Run controlled failure injection for mixed spending/rewards/deposits/payouts, role/resource abuse, uploads, stale credentials, and secret exposure. Do not recreate identical acceptance suites just for paperwork.

Build/verify Linux VPS Docker deployment for web/API/worker/private signer/PostgreSQL/Redis/proxy. Reuse same-origin API routing. Configure protected secrets/ports, TLS/cookies/security headers, non-root processes, private persistent files, migrations, health, shutdown/restart, and basic operational alerts.

Test off-VPS key recovery, WAL/point-in-time DB recovery, private file lifecycle, and signer-attempt recovery. Fence dispatch/writes during restore; recover post-snapshot off-chain commits and reconcile chain activity before resuming. Test unknown payout restore without a new send. Document a short deploy/rollback/recovery procedure and operational owner.

Run one representative capacity check on the actual staging VPS; the target is 1000 registered employees over a year, not 1000 simultaneous users. Complete owner UAT and a full controlled testnet journey. Do not build a standalone benchmarking/monitoring platform. Obtain independent money/security review and explicit owner authorization before any real-money pilot; record outstanding configuration/risk instead of enabling mainnet.

**Test files:** Extend existing E2E/recovery tests; add only needed `cross-domain-financial.integration.test.ts`, `authorization-matrix.integration.test.ts`, `production-config.test.ts`, `backup-restore.integration.test.ts`, `release-acceptance.spec.ts`. A small opted-in capacity script and testnet evidence supplement tests, not a new tool framework.

**Gate:** Full checks, testnet/UAT, deployment/restore, basic capacity evidence, configuration, and owner release approval pass. Missing infrastructure, financial recovery gaps, or unaccepted high-risk findings prevent release. No claim of guaranteed security.

## 8. Route Coverage Register

The existing OSCAR scope is 17 employee routes and 19 admin dashboard routes, 36 total. The explicit administrator email/password requirement adds the proposed `/admin/auth/login` route, for 37 covered routes. Other generic boilerplate/entry routes are not additional OSCAR product pages. The admin login route is new planned work, not a claim that it exists in the current repository.

### Employee Routes

| Route | Responsibility | Frontend Phase |
| --- | --- | --- |
| `/employee` | Personal summary, task/subscription/wallet status | P14 |
| `/employee/tasks` | Daily availability, code unlock, screenshot/declaration, submission status | P07 |
| `/employee/packages` | Catalog, quote, purchase/upgrade, subscription terms | P05 |
| `/employee/team` | Fixed invite identity, relative team levels, commissions | P05 |
| `/employee/wallet` | Server balances, source restrictions, reservations, history/detail | P05 |
| `/employee/deposit` | Assigned address/QR/copy and verified history | P09 |
| `/employee/withdraw` | Eligible funds, fixed destination, quote/request/lifecycle | P12 |
| `/employee/account` | Profile/password/logout, subscription/wallet links, address | P03; domain sections P05/P12/P14 |
| `/employee/support` | Company email contact | P14 |
| `/employee/faq` | Approved current business-rule answers | P14 |
| `/employee/terms` | Approved current terms | P14 |
| `/employee/privacy` | Approved retention/privacy policy | P14 |
| `/employee/auth/login` | Real login and role-aware destination | P03 |
| `/employee/auth/register` | Email/password, optional sponsor | P03 |
| `/employee/auth/verify-email` | Single-use verification link result/resend | P03 |
| `/employee/auth/forgot-password` | Safe reset request | P03 |
| `/employee/auth/reset-password` | Single-use password reset | P03 |

### Admin Routes

| Route | Responsibility | Frontend Phase |
| --- | --- | --- |
| `/admin/auth/login` (proposed) | Dedicated email/password admin sign-in; shared auth; no public admin signup | P03 |
| `/admin` | Authoritative operational/financial summary | P14 |
| `/admin/employees` | Indexed search/filter/paginated list | P14 |
| `/admin/employees/[employeeId]` | Full authorized detail/actions/history | P14 |
| `/admin/packages` | Package configuration with saved purchase terms | P05 |
| `/admin/tasks` | Daily task list/publication | P07 |
| `/admin/tasks/new` | Create task | P07 |
| `/admin/tasks/[taskId]` | Details, codes, submissions | P07 |
| `/admin/tasks/[taskId]/edit` | Edit permitted future/current content safely | P07 |
| `/admin/submissions` | Private evidence review/final decisions | P07 |
| `/admin/codes` | Codes, states, usage summaries | P07 |
| `/admin/codes/new` | Create task code | P07 |
| `/admin/codes/[codeId]` | Successful usages/accounts/times | P07 |
| `/admin/deposits` | Verified deposit history and separately labeled manual credits | P09 |
| `/admin/withdrawals` | Scheduled/in-flight history, remaining time, rejection/extension | P12 |
| `/admin/finance` | Added/deducted/reserved entries and detail | P05 |
| `/admin/referrals` | Root-relative tree/commission history | P05 |
| `/admin/audit-log` | Server actor/action/time/reason changes | P14 |
| `/admin/settings` | Allowed settings with saved operation terms | P14 |
| `/admin/settings/admins` | ADMIN invitations and lifecycle | P03; final integration P14 |

Required popup/dialog coverage includes purchase quote confirmation; password change; initial withdrawal address confirmation; ledger details; withdrawal confirmation; schedule extension; rejection; employee ban/task/withdraw restrictions; admin address change; balance adjustment/manual credit; deletion; code enable/pause; final task review; and admin invitation/deactivation as applicable to existing screens. Reuse existing dialog primitives instead of duplicating modal code.

## 9. Focused Testing and Verification

Every implementation phase adds or extends actual automated test files for its behavior. Tests are not postponed to P15. Names in phase descriptions are responsibilities, not an instruction to create one tiny file per assertion; combine overlapping cases and follow existing colocated test patterns.

Use real migrated PostgreSQL for balances/constraints/transactions/concurrency, real test Redis for worker scheduling, actual isolated file storage for upload/access, and network-boundary doubles for provider/email behavior. Fixed clocks and explicit concurrent connection barriers are required for financial races. Test user-visible results and persisted state, not internal helper calls.

### Commands and Ownership

The root/package manifests already provide these commands. Run the relevant package/file scope per phase; its report must show what actually ran:

```sh
pnpm --filter @template/contracts test
pnpm --filter @template/api test
pnpm --filter @template/api test:integration
pnpm --filter @template/database test
pnpm --filter @template/database test:integration
pnpm --filter @template/web test
pnpm lint
pnpm check-types
pnpm build
pnpm verify:build-output
pnpm verify
```

Do not run every command after every small edit. Full current regression checkpoints are P05, P09, P12, P14, and final P15; intermediate phases run affected suites and relevant shared regressions. All money/security requirements remain tested. Review command formatting scope before touching unrelated dirty files.

Add an actual web Playwright script/config in P03 if absent. Proposed `test:e2e` maps to the configured runner; a group invocation is `pnpm --filter @template/web test:e2e e2e/<group>.spec.ts`. Add a separately gated API `test:testnet` profile in P08 and verify its actual invocation before documenting success. Neither command is claimed to exist now. Worker/signer builds and tests use their registered existing-package profiles; do not create another test framework.

| Phase | Primary Proposed Test Ownership | Services / Evidence |
| --- | --- | --- |
| P01 | `apps/api/src/core/financial/money.test.ts`; `apps/api/src/modules/ledger/ledger.service.integration.test.ts`; `packages/contracts/src/financial/financial.schema.test.ts` | Real migrated Postgres; money/calendar/source/concurrency outcomes |
| P02 | `apps/api/src/modules/auth/oscar-auth.integration.test.ts`; `apps/api/src/modules/admins/admin-invites.integration.test.ts` | Test auth/DB; email boundary double; admin password sign-in, role/link/session results |
| P03 | Employee/admin auth colocated component/adapter tests; `apps/web/e2e/identity-and-admin-access.spec.ts` | Real test web/API/DB; dedicated admin sign-in and responsive authenticated behavior |
| P04 | `apps/api/src/modules/subscriptions/subscription-purchase.integration.test.ts`; referral/wallet colocated integration tests | Real Postgres; atomic purchase/award/source outcomes |
| P05 | Employee/admin package/team/wallet/finance tests; package/wallet/referral E2E suites | Real test app; first full regression checkpoint |
| P06 | Asset/task/code/review colocated integration tests | Real files/Postgres, fixed clock; approval/claim/retention races |
| P07 | Task/code/review component/adapters; `apps/web/e2e/tasks-codes-and-review.spec.ts` | Real test app and private file fixtures |
| P08 | Custody/deposit/treasury integration tests; `apps/api/testnet/*.testnet.test.ts` | Protected test custody/recovery store; opted-in testnet evidence |
| P09 | Deposit adapters/components; `apps/web/e2e/deposits.spec.ts` | Real test app; credit/address behavior; full regression checkpoint |
| P10 | `apps/api/src/modules/withdrawals/withdrawal-reservation.integration.test.ts`; scheduler/cancellation tests | Real Postgres/Redis, fixed clock; lost wakeup/concurrency/source outcomes |
| P11 | Signer/payout/recovery colocated tests; opted-in payout testnet suite | Protected test signer; durable attempts/finality/restore outcomes |
| P12 | Withdrawal components/adapters; `apps/web/e2e/withdrawals.spec.ts` | Real test app; active state/refund/deadline behavior; full checkpoint |
| P13 | Employee/admin/settings/audit colocated integration tests | Real DB; cross-domain authority/action/history results |
| P14 | Admin/home/policy component tests; admin/policy E2E suites | All 37 routes, including dedicated admin sign-in, and full current regression |
| P15 | Cross-domain/security/deployment/restore tests plus `apps/web/e2e/release-acceptance.spec.ts` | Production-like staging, restored state, testnet/UAT, basic capacity result |

Paths above are proposed and repository-relative. Put sibling named tests from each phase beside the actual module/component they test, and identify exact paths in that phase's task list. Extend existing database inventory/auth regression files rather than replacing them. Preserve production incident regressions.

Keep one concise result per phase, with useful failing traces/screenshots under an ignored verification output directory. There is no mandatory separate approval framework or giant evidence matrix for each task. Never include keys, signing payloads, session tokens, or actual private user proofs in shared test output.

### Financial Failure Cases That Must Remain

| Scenario | Expected Observable Result |
| --- | --- |
| Same transfer event scanned 100 times | One receipt and one employee credit |
| Two valid transfer logs in one transaction | Each distinct eligible log credited once |
| Fake USDT symbol/wrong contract/network | No wallet credit |
| Two concurrent package purchases | Only allowed atomic transition; no overspend/duplicate commission |
| Upgrade after today's submission | No second daily claim/reward |
| Admin approves twice/concurrently | One reward posting and one final outcome |
| Approve versus reject race | Exactly one final decision |
| Two withdrawal requests from different devices | One active request/reservation |
| Free tries to withdraw retained commissions | Denied; own funds still eligible |
| Free buys using retained commissions | Referral-first debit and valid activation |
| Paid subscription expires during reserved withdrawal | Original eligible request continues |
| Rejection repeated after expiry | Original reservation released once, referral lock preserved |
| Extension versus stale due job | No early dispatch |
| Block/address change versus signing | Either safe unsent cancellation or active reconciliation; never sent-and-refunded |
| Broadcast succeeds but response is lost | Same durable attempt reconciled; no new payout/refund |
| Redis lost after acceptance | DB reservation survives; scheduler repairs missed wakeup |
| Restore older DB backup | Recover post-snapshot off-chain commits and reconcile chain activity before dispatch; no lost wallet history or duplicate payment |
| Role/amount/subscription/deadline forged from browser | Rejected or server-derived; no unauthorized state change |
| Private proof ID requested by another user | No file/data access |
| Log/error/browser build inspected | No private keys, seeds, auth secrets, or private signing payloads |

### Browser and Testnet Gates

Preserve Cairo/RTL and approved mobile controls. Check each integrated route's normal view on phone and desktop, with focused 320px narrow-screen checks for challenging forms/tables/dialogs and representative 390/430px phone screenshots. Cover relevant loading/empty/error/restricted/pending/conflict states through component/E2E tests; do not mechanically multiply every state across every viewport.

Reject page-level overflow, clipped Arabic, hidden bottom-nav content, broken images, incoherent overlap, unreadable buttons, and inaccessible dialogs. Keep practical touch targets, equal-height paired fields, inline icon/text, pointer cursors, focus visibility, and LTR isolation for amounts/addresses/email/codes. Unexpected console errors or privileged API calls fail the relevant test.

Controlled testnet runs require an explicit network/token, fresh test-only credentials, designated recipients, provider access, and test funding. Fail if configuration resolves to mainnet; no fallback. Exclude testnet files from normal unit/integration discovery. Record public TxIDs/final outcomes and reconciled amounts, never secrets. Missing required testnet infrastructure means the gate is not passed.

## 10. Use with the Owner-Prepared Spec Kit

Spec Kit installation, initialization, and constitution preparation are owner-owned prerequisites and are intentionally absent from the phases. Use the existing supplied artifacts and registered command form; do not create a setup phase or repeat constitution approval.

Keep one shared decision baseline and grouped tasks. Generate/update only the specification/technical tasks needed for the selected domain, using the owner's workflow. Avoid repeating the same requirements across separate artifacts for every tiny step. Resolve a genuine new conflict, but do not reopen already approved fees, duration, no 2FA, or payment formulas.

The documented notation below is illustrative; use the actual installed integration form. Spec Kit supports bounded task/phase implementation, which is appropriate here. [Spec Kit workflow](https://github.github.com/spec-kit/reference/agentic-sdd.html), [bounded implementation](https://github.github.com/spec-kit/concepts/complex-features.html).

```text
Generate tasks only for the selected OSCAR phase from the lean roadmap.
Preserve its business rules, dependencies, backend-before-frontend gate,
actual test files, money invariants, and approved UI/boilerplate.
Use small task batches, not extra formal phases or setup ceremonies.
Do not add a generic outbox, version registry, or speculative modules.
```

```text
Implement only Phase Pnn or the explicitly selected task range.
Read the owner's existing constitution, instructions, and applicable skills.
Do not reinstall/initialize Spec Kit or regenerate the constitution.
Verify prerequisite phase gates; preserve unrelated edits and approved UI.
Write and run the focused tests and relevant shared regressions.
Stop with changed files, actual results, unmet gates, and remaining risks.
Do not move to the next phase or use mainnet/spend money automatically.
```

## 11. Tools and Operational Defaults

Keep the installed Express/Prisma/Postgres/Zod/Resend/Axios/React Query/React Hook Form/Next.js/Tailwind/Cairo/Lucide/Radix/Vitest/Testing Library/Supertest/Testcontainers stack. Verify any added package version against the locked Node/pnpm environment; do not blindly upgrade existing packages.

Add only what the implemented phase needs: TronWeb/TronGrid for protected custody/network access; Redis/BullMQ for background wakeups; a maintained timezone-aware library for Baghdad calendars; maintained multipart/type/image processing for private proofs; Playwright for browser tests. Optional HTTP-boundary mocking or shared limiter storage is justified only by an actual test/deployment need.

Use one VPS/Linux/Docker deployment, one worker initially, and a protected signer process. No self-hosted TRON node, service mesh, automated staking/energy trading, external custody provider, full accounting platform, or bespoke monitoring/load-testing platform is required.

The company must fund its treasury and network resources. Operator-driven sweeps use protected tooling and persisted attempts; keys are not copied into scripts, CLI arguments, or the dashboard. Employee deposit credit and due payout execution remain automatic.

## 12. Launch Prerequisites and Exclusions

Before launch select the actual VPS configuration, company/support email and Resend domain, TronGrid access plan, network/token identifiers, treasury/resource caps, recovery owner/storage, and basic alert destination. Verify the actual workload; 1000 employees is a year-scale account target, not a concurrency promise.

Excluded unless separately requested: leadership ranks/bonuses, KYC, admin 2FA, dual approval, withdrawal PIN, banners/announcements, notifications, support chat/tickets, dark mode, other assets/networks, user-controlled custody, deployed custom smart contracts, automatic energy markets, and security/return guarantees.

No customer requirement is removed by the lean phase structure. The deliverable remains a working application, tested money/control paths, accurate contracts/migrations, protected signing, and usable deployment/restore instructions. Attractive screens or mock-only financial tests do not satisfy the plan.
