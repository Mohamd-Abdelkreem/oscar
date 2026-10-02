# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Roadmap Phase**: [Pnn - exact title from PLAN.md]

**Feature Directory**: [exact selected feature path; verify .specify/feature.json and spec.md]

**Input**: Feature specification from the verified feature directory's `spec.md`

**Note**: Use the installed `$speckit-plan` skill and the selected PLAN prompt in
`docs/workflow/speckit-prompts.txt`. Spec Kit research/design steps below are internal
steps for this feature, not additional OSCAR roadmap phases or implementation authority.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [TypeScript/Node versions verified against owning manifests]

**Primary Dependencies**: [Existing phase-relevant dependencies; justify/verify any additions]

**Storage**: [Applicable PostgreSQL/private-file/queue boundaries and current implementation state]

**Testing**: [Owning existing harnesses, actual scripts, and phase-required infrastructure]

**Target Platform**: [Relevant browser/server/worker/signer runtime; deployment remains separately authorized]

**Project Type**: [Affected owners within the existing web/API monorepo]

**Performance Goals**: [Approved phase-relevant workload and measurable boundaries; no invented guarantees]

**Constraints**: [Applicable scope, frontend freeze, financial/security rules, prerequisite gates]

**Scale/Scope**: [Selected roadmap phase only; approved workload assumptions from PLAN.md]

## Constitution Check

_GATE: Must pass before planning research. Re-check after design._

Read `.specify/memory/constitution.md`, applicable repository instructions, `PLAN.md`,
and all eight `docs/engineering/` guides before planning. Record PASS/BLOCKED with
concrete evidence for every gate; justify any inapplicable financial/UI boundary.

- **I - Scope/evidence**: One selected roadmap phase, matching feature pointer/spec,
  explicit deliverables/exclusions, verified current source/tools, and proposed work
  clearly distinguished from existing behavior.
- **II - Frontend preservation**: Only authorized integration of existing UI; no
  frozen presentation changes or missing surfaces assumed approved. Relevant owner
  decisions, including the missing admin login conflict, remain visible gates.
- **III - Ownership/design**: Existing apps/packages, shared contracts, central
  transport, and installed stack preserved; dependencies/abstractions justified by
  this phase and assigned to the engineering guides' existing owners.
- **IV - Backend prerequisites**: Predecessor gates evidenced; backend group complete
  and tested before dependent frontend integration; dependency-safe bounded work.
- **V - Financial/custody invariants**: Applicable exact USDT, source-preserving
  atomic/idempotent transitions, snapshots, Baghdad calendar, durable reservations,
  uncertain-payout reconciliation, signing, and recovery rules accounted for.
- **VI - Security**: Current role/status/session/ownership and state checks, protected
  credential/file/provider/signing boundaries, privileged audits, and accepted
  no-2FA/single-admin-action residual risk accounted for where affected.
- **VII - Verification**: Actual automated test work has concrete paths, boundary
  scenarios, manifest-backed commands, required infrastructure, focused/shared and
  checkpoint checks. Missing evidence is an explicit completion gate.

Design and review MUST consult the owning engineering guides. A plan does not prove
implementation, a test pass, or release authorization. Unresolved required conflicts
MUST NOT be waived by the complexity table.

## Project Structure

### Documentation (this feature)

```text
[exact selected feature directory]/
├── plan.md              # This file ($speckit-plan output)
├── research.md          # Internal research output ($speckit-plan)
├── data-model.md        # Applicable design output ($speckit-plan)
├── quickstart.md        # Validation instructions ($speckit-plan)
├── contracts/           # Applicable design output ($speckit-plan)
└── tasks.md             # $speckit-tasks output; not created by $speckit-plan
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Narrow the existing owner map below to this phase's affected
  paths and identify proposed files explicitly. Do not replace the monorepo,
  reinitialize existing frameworks, or create empty layers to match a template.
-->

```text
apps/api/src/            # Owning domain modules and protected infrastructure
apps/web/src/            # Existing App Router, features, hooks, central transport
packages/contracts/src/  # Shared browser-safe runtime wire schemas
packages/database/       # Prisma schema, forward migrations, persistence tests
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill only for necessary complexity or a concrete unresolved policy conflict.**
> Justification is not permission to violate the constitution. A required owner
> decision or explicit policy amendment remains a gate until resolved; agents MUST
> NOT amend the constitution during ordinary phase planning.

| Violation                                     | Why Needed            | Simpler Alternative Rejected Because                              |
| --------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| [necessary complexity or unresolved conflict] | [phase-specific need] | [simpler approach considered; required owner decision if blocked] |
