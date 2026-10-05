<!--
Sync Impact Report
- Version change: unversioned template -> 1.0.0 (initial project ratification).
- Modified principles:
  - PRINCIPLE_1_NAME -> I. Approved Scope and Verifiable Evidence
  - PRINCIPLE_2_NAME -> II. Approved Frontend Preservation
  - PRINCIPLE_3_NAME -> III. Existing Ownership and Proportionate Design
  - PRINCIPLE_4_NAME -> IV. Backend Before Frontend
  - PRINCIPLE_5_NAME -> V. Financial Integrity and Recoverable Custody
- Added principles: VI. Current Authority and Protected Boundaries;
  VII. Required Verification and Truthful Completion.
- Added sections: Engineering Guide Obligations; Delivery and Completion Gates;
  concrete amendment, versioning, and compliance rules under Governance.
- Removed sections: illustrative template instructions only; no adopted policy removed.
- Synchronization:
  - Updated: .specify/templates/plan-template.md
  - Updated: .specify/templates/spec-template.md
  - Updated: .specify/templates/tasks-template.md
  - Updated: README.md
  - Reviewed, unchanged: .specify/templates/constitution-template.md,
    .specify/templates/checklist-template.md, apps/web/AGENTS.md, apps/web/CLAUDE.md,
    PLAN.md, docs/engineering/, docs/workflow/speckit-prompts.txt.
  - .specify/templates/commands/ and .specify/extensions.yml are absent;
    no command templates or extension hooks require synchronization/execution.
- Deferred placeholders: none.
- Owner follow-up: resolve missing admin login and any roadmap-required changes to
  frozen copy, controls, or dialogs before affected frontend work. These conflicts
  remain gates; the roadmap and engineering guides have not been rewritten.
-->

# OSCAR Constitution

## Core Principles

### I. Approved Scope and Verifiable Evidence

Work MUST follow the currently authorized command, selected roadmap phase, and
explicit task scope. `PLAN.md` owns approved business requirements; the engineering
guides own implementation and review rules. Agents MUST read the whole roadmap for
dependencies and conflicts while producing only artifacts owned by the selected
command and phase. They MUST verify existing behavior, paths, dependencies, APIs,
and commands against source, configuration, manifests, and installed tools.
Proposed work MUST be distinguished from implemented behavior and executed checks.
Old prompts, fixtures, and UI examples MUST NOT override approved financial rules.
Unrelated edits MUST be preserved; commits and pushes require an owner instruction.

Rationale: bounded scope and traceable evidence prevent accidental expansion and
claims that the repository or verification results cannot support.

### II. Approved Frontend Preservation

Existing employee and admin designs are frozen. Work MUST NOT add, delete, move,
rename, rebuild, or redesign pages, routes, layouts, navigation, or popups, or change
approved static copy, Cairo typography, RTL, colors, spacing, breakpoints, control
sizes, icons, styling, or interaction presentation without an explicit owner
decision. Authorized integration MAY replace fixtures with runtime values and add
real event handlers, validation, authorization state, and query/mutation state to
existing controls. Feedback, loading, error, and confirmation behavior MUST reuse
existing surfaces. Invisible logic extraction MUST preserve rendering and behavior
and remain within the authorized integration scope.

Next.js App Router and established navigation/transport patterns MUST be preserved.
A missing required surface or a conflict with frozen presentation MUST be reported
and left unresolved until the owner decides; agents MUST NOT invent UI, conceal
success, or drop the underlying requirement. The required dedicated admin login
screen is such an unresolved conflict. Older roadmap and engineering instructions
to add screens or change static copy/dialogs do not authorize those changes.

Rationale: functional integration must preserve the approved product while exposing
requirements that need a separate design decision.

### III. Existing Ownership and Proportionate Design

Work MUST preserve the apps/packages monorepo, package names, installed versions,
and pnpm/Turborepo workflow. Placement MUST follow the engineering index: thin
route/page and HTTP composition, domain rules in owning backend modules, provider
calls in protected adapters, browser-safe validated wire schemas in
`packages/contracts`, persistence in `packages/database`, and frontend operations
through existing feature API/hooks and central transport. Contracts MUST be owned
once and runtime-validated at untrusted boundaries.

Clean Code, DRY, KISS, YAGNI, and SOLID MUST be applied proportionately. Modules MUST
have focused responsibilities; reuse MUST reflect shared meaning. Splits MUST serve
responsibility, independent testing, or meaningful reuse, without arbitrary file-size
or coverage quotas. Unsafe casts, broad `any`, disabled checks, and weakened tests
MUST NOT hide defects. Speculative layers, duplicate business schemas, mandatory
repository/DI frameworks, microservices, generic outboxes/event buses, and version
registries MUST NOT be added for this MVP. Needed dependencies MUST have a stated
phase purpose and verified compatibility; lockfile changes MUST be justified.

Rationale: existing owners and modest abstractions keep financial behavior inspectable
without replacing the boilerplate or creating another platform.

### IV. Backend Before Frontend

Roadmap phases MUST respect their predecessor gates and be executed one selected
phase at a time. Tasks MUST use small dependency-safe batches with concrete file
ownership; parallel work MUST have independent ownership and satisfied dependencies.
A batch or Spec Kit internal task-group number MUST NOT be treated as a completed
roadmap phase or authority to start another one. Completed phases and existing
foundations MUST NOT be recreated as setup work.

Before integrating a domain's frontend, its entire required backend group MUST be
complete and tested, including applicable migrations, shared contracts, authorization,
services, endpoints, workers, and failure handling. Money-changing controls MUST NOT
use partial services or mock success. A necessary shared-code correction MUST be
bounded and justified within the authorized phase.

Rationale: backend acceptance establishes the truth that existing screens consume.

### V. Financial Integrity and Recoverable Custody

All money, eligibility, terms, and transitions MUST be server-authoritative. USDT is
the only balance asset. Arithmetic MUST use bounded exact integer micro-USDT, with
validated canonical decimal strings at JSON boundaries. Percentage calculations
MUST use integer basis points and floor to one micro-USDT; verified deposit units
MUST remain exact. Clients MUST NOT supply authoritative balances, rewards,
entitlements, fees, commissions, deadlines, or payment outcomes.

One transactional financial service MUST commit business effects, append-only ledger
postings, source projections, reservations, and required audit atomically in
PostgreSQL. Database constraints, business-source uniqueness, conditional transitions,
and deterministic concurrency protection MUST prevent duplicate effects and
overspending. HTTP idempotency MUST bind actor, operation, key, and payload; a new
or absent client key MUST NOT bypass business uniqueness. Historic postings and
genuine chain receipts MUST NOT be rewritten; corrections MUST append audited entries.
Transactions MUST NOT remain open across external network or file-processing I/O.

Referral/non-referral provenance and available/reserved funds MUST remain distinct.
Purchases MUST consume unreserved referral funds first, then other unreserved funds;
withdrawals MUST reserve eligible non-referral funds first, then eligible referral
funds. Safe cancellation or release MUST restore the identical recorded allocation
exactly once. Reserved funds MUST NOT be spent again, and expiry MUST change
eligibility without erasing ownership or reclassifying locked commissions as deposits.
Accepted terms and eligibility MUST be snapshotted. Full target-price upgrade debit
and the positive difference from the previous snapshotted price used for commissions
MUST remain separate calculations. Submission MUST NOT credit spendable balance;
only final admin approval MUST post its snapshotted reward, exactly once.

One shared server-authoritative `Asia/Baghdad` calendar MUST govern business dates
and counted deadlines independently of host/browser time. Subscription work dates,
task windows, and withdrawal counted hours MUST retain their distinct approved
rules in `PLAN.md` and the relevant specifications. Confirmed eligible deposits MUST
credit every day without a withdrawal-style hold. Credit MUST verify configured
network/token, successful canonical confirmation, destination ownership, exact units,
and event identity, deduplicated by network, transaction ID, and receipt log index.
A supplied public transaction ID alone MUST NOT authorize credit. Manual credits
MUST remain separately audited; treasury sweeps MUST NOT credit employees again.

PostgreSQL MUST own durable withdrawal deadlines, state, source reservations, and
attempt identity. Queue wakeups MUST be repairable from durable records and safe
under duplicates, stale jobs, races, crashes, and restarts. At most one withdrawal
per user MAY be active, including scheduled, signing, submitted, and unknown outcomes.
Unknown or possibly submitted transfers MUST remain active and reserved until
reconciled. Safe unsent cancellation MUST NOT become an in-flight refund or destination
redirection. Persist signed material, transaction identity, attempt identity, and
broadcast intent before broadcasting. Retries MUST reconcile/reuse that attempt;
a replacement MUST require proof that the prior attempt cannot execute or succeed.
Settlement MUST require verified successful canonical-final evidence.

Custody/signing MUST run within protected process, credential, and permission
boundaries. Deposit addresses MUST NOT be published before acknowledged recoverable
encrypted off-VPS key/address/employee-assignment records exist; old addresses MUST
NOT be reassigned. Restore MUST fence financial writes/new dispatch, recover
post-snapshot off-chain commits and required custody/assets/attempt records, and
reconcile chain and in-flight outcomes before resuming. Missing recovery history
MUST NOT be repaired by guessed balances or replacement payments. Deployment,
mainnet transactions, and real spending require explicit owner authorization.

Rationale: atomic provenance and durable evidence conserve funds across normal work,
concurrency, uncertain providers, and recovery.

### VI. Current Authority and Protected Boundaries

Clients, uploads, provider responses, and job messages MUST be treated as untrusted.
Every protected operation and private-file read MUST enforce current server identity,
role, status, session authority, ownership, entitlement, restrictions, and allowed
state transitions. Changing authority/state MUST be rechecked at the transactional
write or signing claim. Hidden controls and well-formed IDs MUST NOT grant access.

Shared password, token, session, CSRF, validation, rate-limit, and redaction protections
MUST be preserved and tested when affected. Production credential and network
configuration MUST fail closed. Private proofs MUST use validated bounded processing,
authorized access, and the approved retention policy. Signing keys, secrets, and
private payloads MUST stay out of browser code, public routes, logs, fixtures, and
ordinary diagnostics. Privileged actions MUST enforce required confirmation/reasons
and derive audit actor/time from authenticated server context.

Multiple administrators MAY exist; any one authorized administrator MAY authorize
an action. The approved absence of admin 2FA and dual approval MUST NOT be silently
reversed or used to weaken compensating controls. Compromised-admin and host risks
MUST remain explicit, with restricted signer authority, operational limits, audit,
and independent money/security review before launch. No security guarantee is permitted.

Rationale: current authorization and narrow secret boundaries reduce misuse while
honestly retaining the risks accepted by the owner.

### VII. Required Verification and Truthful Completion

Every implementation phase MUST create or extend actual automated test files for
acceptance behavior and realistic failures. Financial/provider changes MUST cover
applicable replay, concurrent conflicts, unauthorized/malformed input, boundary time,
rollback, crash/retry, and uncertain outcomes. Money/constraint/atomicity claims MUST
use real migrated PostgreSQL; queue lifecycle, private storage, browser, and testnet
claims MUST use their required actual boundaries. Mocks, screenshots, planned tests,
or format checks MUST NOT substitute for required integration evidence.

Agents MUST use actual manifest scripts and existing test ownership, run focused
tests and affected shared regressions per batch, and run full current regressions at
roadmap checkpoints and before release. Applicable skills MUST be read and applied:
`clean-code-guard` for nontrivial production edits, `test-guard` for changed tests,
`docs-guard` for changed technical docs, `security-best-practices` for security-sensitive
JavaScript/TypeScript work, `vercel-react-best-practices` for React/Next work, and
`playwright` for applicable browser verification. Relevant installed Next.js guidance
and web agent instructions MUST precede framework-dependent edits. Missing skills
or tools MUST be reported without fabricated usage or results.

Reports MUST distinguish fresh execution, cached/reused evidence, failures, and
unperformed checks. Missing required infrastructure or financial/integration evidence
MUST leave its gate incomplete. Tests/checks MUST NOT be weakened to claim completion.

Rationale: completion rests on observed behavior at the claimed boundary.

## Engineering Guide Obligations

Before planning, task generation, implementation, refactoring, or review, agents MUST
consult `docs/engineering/README.md` and its reading map. All eight guides MUST be
read at each phase start; relevant sections and affected source/callers MUST be
revisited for each bounded batch. The same guides MUST govern post-edit review and
convergence, as well as generation. Detailed rules remain in their owning guide:

| Guide                                   | Owner                                                    |
| --------------------------------------- | -------------------------------------------------------- |
| `docs/engineering/README.md`            | Reading workflow, placement, repository ownership        |
| `docs/engineering/code-style.md`        | Naming, types, responsibility, reuse, maintainability    |
| `docs/engineering/backend-standard.md`  | Express composition, services, side effects, lifecycle   |
| `docs/engineering/frontend-standard.md` | Next/React integration, forms, transport, cache          |
| `docs/engineering/api-contracts.md`     | Shared validated wire schemas, HTTP, compatibility       |
| `docs/engineering/data-patterns.md`     | Persistence, constraints, transactions, migrations       |
| `docs/engineering/security.md`          | Authority, credentials, custody, private files, recovery |
| `docs/engineering/testing.md`           | Test ownership, boundary evidence, commands, completion  |

Guide examples describe existing or proposed work; they do not authorize new scope
or exceptions. Conflicts MUST be resolved through Governance, without rewriting a
guide or the roadmap to conceal them.

## Delivery and Completion Gates

- Phase work MUST start from this populated constitution, the authorized phase's
  requirements, predecessor evidence, repository instructions, engineering guides,
  and a checked working tree. The feature pointer and selected spec MUST match that
  roadmap phase before downstream work; a mismatch requires correct owner selection.
- Specs/plans MUST state deliverables, exclusions, acceptance criteria, dependencies,
  and unresolved decisions. Constitution checks MUST pass before planning research
  and be repeated after design. Justification tables MUST NOT waive a principle.
- Task generation MUST include concrete owners/paths, dependencies, actual test-file
  work, required services, and verification. Implementation MUST receive explicit
  task scope, preserve out-of-scope work, and leave requirement-approval markers
  read-only. Required unresolved quality, financial, security, or UI decisions MUST
  remain gates rather than checked approvals.
- Post-edit review MUST use the engineering guides and applicable skills; required
  in-scope findings and checks MUST be resolved before marking a task complete.
  Completion MUST distinguish a batch from the whole phase. Convergence MUST use
  evidence honestly and honor its append-only task boundary; it MUST NOT repair
  implementation or invent a test pass.
- Launch MUST satisfy the roadmap's regression, controlled testnet, UAT, configuration,
  deployment/restore, and independent review gates, and receive explicit owner
  authorization. Testnet MUST be separately opt-in with test-only credentials and
  explicit network/token/funding; missing prerequisites MUST NOT trigger mainnet fallback.
- Agents MUST stop at the selected command/scope. Toolkit installation, another
  phase, deployment, commits/pushes, and real-money activity MUST NOT follow automatically.

## Governance

Authority order is: explicit current owner decisions; this constitution; approved
`PLAN.md` requirements for the selected phase; engineering guides for implementation;
source/configuration as current-state evidence; generated artifacts; older documents
and fixtures. Source MUST NOT override approved intended behavior. A current owner
decision changing project-wide policy MUST be recorded as an explicit amendment;
agents MUST NOT silently dilute a principle to make a feature pass.

An amendment MUST identify the owner-approved decision, affected principles,
rationale, compatibility/migration effects, and necessary template/guidance updates.
It MUST update the synchronization report, version, and amendment date. Ratification
date remains the original adoption date. No routine phase command authorizes a
constitution amendment. Semantic versioning MUST use MAJOR for incompatible
governance/principle removals or redefinitions, MINOR for added principles/sections
or materially expanded guidance, and PATCH for nonsemantic clarifications/fixes.

Planning, implementation review, convergence, and release review MUST check this
constitution against the owning requirements, guides, source, and actual evidence.
Conflicts MUST be reported with the affected requirement, policy, and decision
needed. The dedicated admin login requirement remains mandatory but its missing
screen is blocked by the frontend freeze until the owner decides. Older instructions
to remove deposit UI, replace withdrawal dialogs, or edit Arabic static copy MUST
receive the same treatment where they require frozen presentation changes.
These gates do not authorize dropping financial/security behavior or completing an
affected frontend phase early. Future UI decisions do not block unrelated backend
specification. Unavailable evidence MUST remain visible as an unmet completion gate.

Use `docs/workflow/speckit-prompts.txt` for the operating contract and selected-command
boundaries; its other prompts are not authorization to execute further stages.

**Version**: 1.0.0 | **Ratified**: 2026-10-02 | **Last Amended**: 2026-10-02
