# Withdrawal Requirements Quality Checklist: P09

**Purpose**: Review the completeness, clarity, consistency and measurability of P09's financial, recovery, authority and frozen-UI requirements.

**Created**: 2026-10-09

**Feature**: [P09 - Withdrawal Frontend](../spec.md)

**Depth / audience / timing**: Standard, risk-focused; author and reviewer before task generation and implementation review.

**Status**: Reviewed on 2026-10-09 during the owner-authorized IMPLEMENT preflight; CHK001–CHK036 pass written requirements/design review. This is not implementation or test acceptance.

**Basis**: [Clarified spec](../spec.md), [plan](../plan.md), [integration contract](../contracts/withdrawals.md), [validation guide](../quickstart.md), [roadmap P09](../../../PLAN.md#p09---withdrawal-frontend), [constitution](../../../.specify/memory/constitution.md) and [engineering guides](../../../docs/engineering/README.md).

## Requirement Completeness

- [x] CHK001 Are the authorized withdrawal/account/admin surfaces, necessary compatibility corrections and P08/P10/P11 exclusions explicit enough to prevent scope expansion? [Completeness; [Spec §Roadmap Scope and Gates](../spec.md#roadmap-scope-and-gates-mandatory); [Plan §Summary](../plan.md#summary)]
- [x] CHK002 Are readiness, administrator identity/safe-action availability and exact command-outcome observation all documented as backend prerequisites to dependent frontend wiring? [Completeness; Spec §FR-001, FR-020–FR-023; [Plan §Backend Compatibility and Gate](../plan.md#backend-compatibility-and-gate)]
- [x] CHK003 Are first-address review, pending/resend/expiry, truthful delivery acknowledgement, explicit authenticated confirmation and confirmed read-only presentation fully specified on the approved existing surfaces? [Completeness; [Spec §FR-004–FR-007](../spec.md#functional-requirements); [Plan §Initial destination](../plan.md#initial-destination)]
- [x] CHK004 Are all nine states and their required recipient/network, money/disposition, schedule, blocker and authorized audit details specified, including current employee identity for admin inspection? [Completeness; Spec §FR-016, FR-020, FR-023; [Contract §Proposed admin-only projection](../contracts/withdrawals.md#proposed-admin-only-projection); [Spec §OD-003](../spec.md#owner-presentation-decisions)]
- [x] CHK005 Are employee 25-row and admin 10-row history requirements complete for server search/filter scope, ordering, matching counts and empty/filtered-empty/out-of-range recovery, without invented totals? [Completeness; Spec §FR-020; [Contract §Lifecycle, paging, refresh and errors](../contracts/withdrawals.md#lifecycle-paging-refresh-and-errors)]

## Requirement Clarity

- [x] CHK006 Are positive amount syntax, permitted normalization, six-decimal precision and inclusive current bounds (initially 16–500 USDT) defined without relying on local numeric rounding? [Clarity; [Spec §FR-008](../spec.md#functional-requirements); [Plan §Quote, lifecycle and history](../plan.md#quote-lifecycle-and-history)]
- [x] CHK007 Are saved applicable rates, micro-USDT fee flooring, gross reservation, exact gross = fee + net and company-paid network costs unambiguous? [Clarity; [Spec §FR-009–FR-010](../spec.md#functional-requirements); [Roadmap §Gross / Fee / Net](../../../PLAN.md#gross--fee--net)]
- [x] CHK008 Is eligible funding clearly distinguished from total ownership, covering reserved funds, pending task rewards, Free/expired retained referrals and non-referral-first allocation? [Clarity; [Spec §FR-011](../spec.md#functional-requirements); [Roadmap §3.3](../../../PLAN.md#33-wallet-sources-and-spending)]
- [x] CHK009 Is readiness defined as admitted new-request capability, with missing/malformed/unexpected-error cases distinguished from signer/provider health, liquidity and employee eligibility? [Clarity; Spec §FR-001, FR-009, FR-024; [Contract §Proposed readiness and pre-issuance metadata correction](../contracts/withdrawals.md#proposed-readiness-and-pre-issuance-metadata-correction)]
- [x] CHK010 Are Baghdad's 72 counted weekday hours, original/current deadline, earliest dispatch, server remaining-time snapshot and zero-countdown meaning specified consistently for extensions? [Clarity; [Spec §FR-017, FR-021](../spec.md#functional-requirements); [Spec §SC-005](../spec.md#measurable-outcomes)]
- [x] CHK011 Are admin review requirements precise about safely unsent state, current detail/version, supported positive fractional hours, reason limits and the affected request/current deadline/added-hours confirmation? [Clarity; Spec §FR-021–FR-023; [Plan §Admin scheduled actions](../plan.md#admin-scheduled-actions)]

## Requirement Consistency

- [x] CHK012 Do quote, lifecycle and admin requirements consistently preserve accepted money/source/eligibility/recipient snapshots through expiry and later restrictions/address changes, separating current identity from saved payment facts? [Consistency; [Spec §FR-007, FR-018](../spec.md#functional-requirements); [Contract §Lifecycle, paging, refresh and errors](../contracts/withdrawals.md#lifecycle-paging-refresh-and-errors)]
- [x] CHK013 Are the five active and four terminal states consistently tied to reservation, confirmed settlement or source-identical safe release, zero charged fee on release and current eligibility without a 24-hour cooldown? [Consistency; [Spec §FR-013, FR-016, FR-019](../spec.md#functional-requirements); [Spec §SC-004, SC-006](../spec.md#measurable-outcomes)]
- [x] CHK014 Do OD-001–OD-003 and the plan consistently limit presentation changes while explicitly retiring obsolete payout/cooldown wording, manual completion, held release/filtering and unsafe processing-state actions? [Consistency; [Spec §Owner Presentation Decisions](../spec.md#owner-presentation-decisions); Spec §FR-022, FR-027; [Plan §Admin scheduled actions](../plan.md#admin-scheduled-actions)]
- [x] CHK015 Are current role/status/session/ownership restrictions and server financial authority consistent across reads, confirmation, acceptance and admin actions, rather than dependent on hidden controls or fixtures? [Consistency; [Spec §FR-002–FR-003, FR-025](../spec.md#functional-requirements); [Contract §Protocol and authority](../contracts/withdrawals.md#protocol-and-authority)]

## Acceptance Criteria Quality

- [x] CHK016 Do the monetary criteria define exact expected reservation/fee/net/source outcomes at bounds, six-decimal fee-floor boundaries and safe release, including the 100 = 21 + 79 example? [Measurability; [Spec §SC-002, SC-006](../spec.md#measurable-outcomes); [Validation guide §Test owners and required behavior](../quickstart.md#test-owners-and-required-behavior)]
- [x] CHK017 Are concurrency, replay, lost-reply and stale/claim-race criteria measurable in terms of one persisted winning effect, zero duplicate reservations/hour additions/releases and no fabricated refund? [Measurability; [Spec §SC-003, SC-007](../spec.md#measurable-outcomes); [Validation guide §Browser acceptance journeys](../quickstart.md#browser-acceptance-journeys)]
- [x] CHK018 Are phone/desktop RTL/Cairo, long exact amounts/addresses, keyboard/focus and confirmation requirements objectively bounded by the stated widths and zero overflow/clipped text/hidden actions criteria? [Measurability; Spec §FR-027; [Spec §SC-009](../spec.md#measurable-outcomes); [Plan §Technical Context](../plan.md#technical-context)]
- [x] CHK019 Do acceptance requirements distinguish real financial/HTTP persistence evidence from seeded lifecycle presentation and reused P08 evidence, including command effects whose replies are lost? [Evidence quality; Spec §FR-028; [Validation guide §Existing browser harness and proposed P09 support](../quickstart.md#existing-browser-harness-and-proposed-p09-support)]
- [x] CHK020 Are actual future test owners, affected regressions and the complete P09 checkpoint including browser evidence specified, with unavailable infrastructure leaving the gate incomplete? [Completeness; Spec §FR-028; [Validation guide §Test owners and required behavior](../quickstart.md#test-owners-and-required-behavior); [Validation guide §Commands for implementation verification](../quickstart.md#commands-for-implementation-verification)]

## Scenario Coverage

- [x] CHK021 Are acceptance recovery identity, pending guards across dismissal/remount/reload and storage/coordination failure requirements complete enough to prohibit an untracked or independent replacement command? [Recovery coverage; Spec §FR-013–FR-014; [Plan §Quote, lifecycle and history](../plan.md#quote-lifecycle-and-history)]
- [x] CHK022 Are COMMITTED, live NOT_OBSERVED and EXPIRED_UNCOMMITTED acceptance outcomes distinguished, with only proven safe disposition permitting a fresh reviewed attempt and no automatic financial replay? [Recovery coverage; Spec §FR-014, FR-026; [Contract §Quote and acceptance observation](../contracts/withdrawals.md#quote-and-acceptance-observation)]
- [x] CHK023 Are exact admin-key outcomes, supersession, immutable reviewed intent and same-body/key manual retry specified independently of truncated history, including observation-only recovery when original intent cannot be reproduced? [Recovery coverage; Spec §FR-023, FR-026; [Contract §Proposed admin command observation](../contracts/withdrawals.md#proposed-admin-command-observation)]
- [x] CHK024 Are competing devices, purchase/acceptance, admin extension/rejection, signing claim and authority-loss races covered by documented current-state/version checks and one allowed winning outcome? [Concurrency coverage; [Spec §Edge Cases](../spec.md#edge-cases); Spec §FR-013, FR-021–FR-023; [Spec §SC-003, SC-007](../spec.md#measurable-outcomes)]
- [x] CHK025 Are session/account/role/resource/page changes and late completions covered by explicit protected-data retirement, disabled handlers and prevention of updates to a different account or row? [Authorization coverage; Spec §FR-002, FR-025; [Plan §Scoped reads and freshness](../plan.md#scoped-reads-and-freshness)]
- [x] CHK026 Are shortages, dispatch pause, financial fence and provider uncertainty distinguished for new-request admission, safe admin changes and continued authorized observation, without releasing accepted funds or asserting failure? [Exception coverage; Spec §FR-001, FR-016, FR-022; [Plan §Backend Compatibility and Gate](../plan.md#backend-compatibility-and-gate)]

## Edge Case Coverage

- [x] CHK027 Are expired/superseded/replayed/wrong-account proofs, signed-out/reopened/same-route links, uncertain issuance/consumption and unavailable/incompatible configured networks covered without accidental confirmation or credential retention? [Edge coverage; Spec §FR-004–FR-007; [Plan §Initial destination](../plan.md#initial-destination); [Contract §Proposed readiness and pre-issuance metadata correction](../contracts/withdrawals.md#proposed-readiness-and-pre-issuance-metadata-correction)]
- [x] CHK028 Do time requirements address browser timezone/skew, background/resume, weekend boundaries, Saturday acceptance and fractional extensions, while separating new dispatch scheduling from already-sent reconciliation? [Edge coverage; [Spec §User Story 3](../spec.md#user-story-3---follow-scheduled-and-uncertain-payment-states-priority-p1); [Spec §Edge Cases](../spec.md#edge-cases); Spec §FR-017, FR-021]
- [x] CHK029 Are expiry and material quote changes to funds, membership, destination, fees or restrictions explicitly covered by fresh authoritative review and preservation of the amount draft? [Edge coverage; Spec §FR-012, FR-024; [Spec §User Story 1](../spec.md#user-story-1---review-and-reserve-a-withdrawal-priority-p1)]

## Non-Functional Requirements

- [x] CHK030 Are proof secrecy and disposal before protected navigation/telemetry, actor-scoped opaque recovery storage, admin-only identity and signer/credential isolation specified as distinct privacy boundaries? [Privacy; Spec §FR-006, FR-025; [Plan §Initial destination](../plan.md#initial-destination); [Plan §Technical Context](../plan.md#technical-context); [Contract §Proposed admin-only projection](../contracts/withdrawals.md#proposed-admin-only-projection)]
- [x] CHK031 Are safe feedback and freshness requirements complete for malformed/read/access/pending/unknown/empty results, preserving dirty drafts under valid authority and refreshing relevant withdrawal/destination/wallet facts without optimistic money edits? [Resilience; Spec §FR-015, FR-024–FR-026; [Plan §Scoped reads and freshness](../plan.md#scoped-reads-and-freshness)]
- [x] CHK032 Is “finite/bounded observation” precise enough to review its read/window budget or named existing policy, stop/restart conditions and exhaustion behavior, without equating exhaustion to failure or replaying commands? [Clarity, Ambiguity; Spec §FR-026; [Plan §Scoped reads and freshness](../plan.md#scoped-reads-and-freshness)]

## Dependencies & Assumptions

- [x] CHK033 Are contract/backend/frontend/test responsibilities assigned to existing owners, with reuse boundaries that avoid duplicate business schemas, new persistence or speculative health/command platforms? [Dependencies; [Plan §Source owners](../plan.md#source-owners); [Plan §Complexity Tracking](../plan.md#complexity-tracking); [Engineering §One Owner Per Topic](../../../docs/engineering/README.md#2-one-owner-per-topic)]
- [x] CHK034 Are both accepted P08 gates, affected-source revalidation and current protected configured-startup/inventory/admission evidence distinguished, with missing evidence keeping controls disabled and P11 restore/release approval separate? [Dependencies; [Spec §Roadmap Scope and Gates](../spec.md#roadmap-scope-and-gates-mandatory); [Plan §Constitution Check](../plan.md#constitution-check); [Plan §Remaining Implementation Gates](../plan.md#remaining-implementation-gates)]

## Ambiguities & Conflicts

- [x] CHK035 Is a validated definite noncommitting rejection distinguished from a lost/ambiguous acceptance response clearly enough to determine when its recovery handle/pending guard may retire and a fresh quote may be reviewed? [Ambiguity; Spec §FR-012, FR-014, FR-024; [Plan §Quote, lifecycle and history](../plan.md#quote-lifecycle-and-history); [Contract §Quote and acceptance observation](../contracts/withdrawals.md#quote-and-acceptance-observation)]
- [x] CHK036 Are the documented resolutions of older absent-login inventory and frozen-presentation wording explicit and consistent with current owner decisions, without adding P03 work or widening OD-001–OD-003? [Consistency; [Spec §Roadmap Scope and Gates](../spec.md#roadmap-scope-and-gates-mandatory); [Spec §Clarifications](../spec.md#clarifications); [Plan §Constitution Check](../plan.md#constitution-check)]

## Notes

- Every item requires later requirements/design evidence review; generation grants no approval and establishes no implementation readiness.
- CHK032 and CHK035 target wording that particularly needs evidence review: observation limits and definite rejection versus uncertain acceptance. This run does not resolve or edit those requirements.
- The existing [SPECIFY quality checklist](requirements.md) is preserved. Its notes record the earlier SPECIFY snapshot; use the current [clarifications](../spec.md#clarifications) for the accepted presentation decisions.
- CHECKLIST changes only this new focused checklist. Application tests, task generation and implementation are outside this command.

## IMPLEMENT preflight review — 2026-10-09

All 36 questions were reviewed individually against their linked evidence and the
current spec, plan, contract, quickstart, constitution and engineering guides.
The generation-time notes above are historical; this review supersedes their
unapproved status. Existing question text, IDs and evidence links are preserved.

| Items         | Supporting written evidence and review disposition                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHK001–CHK005 | Spec scope/OD-001–003 and FR-001/004–007/016/020–023; plan Backend Compatibility and Gate and Initial destination; contract admin/lifecycle sections define bounded owners, initial proof flow, all nine states and employee25/admin10 history.                                                                                                                                                                           |
| CHK006–CHK011 | FR-008–011/017/021–024; plan Quote, lifecycle and history and Admin scheduled actions; contract defines exact input normalization/precision, saved rate/fee floor, eligible sources, admitted capability, counted calendar and reviewed reason/version/fractional extension.                                                                                                                                              |
| CHK012–CHK015 | FR-002–003/007/013/016/018–019/022/025 and OD-001–003; contract authority/lifecycle sections preserve immutable terms, five active/four terminal states, identical-source release, no cooldown and current server authority.                                                                                                                                                                                              |
| CHK016–CHK020 | SC-001–009 and quickstart Test owners, Backend compatibility scenarios and Browser acceptance journeys distinguish exact financial/race outcomes, measurable viewport/focus criteria, real HTTP/DB effects, seeded display and full checkpoint evidence. These are future tests, not recorded passes.                                                                                                                     |
| CHK021–CHK026 | FR-012–015/021–026; plan scoped reads/quote/admin sections and contract outcome sections define original intent, exact key observation, concurrency, authority retirement, shortages/fence/pause and unresolved funds.                                                                                                                                                                                                    |
| CHK027–CHK031 | FR-004–007/012/015/017/021/024–026, edge cases and plan Initial destination/Scoped reads specify proof disposal, wrong-account/reopened links, configured network, weekend/skew/resume, stale review, safe errors and dirty drafts.                                                                                                                                                                                       |
| CHK032        | Plan Scoped reads and freshness and contract Lifecycle, paging, refresh and errors specify the reused P07 20-cycle policy, immediate first read, settlement-relative 5/10/20/30/60-second capped delays, coalescing, stop/pause/resume, explicit or deduplicated transition reset and uncertainty-preserving exhaustion.                                                                                                  |
| CHK033–CHK034 | Plan Source owners/Complexity Tracking/Backend Compatibility and Gate/Remaining Implementation Gates and quickstart define existing ownership, both accepted P08 groups, fresh configured startup/inventory/admission and deferred P11 restore/release. T001 reviews reused evidence; T013 must prove compatibility before frontend wiring.                                                                               |
| CHK035        | FR-012/014 and contract Quote and acceptance observation define only matching first-dispatch WITHDRAWAL_QUOTE_STALE/409, WITHDRAWAL_ACTIVE/409 and WITHDRAWAL_BLOCKED/403 (or proven no-send), with no earlier uncertainty and successful handle retirement. Lost/generic/obsolete replies and opaque reload retain original-quote observation. Real acceptance/expiry overlap proof is explicitly required at T012/T013. |
| CHK036        | Spec Roadmap Scope and Gates, Clarifications and OD-001–003, plan Constitution Check, existing P03 login route and recorded P03 acceptance resolve stale absent-login inventory and bound delegated presentation decisions without global policy changes.                                                                                                                                                                 |

No unsupported requirements-quality item remains. Current false readiness,
unexecuted compatibility/startup checks and P11 operational gates remain visible;
approval does not bypass T013 or authorize T002–T050 in this T001-only invocation.
