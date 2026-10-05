# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

**Roadmap Phase**: [Pnn - exact title from PLAN.md]

**Feature Directory**: [exact generated/selected feature path]

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: [Only this phase's approved requirements; cite PLAN.md sections]
- **Exclusions**: [Future/completed phase work and other out-of-scope behavior]
- **Prerequisites**: [Predecessor/group gates and evidence; missing evidence stays visible]
- **Frontend boundary**: [Existing surfaces for authorized integration, or no frontend work]
- **Owner decisions**: [Missing UI/frozen-presentation conflicts or genuine unsettled policy]
- **Acceptance gate**: [Observable phase completion conditions and required verification]

Apply `.specify/memory/constitution.md` and the operating contract in
`docs/workflow/speckit-prompts.txt`. Read all eight engineering guides at phase start.
Preserve the frontend freeze; a roadmap requirement for a missing screen, static-copy
change, or new/changed dialog is not approval to create it. Keep relevant conflicts,
including dedicated admin login, explicit without dropping their business/security
requirements. Backend prerequisites must pass before dependent frontend integration.

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each story/journey must be independently testable within its declared prerequisites.
  Story priority does not authorize bypassing backend/group gates or phase boundaries.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Implemented within the selected phase and explicit dependencies
  - Tested through an observable acceptance boundary
  - Demonstrated after required prerequisites pass
  Deployment is a separate owner-authorized operation.
-->

Every implementation phase MUST create or extend actual automated test files.
Acceptance scenarios MUST include relevant authorization, failure, boundary-time,
replay/concurrency, and uncertain-provider outcomes when affected. State observable
results and preserved financial invariants; do not substitute fixtures, screenshots,
or a planned test for required execution evidence. Exact formulas and calendar
rules come from PLAN.md and the constitution, not assumptions or old UI examples.

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
  Use phase acceptance and risk boundaries, without inventing capacity promises,
  arbitrary coverage targets, or perfect-security guarantees.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable failure/invariant outcome for an applicable phase boundary]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
  Do not guess financial policy, assume missing UI approval, or reopen settled
  owner decisions. Genuine material ambiguity or conflict remains an explicit gate.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for v1"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]
