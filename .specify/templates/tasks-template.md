---
description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Roadmap Phase**: [Pnn - exact title from PLAN.md]

**Feature Directory**: [exact selected feature path; verify .specify/feature.json and spec.md]

**Input**: Design documents from the verified feature directory

**Prerequisites**: Populated constitution, approved spec.md/plan.md, required reviewed
requirements and predecessor gates; applicable research.md, data-model.md, contracts/

**Implementation Scope**: [Owner binds exact task IDs or a selected dependency-safe
batch at IMPLEMENT time; task generation does not authorize execution]

**Tests**: REQUIRED for OSCAR. Every implementation phase MUST create or extend
actual automated test files. Include concrete paths, observable behavior, relevant
failure/concurrency/time/retry cases, required services, and manifest-backed commands.
Tests are selected by phase risk, without arbitrary coverage or one-test-per-method rules.

**Organization**: Group tasks by story within this selected roadmap phase and declared
dependencies. Internal "Phase N" headings below are task groups, not OSCAR phases.

Read the constitution, PLAN.md, applicable repository instructions, and all eight
engineering guides before generating tasks. Revisit owning guides/source per batch
and use them in review. Preserve existing apps/packages, validated shared contracts,
approved UI, and unrelated changes. Backend groups MUST be complete and tested before
frontend integration; missing UI/frozen-presentation decisions remain gates. Include
applicable production/security/test/docs review and UI preservation checks in meaningful
tasks. Missing required infrastructure or unexecuted checks leave completion incomplete.
Generate only this phase; do not add toolkit setup or repeat completed foundations.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: Owning modules/adapters under `apps/api/src/`
- **Frontend**: Existing features/hooks/API adapters under `apps/web/src/`
- **Shared contracts**: `packages/contracts/src/`
- **Persistence**: Schema, forward migrations, and tests in `packages/database/`
- Use actual discovery/ownership from `docs/engineering/testing.md` and plan.md.
  Paths below are illustrative placeholders; replace them with phase-specific paths.

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST preserve each story's explicit prerequisites and backend-first order.
  Identify contracts/schema, domain/authorization, provider/worker, test, and approved
  integration work only when required by this phase. Independent testability does
  not authorize deploying a story or bypassing group acceptance gates.

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Selected-Phase Prerequisites

**Purpose**: Verify scope, existing owners, and predecessor gates; no toolkit/project
reinitialization. Replace all examples with only this phase's necessary work.

- [ ] T001 Verify selected phase/feature, predecessor evidence, and affected owners in plan.md
- [ ] T002 Verify required scripts/dependencies and infrastructure in owning package.json files
- [ ] T003 Identify focused/shared/checkpoint verification from docs/engineering/testing.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Only in-phase shared work required before dependent stories

**⚠️ CRITICAL**: Dependent story work waits for these tasks; completed infrastructure
is reused. Frontend work also waits for its entire required backend group gate.

For a frontend phase, verify backend predecessor evidence and remove backend sample
tasks outside this phase's ownership. A missing predecessor gate does not authorize
implementing another roadmap phase within this task list.

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Extend required schema/forward migrations in packages/database/prisma/
- [ ] T005 Extend phase-required shared contracts in packages/contracts/src/[domain]/
- [ ] T006 Extend phase-required authorization/routes in apps/api/src/modules/[domain]/
- [ ] T007 Implement required domain transitions in apps/api/src/modules/[domain]/
- [ ] T008 Reuse safe error/audit handling for affected operations in apps/api/src/modules/[domain]/
- [ ] T009 Extend only required validated configuration in apps/api/src/core/config/

**Checkpoint**: In-phase prerequisites verified; independent story work may begin
only within selected task scope and satisfied dependencies.

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (required applicable coverage)

> Create or extend meaningful tests in this phase. Reproduce failures for bug fixes;
> verify acceptance/failure behavior and final persisted outcomes where required.

- [ ] T010 [P] [US1] Contract tests for [boundary] in packages/contracts/src/[domain]/[name].test.ts
- [ ] T011 [P] [US1] Integration tests for [journey/failure] in apps/api/src/modules/[domain]/[name].integration.test.ts

### Implementation for User Story 1

- [ ] T012 [US1] Extend [domain] wire schemas in packages/contracts/src/[domain]/[domain].schema.ts
- [ ] T013 [US1] Extend [domain] schema/constraints in packages/database/prisma/schema.prisma and a forward migration
- [ ] T014 [US1] Implement [operation] in apps/api/src/modules/[domain]/[domain].service.ts (depends on T012, T013)
- [ ] T015 [US1] Implement [authorized boundary] in apps/api/src/modules/[domain]/[domain].routes.ts
- [ ] T016 [US1] Add validation and error handling
- [ ] T017 [US1] Add logging for user story 1 operations

**Checkpoint**: User Story 1 meets its acceptance checks within declared prerequisites;
record actual commands/results and any incomplete gate.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (required applicable coverage)

- [ ] T018 [P] [US2] Contract tests for [boundary] in packages/contracts/src/[domain]/[name].test.ts
- [ ] T019 [P] [US2] Integration tests for [journey/failure] in apps/api/src/modules/[domain]/[name].integration.test.ts

### Implementation for User Story 2

- [ ] T020 [US2] Extend [domain] persistence in packages/database/prisma/schema.prisma and a forward migration
- [ ] T021 [US2] Implement [operation] in apps/api/src/modules/[domain]/[domain].service.ts
- [ ] T022 [US2] Implement [authorized boundary] in apps/api/src/modules/[domain]/[domain].routes.ts
- [ ] T023 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: User Stories 1 and 2 meet their applicable acceptance checks within
declared prerequisites; unresolved required checks remain incomplete.

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (required applicable coverage)

- [ ] T024 [P] [US3] Contract tests for [boundary] in packages/contracts/src/[domain]/[name].test.ts
- [ ] T025 [P] [US3] Integration tests for [journey/failure] in apps/api/src/modules/[domain]/[name].integration.test.ts

### Implementation for User Story 3

- [ ] T026 [US3] Extend [domain] persistence in packages/database/prisma/schema.prisma and a forward migration
- [ ] T027 [US3] Implement [operation] in apps/api/src/modules/[domain]/[domain].service.ts
- [ ] T028 [US3] Implement [authorized boundary] in apps/api/src/modules/[domain]/[domain].routes.ts

**Checkpoint**: Selected stories meet their acceptance checks; whole-phase completion
also requires all remaining phase tasks and applicable checkpoint verification.

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Required in-scope verification and corrections across affected stories;
do not add broad refactors or speculative optimization work.

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Correct any demonstrated in-scope performance issue with relevant evidence
- [ ] TXXX Extend relevant acceptance/failure regressions in actual owning test files
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Prerequisites (Phase 1)**: Verify selected roadmap scope and predecessor gates first
- **Foundational (Phase 2)**: Depends on prerequisite verification; blocks its dependent tasks
- **User Stories (Phase 3+)**: Follow their explicit foundational and story dependencies
  - Parallel work requires independent file ownership and satisfied dependencies
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Only necessary in-scope verification/cleanup after its dependencies

### User Story Dependencies

- **User Story 1 (P1)**: [Exact prerequisite task IDs and acceptance boundary]
- **User Story 2 (P2)**: [Exact prerequisite task IDs, including US1 dependencies if needed]
- **User Story 3 (P3)**: [Exact prerequisite task IDs, including US1/US2 dependencies if needed]

### Within Each User Story

- Actual automated test work is required; acceptance checks MUST pass before completion
- Models before services
- Services before endpoints
- Complete and tested backend group before dependent frontend integration
- Story complete before moving to next priority

### Parallel Opportunities

- Prerequisite/foundational tasks marked [P] require distinct owners and satisfied dependencies
- Stories can run in parallel only with independent file owners and satisfied dependencies
- All tests for a user story marked [P] can run in parallel
- Tasks touching the same schema/service/shared owner MUST NOT run in parallel
- All parallel work remains within the explicitly selected phase/task scope

---

## Parallel Example: User Story 1

```text
# Illustrative test-authoring work with independent files and satisfied dependencies:
Task: "Contract tests in packages/contracts/src/[domain]/[name].test.ts"
Task: "Integration tests in apps/api/src/modules/[domain]/[name].integration.test.ts"

# Schema changes sharing packages/database/prisma/schema.prisma are sequential.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Verify Phase 1: Selected-Phase Prerequisites
2. Complete the selected story's required Phase 2 foundational tasks
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Report the selected scope; deployment requires an explicit owner instruction

### Incremental Delivery

1. Verify Prerequisites + complete necessary Foundational work
2. Add selected User Story 1 tasks → Test within prerequisites → Report batch status
3. Add selected User Story 2 tasks → Test within prerequisites → Report batch status
4. Add selected User Story 3 tasks → Test within prerequisites → Report batch status
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team verifies Prerequisites + completes necessary Foundational work
2. When dependencies/file ownership permit within selected scope:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Integrate only after relevant dependencies and backend group verification pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each story is testable within declared prerequisites; do not assume all can run independently
- Preserve completed tasks/IDs and accepted unrelated decisions on revisions
- Record actual tests/checks, fresh versus cached evidence, and missing infrastructure
- Run focused/shared regressions per batch and full checks at roadmap checkpoints/release
- Do not mark unavailable required checks or a partial phase complete
- Do not commit, push, deploy, or spend real funds without an owner instruction
- Stop after the selected command/scope; do not execute another stage or roadmap phase
- Stop at any checkpoint to validate story independently
- Avoid vague tasks, conflicting parallel edits, and hidden cross-story dependencies
