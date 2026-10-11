# P09 Data Model and State Ownership

**Status**: Proposed integration design; no model/migration is added by PLAN.
Wire definitions remain owned by
[withdrawal.schema.ts](../../packages/contracts/src/withdrawals/withdrawal.schema.ts)
and [wallet.schema.ts](../../packages/contracts/src/wallet/wallet.schema.ts).
Existing persistence and constraints remain in
[schema.prisma](../../packages/database/prisma/schema.prisma) and the applied P08
migrations. This document describes consumer relationships, not a second schema.

## Existing authoritative entities

| Entity             | Fields consumed by P09                                                                                                                                                                                                               | Relationship and validation                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet/eligibility | available/reserved referral/non-referral, total, eligible/locked referral, membership/restrictions, serverNow                                                                                                                        | Employee-owned; unreserved funds only. Free/expired locks referral for new withdrawal while preserving ownership. Pending task rewards never become funds.     |
| Destination        | UNSET; or PENDING address/network/version/issuedAt/expiresAt/nextIssuanceAt/proofStatus/deliveryStatus; or CONFIRMED address/network/addressVersion/confirmedAt                                                                      | One employee destination. Initial proof is latest-user/address/version bound and single-use. Confirmed destination is employee-readonly; P10 owns replacement. |
| Quote              | quoteId, quotedAt/expiry/serverNow, gross/feeBps/fee/net, min/max, eligible sources, fundedAllocation/top-up, canAccept/blockReason, recipient/network/addressVersion, eligibility snapshot, preview/calendar                        | Belongs to employee/destination/wallet. Quote is review identity, not reservation. First acceptance revalidates material facts and capability.                 |
| Accepted request   | id/quoteId, acceptedAt, version/scheduleVersion/state, money/eligibility/recipient/source snapshots, calendar/originalDueAt/dueAt/dispatchAt, serverNow/remaining counted time, blocker/actions, TxID/settlement/release/finalizedAt | One active per employee; original immutable terms survive expiry. Current due/version may change only by server transitions. No browser status setter.         |
| Action             | id/kind/occurredAt/actorUserId/reason/committedVersion/dueAt/scheduleVersion                                                                                                                                                         | Append-only request history, latest100 in ordinary DTO. Actor may be null for a server operation. Do not invent actor names or a CURRENT_ADMIN fixture.        |
| Attempt/settlement | Only public transaction/finality/accepted money/source facts                                                                                                                                                                         | Attempt identity/signed material remains protected. Canonical final success settles original gross into accepted net+fee exactly once.                         |
| Release            | original gross/sourceAllocation, chargedFee="0", releasedAt                                                                                                                                                                          | Only proven safe REJECTED/CANCELLED/FAILED; source-identical release once. No release from an unknown payment.                                                 |

Money strings use exact micro-USDT, max six decimals and shared representable bounds.
Initial business bounds are 16-500 gross; fees use applicable saved terms, initially
2100 basis points, floored to one micro-USDT. Gross=fee+net; reserve gross, with eligible
non-referral first. Company network costs are not employee deductions.

## Proposed compatibility projections

### Admitted new-request capability

The existing wallet/status `withdrawalExecutionReady` changes from literal false to
boolean. One server helper derives it from validated public payout UUID/network/token,
this registered API boot's current acknowledged generation, no financial fence and
no dispatch pause. It is not a provider-health/signer-heartbeat or balance field.
No new stored readiness flag is created. Missing configuration/admission means false;
unexpected read errors do not become false or empty financial data.

Withdrawal status also gains nullable configured `network` for exact network review
before first issuance. Pending/confirmed destination keeps its saved network; missing
or incompatible configuration blocks issuance without rewriting saved read facts.

Both wallet views and withdrawal status consume the same helper. Quote/first acceptance
recheck it under existing admission locks. Reads/outcome observation do not require
mutation admission. Existing accepted obligations persist during pauses/shortages.

### Administrator request view

Proposed admin request/history schema composes the existing validated request with:

- `employee`: existing `employeeFinancialIdentitySchema` (`id`, `fullName`, `email`).
  This is current identity, matching current admin search, not a historical snapshot.
  Payment recipient/terms remain immutable request snapshots.
- `canExtend`, `canReject`: same server-safe predicate: SCHEDULED, no attempt,
  current API mutation admission and version/scheduleVersion below existing limits.
  Dispatch pause alone does not forbid safe admin actions. Flags are hints; atomic
  backend write guards decide authority/races.

Use a separate admin select/include/mapper, with no per-row directory requests or
extra identity fields in employee responses. Existing command responses stay the base
`{ withdrawal, replayed }`; refetch enriched admin detail/list after a command.

### Administrator command outcome

Proposed outcome read identifies actor from current authentication, then uses existing
unique actorScope/kind/requestKey. Verify target and original expectedVersion. Return
COMMITTED plus safe original action/current admin view, NOT_OBSERVED for equal current
version, or SUPERSEDED for an advanced version with no matching action. A future
version or mismatched key binding conflicts. See [contract](contracts/withdrawals.md#proposed-admin-command-observation).

This requires no action table/index/migration. Lookup is independent of ordinary
latest100 history. SUPERSEDED proves only old first-write impossibility; it cannot
be shown as this admin's success, completion or release.

## Lifecycle consumed, never authored, by the browser

| State     | Reservation/disposition              | P09 behavior                                                                                      |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| SCHEDULED | Active gross reservation             | Creation disabled; safe admitted admin extension/rejection only. Show deadline/countdown/blocker. |
| SIGNING   | Active; protected attempt may begin  | Readonly, creation disabled; no refund/rejection/redirection.                                     |
| SIGNED    | Active; immutable attempt exists     | Readonly, creation disabled; no fresh payment or local cancellation.                              |
| SUBMITTED | Active; chain outcome pending        | Readonly, creation disabled; observed receipt determines outcome.                                 |
| UNKNOWN   | Active uncertainty                   | Readonly, creation disabled; reservation retained until reconciliation.                           |
| COMPLETED | Canonical final settlement           | Show exact accepted net+fee/TxID/settlement, refresh wallet; revalidate new eligibility.          |
| REJECTED  | Safe original-source release         | Show gross/source release and zero charged fee, refresh wallet.                                   |
| CANCELLED | Safe original-source release         | Show actual server reason/disposition; never locally redirect the accepted recipient.             |
| FAILED    | Proven safe terminal failure/release | Show release evidence, not a timeout-derived failure.                                             |

P08 alone owns legal transitions, claims, signing, retries, finality and recovery.
P09 sends only quote/accept, first-destination proof commands and safe scheduled
extension/rejection. No employee cancel, manual Complete, hold/release or arbitrary
state transition is exposed.

The calendar is Asia/Baghdad, 72 counted hours, excluding Saturday/Sunday. Original
deadline is retained, extension adds positive counted duration to current deadline,
and dispatch may normalize to the next eligible weekday. Counted remaining duration
is a server snapshot; zero does not imply dispatch/payment. Reconciliation may finish
on weekends or while new dispatch is paused.

## Client-owned transient and recovery state

| State                              | Owner/lifetime                                                 | Permitted contents and disposal                                                                                                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amount/address/reason/hours drafts | RHF/feature interaction                                        | Text only; preserve dirty drafts on same-authority refresh, clear on actual identity/resource retirement.                                                                                                                          |
| Reviewed quote/dialog selection    | Feature hook and component                                     | Validated server facts bound to account/quote or target/version; stale facts cannot silently replace reviewed terms.                                                                                                               |
| Acceptance recovery handle         | Feature command runtime; actor-scoped opaque storage precedent | quoteId/requestKey and actor binding only; retire on proven no-send or the contract's definite first-dispatch rejection; uncertain/reloaded handles require original-quote reconciliation. No balances, tokens or response bodies. |
| Admin action recovery handle       | Feature runtime                                                | actor/target/kind/key/expectedVersion and non-secret intent fingerprint; original body stays private memory. Manual retry must reproduce exact reviewed intent; no edited-body/new-key replay.                                     |
| Destination proof                  | Private cache-free ref/closure for current account-route flow  | Opaque token only until explicit consume/settlement or teardown; no storage, Query/mutation retention, props/navigation/telemetry. Anonymous/account switch requires reopening email.                                              |
| Lists/details                      | Scoped TanStack Query                                          | Server-owned safe DTOs keyed by current authority/resource/filter/page; cancellation, denial and retirement prevent obsolete disclosure.                                                                                           |
| Counted-time label                 | Pure display of server DTO                                     | No browser scheduling/financial transition or elapsed weekend subtraction.                                                                                                                                                         |

The destination credential is different from an opaque money-command recovery handle:
it authorizes proof consumption and must never persist. An uncertain command or
network error is not a new entity, failed payout, zero balance or permission to refund.
The definite-rejection exception cannot clear a prior unresolved dispatch. No rejection
record or new server entity is added; reload cannot reconstruct proof of rejection from
the opaque handle. Observation-budget exhaustion never clears this handle or its guard.
