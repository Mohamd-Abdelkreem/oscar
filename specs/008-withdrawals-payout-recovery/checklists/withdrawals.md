# Withdrawal Requirements-Quality Checklist: P08

**Purpose**: Assess whether P08 reservation/scheduling and payout/recovery requirements are complete, clear, consistent, measurable and traceable before task generation and later implementation review.

**Created**: 2026-10-08

**Feature**: [P08 specification](../spec.md)

**Depth / audience**: Standard, focused on financial and custody risks; requirements reviewer before tasks and implementation.

**Review status**: Authorized IMPLEMENT preflight review complete on 2026-10-08. All 38 requirements-quality items are supported by the evidence cited below and on each item. These approvals establish requirements/design quality only; no implementation, acceptance test or release readiness is established.

**Evidence key**: Spec = [spec.md](../spec.md), including FR/SC identifiers and clarifications C1/C2; Plan = [plan.md](../plan.md); Model = [data-model.md](../data-model.md); HTTP = [withdrawal contract](../contracts/withdrawals.md); Runtime = [protected payout contract](../contracts/payout-runtime.md). Cross-cutting authority: [constitution](../../../.specify/memory/constitution.md), [roadmap](../../../PLAN.md) and [engineering guides](../../../docs/engineering/README.md). References below identify requirements/design evidence, not proof of implementation.

## Scope, Dependencies and Consistency

- [x] CHK001 Are the two backend groups defined within one P08 feature, with reservation/scheduling acceptance explicitly preceding payout/recovery work and both gates preceding P09? [Completeness, Spec §FR-001; Plan §Ordered Delivery and Acceptance]
- [x] CHK002 Are predecessor requirements and reused P06/P07 evidence distinguished from fresh P08 acceptance, while preserving the owner's removal of separate CONVERGE as a prerequisite? [Dependency, Spec §Roadmap Scope and Gates; Plan §Prerequisites and reused evidence]
- [x] CHK003 Is the approved single settlement-label exception bounded consistently across the artifacts, while all other frozen presentation and P09/P10/P11 exclusions remain explicit? [Consistency, Spec §Roadmap Scope and Gates; Plan §Approved compatibility decision]
- [x] CHK004 Are responsibility, reuse and dependency requirements defined proportionately, distinguishing existing foundations from proposed P08 work without requiring speculative infrastructure or recreating completed phases? [Clarity, Spec §Assumptions; Plan §Source ownership and target paths]

## Authority, Privacy and Observable Facts

- [x] CHK005 Are current identity, session, role, account status and ownership requirements explicit at acceptance and protected claim, including the different effects of a ban, withdrawal block and task-only block? [Completeness, Spec §FR-003/013/023]
- [x] CHK006 Are privileged-action requirements consistent about current administrator authority, confirmation, nonblank reason, stale versions and server-derived audit identity/time, without adding payout approval, 2FA or dual approval? [Consistency, Spec §FR-003/024–026; Plan §Technical Context]
- [x] CHK007 Are bounded owner/admin read requirements clear about permitted facts, existence privacy, safe errors and secret exclusions, including continued authorized history access under a withdrawal-only block? [Privacy Coverage, Spec §FR-003–004; HTTP §Owners and transport / Observable errors and compatibility gate]

## First-Destination Proof Completeness — C2

- [x] CHK008 Are accepted issuance/resend and rejected issuance distinguished, with sole-current employee/action/address-bound proof authority superseding older proofs before delivery and no confirmation from a read-only link? [Completeness, Spec §FR-005; Clarifications C2]
- [x] CHK009 Are latest-proof consumption, expiry, replay, mismatch and competing issuance/consumption requirements explicit about one committed winner, clearing pending authority and prohibiting subsequent employee replacement? [Coverage, Spec §FR-006; SC-001; Clarifications C2]
- [x] CHK010 Are failed or late delivery and lost confirmation-response requirements defined without reviving older proofs, confusing delivery acknowledgement with a saved destination, leaking credentials or creating a reservation? [Exception Coverage, Spec §FR-007; SC-001; Model §WithdrawalDestination]

## Quote, Money and Source Clarity

- [x] CHK011 Are quote preview, partial funding, acceptance-time revalidation and material staleness defined consistently, including the distinction between an initial ten-minute lifetime and permitted configured validity? [Clarity, Spec §FR-009/013; Model §WithdrawalQuote; HTTP §Quotes, acceptance and history facts; Runtime §Treasury key and independent execution policy]
- [x] CHK012 Are fee-selection requirements unambiguous for active subscription snapshots versus Free/expired policy, including positive net and the effect of future configuration changes on new versus accepted requests? [Clarity, Spec §FR-010–011/019; Model §WithdrawalPolicy / WithdrawalQuote]
- [x] CHK013 Are inclusive 16–500 gross bounds, exact micro-USDT, canonical external amounts and floor-based basis-point rounding specified with measurable boundary and gross/fee/net examples? [Measurability, Spec §FR-002/011–012; SC-002]
- [x] CHK014 Are company-paid network/resource costs explicitly separate from the accepted employee fee and net, including costs incurred by a failed attempt? [Consistency, Spec §FR-012/034/036; SC-002/007]
- [x] CHK015 Are paid, Free and exclusive-expiry eligibility requirements explicit about unreserved funds, retained referral ownership, referral withdrawal restrictions, purchase eligibility and the exclusion of pending task submissions? [Completeness, Spec §FR-017–018; SC-003]
- [x] CHK016 Are withdrawal non-referral-first allocation and purchase referral-first spending distinguished, with an exact original allocation retained for release/settlement and reserved funds excluded from competing spending? [Consistency, Spec §FR-014/018/027/034; SC-003–004/007]
- [x] CHK017 Is the acceptance transaction's required all-or-none outcome defined for request, gross reservation, source projections, immutable terms, deadline and audit, while reservation preserves total ownership? [Completeness, Spec §FR-014; SC-004]
- [x] CHK018 Are accepted fee, gross/net, source allocation, recipient/version, eligibility and original scheduling terms explicitly immutable through later expiry, upgrade/reactivation and configuration changes? [Consistency, Spec §FR-019; SC-003/006; Model §WithdrawalRequest]

## Active States, Identity and Replay

- [x] CHK019 Is “active withdrawal” defined across every potentially live state, including SIGNED and UNKNOWN, with proof-backed terminal criteria for permitting a subsequent request? [Clarity, Spec §FR-016/028/035–036; SC-004/007–008; Model §State transitions and atomic guards]
- [x] CHK020 Are actor/operation/key/payload idempotency, same-key conflicts, permanent business uniqueness and lost-reply outcomes defined separately, so changed or absent client keys cannot repeat acceptance or administrative effects? [Completeness, Spec §FR-015; SC-004; Model §WithdrawalQuote / WithdrawalAction]

## Calendar and Schedule Boundaries

- [x] CHK021 Are 72 counted hours defined as all Monday–Friday hours in Asia/Baghdad, independent of host/browser time, with Friday-to-Wednesday and weekend-start examples? [Clarity, Spec §FR-020; SC-005]
- [x] CHK022 Are counted deadline, normalized earliest dispatch and remaining-time facts distinguished, including Saturday-00:00 normalization and the precision/zero boundaries of exact versus displayed countdowns? [Boundary Coverage, Spec §FR-004/021; SC-005; HTTP §Quotes, acceptance and history facts]
- [x] CHK023 Are extension requirements precise about positive counted duration added to the existing deadline, supported representation bounds, unchanged original basis, schedule revisions and denial after a potentially live claim? [Clarity, Spec §FR-024; SC-005–006; HTTP §Administrator scheduled actions]

## Safe Cancellation and Competing Outcomes

- [x] CHK024 Are safely unsent rejection/release requirements explicit about identical-source release exactly once, retained referral classification and the exclusion of hold, manual completion, payout approval and a 24-hour cooldown? [Completeness, Spec §FR-025/027; SC-003/006]
- [x] CHK025 Are ban/block/future destination-replacement versus claim requirements clear about mutually exclusive safe cancellation or original-attempt reconciliation, no redirection/payment-plus-refund, and no cancellation solely from subscription expiry? [Concurrency Coverage, Spec §FR-008/023/026–028; SC-006]

## Durable Work and Protected Claim Authority

- [x] CHK026 Do requirements identify authoritative durable state/deadlines/versions and distinguish replaceable wakeups from financial authority, covering missing, stale, duplicate and restarted work? [Recovery Coverage, Spec §FR-022–023; SC-008]
- [x] CHK027 Are automatic treasury payout and signing requirements limited to the accepted owner/request/network/token/source/recipient/version/net, with independent limits and no arbitrary signing or secret export? [Completeness, Spec §FR-029–030; Runtime §Ownership and authority]
- [x] CHK028 Are protected claim, worker discovery and shared-treasury concurrency requirements distinguished, so hints, leases, stale liquidity or UNKNOWN cannot grant a fresh payment or oversubscribe the same source? [Consistency, Spec §FR-023/030/035/037; Plan §Queue-to-signer handoff; Runtime §Treasury key and independent execution policy]

## Attempt Evidence, Settlement and Safe Failure — C1

- [x] CHK029 Are recoverable original attempt/transaction identity, signed material and broadcast-intent requirements explicit before any possible send, including lost replies and unavailable original preparation bytes without a new transaction identity? [Recovery Coverage, Spec §FR-031–032; SC-008; Runtime §Durable ordering and replay]
- [x] CHK030 Is successful canonical-final evidence defined independently of acknowledgement or a public transaction-ID claim, with original network/token/source/recipient/exact net and malformed/nonfinal/conflicting evidence addressed? [Clarity, Spec §FR-033; SC-007]
- [x] CHK031 Are successful settlement requirements explicit about consuming the original reserved gross once, accepted net plus fee equalling gross, preserved sources and atomic final state/audit under repeated observations or dependent failure? [Completeness, Spec §FR-034; SC-007; Model §ReservationAllocation and financial history]
- [x] CHK032 Are incomplete evidence, timeout, provider absence, expiration and lost claims consistently classified as active reserved uncertainty rather than safe failure, refund or permission for replacement? [Consistency, Spec §FR-032/035; SC-008; Clarifications C1]
- [x] CHK033 Are conclusive-failure requirements clear about admissible proof/no live conflict, automatic original-source release once, zero fee, no replacement and a fresh request with current terms/new 72-hour schedule without cooldown? [Clarity, Spec §FR-036; SC-007; Clarifications C1; Runtime §Canonical observation and financial completion]

## Operational Failure and Independent Recovery

- [x] CHK034 Are liquidity/resource shortage, provider outage, missing protected authority and dispatch-pause requirements explicit about retained reservations, discoverable work, bounded operator alerts and no automatic funding or false completion/failure? [Exception Coverage, Spec §FR-037/041; SC-009]
- [x] CHK035 Are weekend/pause observation requirements distinguished from new dispatch and restore-fenced financial mutation, so an already sent attempt remains reconcilable without bypassing admission? [Consistency, Spec §FR-021/038; Runtime §Durable ordering and replay / Recovery inventory and operator outcomes]
- [x] CHK036 Are restart/restore requirements complete for post-snapshot off-chain authority, original deadlines/actions/reservations/terms, payout custody/attempt/history inventory and independent admission, with missing/conflicting history retaining the fence rather than guessed reconstruction? [Recovery Completeness, Spec §FR-039–040; SC-008; Runtime §Recovery inventory and operator outcomes]

## Acceptance Criteria and Execution Assumptions

- [x] CHK037 Are acceptance criteria objective and traceable to the required normal, boundary, replay, concurrency, dependent-failure and recovery scenarios, with evidence boundaries appropriate to financial, queue and protected-custody claims? [Measurability, Spec §FR-042; SC-001–009; Plan §Test Strategy]
- [x] CHK038 Are controlled payout testnet prerequisites, explicit opt-in/test-only configuration, public outcome evidence and missing-service consequences defined without treating reused results, planned checks or requirements approval as fresh payout acceptance? [Dependency, Spec §FR-042; SC-009; Plan §Prerequisites and reused evidence; Quickstart §Opt-In Payout Testnet Gate]

## Notes

- Generation left all 38 items unchecked. The owner-authorized IMPLEMENT preflight subsequently reviewed each item against the current specification, plan, model, contracts, roadmap and engineering guides; all are supported. The built-in `requirements.md` and its 16 existing approvals are preserved.
- Scope/depth/audience were derived from the selected CHECKLIST prompt and the settled P08 artifacts; no additional preference question was necessary. Both backend groups, C1/C2, exact sources, uncertainty, recovery and the owner-approved single-label boundary are included.
- Reviewers should resolve any ambiguity in the owning requirements/design artifact within its separately authorized workflow; this command changes neither spec nor plan. In particular, CHK011 asks reviewers to distinguish initial quote validity from configurable validity across the artifact wording.
- A checked item would record requirements-quality evidence only. Actual backend acceptance, infrastructure availability, controlled testnet outcomes and release approval remain separate gates. CHECKLIST generates no tasks, code or test execution.

## IMPLEMENT preflight evidence — 2026-10-08

- CHK001–004: Spec Roadmap Scope and Gates, Plan Ordered Delivery and Acceptance / Approved compatibility decision / Source ownership and target paths, and Tasks T034/T068/T070 preserve one feature, both ordered gates, predecessor reuse and the exact label exception. P06 tasks have 79 completed items; P07 tasks have 50, with latest T050 acceptance recorded in its quickstart. These results are reused evidence. P03 plan Input records the owner removal of separate CONVERGE as a prerequisite.
- CHK005–010: Spec FR-003–008 and SC-001, HTTP Owners and transport / Employee commands and reads, Model WithdrawalDestination / WithdrawalDestinationAudit and Research R3 require current authority, bounded private reads, sole-current proof, atomic matching audits, one first save, generation-bound delivery and safe lost-reply observation.
- CHK011–020: Spec FR-009–019 and SC-002–004, HTTP Quotes, acceptance and history facts, Model WithdrawalPolicy / WithdrawalQuote / WithdrawalRequest / WithdrawalAction / ReservationAllocation and financial history define configured quote validity (initially 600 seconds), persisted immutable expiry, exact fee/source conservation, all-or-none acceptance, immutable snapshots, all five active states and permanent quote identity distinct from optional client keys.
- CHK021–026: Spec FR-020–028 and SC-005–006/008, HTTP countdown and Administrator scheduled actions, Model Lock order and external I/O, and Runtime Queue discovery handoff distinguish counted due time, normalized dispatch, exact milliseconds and truncated display hours; positive existing-deadline extension, original-source release, claim races and replaceable wakeups are explicit. Tasks T018/T022/T032–034 supply concrete verification ownership.
- CHK027–036: Spec FR-029–041, C1 and SC-007–009, Runtime Ownership and authority / Treasury key and independent execution policy / Durable ordering and replay / Canonical observation and financial completion / Recovery inventory and operator outcomes, and Model WithdrawalAttempt and source lane specify fixed intent, independent caps, one unresolved lane, original archived identity before send, canonical completion, conservative UNKNOWN, proved failure release, bounded alerts and independently admitted post-snapshot recovery.
- CHK037–038: Spec FR-042/SC-001–009, Plan Test Strategy, Tasks requirement coverage / T034/T063/T066–070 and Quickstart ordered gates / Opt-In Payout Testnet Gate identify real PostgreSQL, Redis, protected Linux/archive and separate controlled payout testnet evidence. Planned checks, reused P06 results and these approvals do not satisfy P08 acceptance.
- Scope is Phase 1: Selected-phase prerequisites, which contains no task IDs. No application, UI, test, specification, plan, task marker or feature-pointer edit is authorized by this review. No saved P08 ANALYZE report was found; no analysis result is claimed, and any separately issued unresolved analysis finding must be resolved before a code batch. Both execution gates and all 70 implementation tasks remain pending.
