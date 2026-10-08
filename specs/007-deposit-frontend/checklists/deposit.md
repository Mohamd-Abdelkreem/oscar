# Deposit Requirements Quality Checklist: P07 - Deposit Frontend

**Purpose**: Assess whether P07's written requirements and design are complete, clear, consistent, measurable and traceable, with emphasis on financial uncertainty, current authority and preservation of the approved UI.

**Created**: 2026-10-07

**Feature**: [spec.md](../spec.md)

**Depth**: Standard, with focused financial/security coverage.

**Audience / timing**: Feature owner and reviewer before task generation/analysis; revisit affected items during the authorized implementation preflight.

**Review status**: Reviewed during the owner-authorized IMPLEMENT preflight on 2026-10-07; all 36 items are supported by the cited requirements/design evidence. This is requirements-quality assessment, not implementation verification, an executed test record or release approval.

## Reference Key

- **Spec**: [spec.md](../spec.md); FR IDs refer to Functional Requirements, SC IDs to Measurable Outcomes, and C1–C3 to Owner Decisions.
- **Plan**: [plan.md](../plan.md); G1–G5 refer to the named Delivery Gates.
- **Data**: [data-model.md](../data-model.md).
- **HTTP**: [contracts/http.md](../contracts/http.md).
- **UI**: [contracts/ui-integration.md](../contracts/ui-integration.md).
- **Research**: [research.md](../research.md).
- **Quickstart**: [quickstart.md](../quickstart.md).
- **Roadmap**: [PLAN.md](../../../PLAN.md); P07 and Sections 3.6, 5.2, 5.6 and 9.
- **Constitution**: [constitution.md](../../../.specify/memory/constitution.md).
- **Engineering**: [guide index](../../../docs/engineering/README.md), especially frontend, contracts, security and testing.

References identify written evidence for review; their presence does not approve an item. A Gap marker requests assessment of a potentially underspecified requirement, not an implementation task.

## Requirement Completeness

- [x] CHK001 Are P07 deliverables/exclusions explicitly bounded to the existing deposit surfaces and C3's minimal prerequisite, without absorbing P10 directory/detail/audit work or changing custody/financial policy? [Completeness, Spec §Roadmap Scope and Gates; FR-026; Plan §Summary]
- [x] CHK002 Are reused predecessor acceptance and the new target-choice backend gate clearly distinguished, with documented acceptance required before dependent frontend integration? [Dependencies, Spec §Roadmap Scope and Gates; FR-017/030; Plan §G1; Research §R1]
- [x] CHK003 Is C1's permitted correction set explicit and consistent with automatic verified credit, variable latency, no commercial deposit limits/hold/approval/rejection, and preservation of unrelated frozen copy? [Consistency, Spec §C1; FR-005/026/027; UI §Employee Route/§Admin Route and Choices]
- [x] CHK004 Does C2 map every required readiness/error/manual-history/clipboard/complete-intent/uncertainty presentation to approved existing surfaces, with additional pages/popups/redesign excluded? [Completeness, Spec §C2; FR-019/028; UI §Employee Route/§Admin Route and Choices/§Manual Action Protocol]
- [x] CHK005 Are target-choice requirements explicit about minimal ID/name/email, every permitted USER with a persisted wallet including first-credit accounts, and absence of new history/subscription/status restrictions? [Completeness, Spec §C3; FR-017/026; HTTP §Proposed C3 Endpoint]

## Requirement Clarity

- [x] CHK006 Are assigned-address ownership, configured token/network and visible/QR/copied equality unambiguous, with usable receiving instructions restricted to the validated READY state? [Clarity, Spec FR-001/002/003; SC-001; Data §Existing Receiving Instructions]
- [x] CHK007 Are all receiving/detection states defined separately from persisted credit, so freshness, activation, provider delay or uncertainty cannot imply financial finality or a credit deadline? [Clarity, Spec FR-003/004/006/008; Data §Existing Receiving Instructions; UI §Employee Route]
- [x] CHK008 Are exact accepted units, six-digit precision, positive representable grant bounds and invalid amount cases defined consistently without rounding away units or inventing commercial deposit limits? [Clarity, Spec FR-005/009/018; §Edge Cases; SC-005/006; Data §Existing Manual Grant and Outcome]
- [x] CHK009 Are server chronology, Baghdad presentation and every-day confirmed-credit availability distinguished from browser time and withdrawal-style weekday/hold rules? [Clarity, Spec FR-005/011; SC-003; Data §Existing Persisted History; Roadmap §3.6]
- [x] CHK010 Are refresh delays, observation cap including failures, nonoverlap, relevant-page limits, pause/stop conditions and permitted resets quantified sufficiently to make bounded observation objectively assessable? [Measurability, Spec FR-007; UI §Private Reads and Refresh; Research §R3]

## Requirement Consistency

- [x] CHK011 Are canonical event, transaction and combined-history row identities distinguished consistently, including separate eligible logs within one transaction and chain/manual rows with colliding record IDs? [Consistency, Spec FR-008/010; US2 §Acceptance Scenarios 3/5; Data §Existing Persisted History; UI §Private Reads and Refresh]
- [x] CHK012 Are chain/manual labels and permitted fields consistent across employee/admin requirements, with no fabricated manual chain fields or employee exposure of administrator-only attribution? [Consistency, Spec FR-010/016/023; SC-006; Data §Existing Persisted History; UI §Employee Route/§Admin Route and Choices]
- [x] CHK013 Are authoritative ledger/audit ownership, NON_REFERRAL manual-credit provenance and preservation of existing source/reservation allocations explicit, without local balance/audit authority or rewritten chain receipts? [Consistency, Spec FR-013/016/023/024; US3 §Acceptance Scenario 7; Constitution §V]
- [x] CHK014 Are same-action replay, changed actor/payload conflict and distinct deliberate grants sharing reference text defined consistently, so external reference is never mistaken for global action identity? [Consistency, Spec FR-020/022/027; US3 §Acceptance Scenarios 3/5; HTTP §Existing P06 Endpoints]

## Scenario and Edge Case Coverage

- [x] CHK015 Are initial/filtered empty, loading, transient refresh failure, malformed response and denial requirements distinct, including the conditions for retaining known same-scope history and suppressing obsolete data? [Coverage, Spec FR-007/012/014; SC-004; UI §Private Reads and Refresh]
- [x] CHK016 Are history/search/filter/page bounds, filtered totals, deterministic order, selection changes and a usable recovery from out-of-range pages specified clearly enough for requirements review? [Coverage, Gap, Spec FR-012; §Edge Cases; Data §Existing Persisted History; UI §Private Reads and Refresh]
- [x] CHK017 Are target search/navigation, duplicate-name identification, selected-identity continuity and truthful empty/failure/denial states specified without unbounded accumulation, fixture fallback or stale-scope selection? [Coverage, Spec FR-017; US3 §Acceptance Scenario 8; Plan §G4; UI §Admin Route and Choices]
- [x] CHK018 Do receiving-instruction requirements cover concurrent/repeated assignment requests and lost provisioning replies while preserving the recoverable assignment and excluding guessed/unready addresses? [Coverage, Spec FR-003/014; §Edge Cases; Plan §G3; UI §Employee Route]
- [x] CHK019 Are complete reviewed intent, explicit confirmation, pending protection and dirty-input preservation defined for invalid input, changed selection, dismissal and transient failure? [Coverage, Spec FR-018/019/024; §C2; UI §Admin Route and Choices/§Manual Action Protocol]

## Authority and Privacy Requirements

- [x] CHK020 Are current employee ownership and ADMIN role/session/status requirements defined for every private deposit/choice/grant operation, including server revalidation at grant authority and exclusion of invented deposit restrictions? [Completeness, Spec FR-001/017/018; HTTP §Existing P06 Endpoints/§Proposed C3 Endpoint; Constitution §VI]
- [x] CHK021 Are session retirement, confirmed denial and late read/grant outcomes covered explicitly so obsolete work cannot restore access, overwrite newer selection or expose another actor's data? [Coverage, Spec FR-001/014/024; UI §Private Reads and Refresh/§Manual Action Protocol]
- [x] CHK022 Are malformed output, unavailable metadata/database/provider and validation/conflict/fence failures assigned safe, truthful feedback without secret/raw-diagnostic exposure or fabricated empty/success defaults? [Completeness, Spec FR-014/016/017/028; HTTP §Failure and uncertainty/§Proposed C3 Endpoint]
- [x] CHK023 Are retained recovery information and retirement rules limited explicitly to minimal original-action identity, with full financial payload/secrets excluded from persistent browser state and another actor's access? [Privacy, Spec FR-014/016/020/021; Data §Proposed Client Scope and State; UI §Manual Action Protocol]

## Recovery and Concurrency Requirements

- [x] CHK024 Are duplicate/concurrent confirmation and competing-tab requirements explicit about retaining one original action, safe coordination failure and server-owned duplicate protection rather than browser-only money integrity? [Coverage, Spec FR-019/020/022; Data §Proposed Client Scope and State; UI §Manual Action Protocol; Constitution §V]
- [x] CHK025 Are lost-reply/remount/reload recovery requirements tied to original-action observation while acknowledging discarded full payload and forbidding reconstructed submission or automatic financial replay? [Clarity, Spec FR-020/021; US3 §Acceptance Scenario 4; HTTP §Existing P06 Endpoints; UI §Manual Action Protocol]
- [x] CHK026 Is indefinitely absent original-action observation documented as unresolved, with no inferred noncommit, cancellation, forced clearing, replacement identity or compensating grant? [Clarity, Spec FR-020/021/022; HTTP §Failure and uncertainty; Plan §Remaining Gates and Risks]
- [x] CHK027 Do requirements distinguish proven pre-dispatch rejection from an unknowable dispatch boundary, including unavailable coordination/storage and a crash between retained intent and submission? [Recovery coverage, Spec FR-019/020/021/024; Data §Proposed Client Scope and State; UI §Manual Action Protocol]
- [x] CHK028 Are settlement/recovery criteria tied to matching original action/employee/stable actor identity, with mutable profile labels and historical balance snapshots distinguished from current authoritative funds? [Consistency, Spec FR-013/014/020/023/024; HTTP §Existing P06 Endpoints; Data §Existing Manual Grant and Outcome/§Proposed Client Scope and State]

## Non-Functional Requirements and Dependencies

- [x] CHK029 Are clipboard success/failure requirements explicit about actual completion, truthful feedback and an inspectable full address after refusal, within C2's permitted surfaces? [Clarity, Spec FR-015/028; SC-001/007; UI §Employee Route/§Admin Route and Choices]
- [x] CHK030 Are phone/desktop usability requirements measurable for the stated narrow/representative viewports, Cairo/Arabic/RTL, LTR address/amount isolation, labels/focus/confirmation and bottom-navigation clearance without overflow or clipped actions? [Measurability, Spec FR-009/019/029; SC-007; Plan §G5]
- [x] CHK031 Are optional explorer requirements explicit about validated configuration and genuine public chain records, with omission when configuration is absent and no manual-credit chain destination? [Clarity, Spec FR-025; §Assumptions; UI §Required Preservation and Acceptance]
- [x] CHK032 Are isolated validation-harness admission/metadata assumptions and affected earlier-phase compatibility obligations documented without weakening production fences or treating synthetic READY setup as custody/recovery acceptance? [Dependencies, Plan §G1; Research §R6; Quickstart §Prerequisites; Constitution §IV/V/VII]
- [x] CHK033 Are accepted single-admin/no-2FA/no-dual-approval and compromised-admin/host residual risks retained explicitly, with release review remaining outside P07 rather than a new policy or security guarantee? [Assumption, Spec §Actors and Current Capability; Plan §Remaining Gates and Risks; Constitution §VI]

## Acceptance Criteria Quality and Evidence Boundaries

- [x] CHK034 Are independent QR-decoding acceptance and visible/copied/decoded equality defined for two accounts and reload, with actual-device evidence required and generator-input assertions explicitly insufficient? [Measurability, Spec FR-002/015; SC-001/007; Research §R7; Plan §G5; Quickstart §Acceptance Scenarios]
- [x] CHK035 Are primary/error/recovery/precision/replay scenarios traceable to US1–US3 and SC-001–008, with appropriate persisted-finance/component/adapter/browser evidence obligations rather than mock or screenshot substitutes? [Traceability, Spec §User Scenarios & Testing; FR-030; SC-001–008; Plan §Verification Strategy; Constitution §VII]
- [x] CHK036 Does the written completion contract cover the full P07 checkpoint, separate browser/type/device obligations and missing-service gates while distinguishing requirements approval, historical notes, fresh/reused evidence and unperformed acceptance? [Completeness, Spec FR-029/030; SC-008; §Clarifications; Plan §G5/§Constitution Check; Quickstart §Full P07 Regression Checkpoint]

## Generation Notes (Historical)

- New items remain unchecked. Record supporting requirement/design evidence or a concrete gap beside each item during a separately authorized review. A checked requirement-quality item does not establish implemented behavior, passing tests or deployment readiness.
- The generic [requirements.md](requirements.md) is preserved unchanged. Its initial SPECIFY status/notes are historical; current C1–C3 decisions and that distinction are recorded in the clarified spec. This checklist adds focused questions without rewriting prior approvals or inferring acceptance from them.
- CHECKLIST only: no spec/plan/constitution/roadmap/pointer changes, task generation, application tests, service startup or implementation are authorized by this artifact.

## IMPLEMENT Preflight Evidence Review (2026-10-07)

All CHK001-CHK036 were assessed individually against their existing item references and the current spec, plan, HTTP/UI contracts, data model, research and quickstart. C1-C3 resolve scope/presentation/target ownership; G1-G5 define ordered implementation acceptance. The quantified observation budget, original-action uncertainty/404 rules, minimal recovery handle, exact money/privacy and device/full-checkpoint obligations support the corresponding quality items. P06 recorded acceptance is reused, not freshly executed. No requirements gap or available analysis blocker was found. These approvals assess written requirements only; T001-T047 and all new acceptance remain unexecuted at preflight.

Checklist questions/IDs are preserved. Markers are read-only after this preflight. docs-guard verified evidence links and distinguished proposed APIs/tests from implemented capability.
