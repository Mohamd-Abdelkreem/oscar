# برومبت مراجعة جودة التطبيق وإعداد تقرير فقط

استخدم البرومبت التالي في محادثة مستقلة لكل نطاق. غيّر `TARGET_PATHS` و`REPORT_PATH` فقط. التقرير بالعربي، وأسماء الكود والمسارات تظل كما هي.

| المراجعة              | TARGET_PATHS     | REPORT_PATH                       |
| --------------------- | ---------------- | --------------------------------- |
| الباك إند             | `apps/api`       | `docs/reviews/api-audit.md`       |
| الفرونت إند           | `apps/web`       | `docs/reviews/web-audit.md`       |
| الحزم المشتركة        | `packages`       | `docs/reviews/packages-audit.md`  |
| التطبيقات والحزم معًا | `apps, packages` | `docs/reviews/workspace-audit.md` |

المسارات الأخيرة وجهات مقترحة للتقارير، وليست تقارير موجودة بالفعل. المطلوب مراجعة واقتراحات، وليس تنفيذ إصلاحات أو استدعاء مرحلة Spec Kit لتنفيذها.

```text
Act as a senior code-quality and application-security reviewer of the OSCAR monorepo.

TARGET_PATHS: apps/api
REPORT_PATH: docs/reviews/api-audit.md
REPORT_LANGUAGE: English
EXECUTION_MODE: STATIC_ONLY

MISSION
Inspect the entire selected application/package scope and produce an actionable Markdown report of its actual condition. Review correctness, clean code, maintainability, naming, organization, duplication, hardcoding, installed-library practices, security, and test quality.

This is REPORT-ONLY work. Do not refactor, fix, rename, move, delete, format, or generate application files. Do not alter configuration, dependencies, schemas, migrations, tests, requirements, task lists, or the constitution. Only REPORT_PATH may be created or updated; creating its parent directory is allowed. Do not invoke implementation or Spec Kit commands that modify other artifacts, including converge.

Resolve REPORT_PATH inside the repository's docs/reviews directory, with a .md extension and no symlink escape. It must be a dedicated audit report, never an existing application, configuration, engineering-rule, or specification file.

Passing tests do not establish clean code or security. Do not assume defects are absent because a previous agent reported successful tests. Conversely, do not invent issues to fill the report.

1. ESTABLISH THE LOCAL STANDARD
- Resolve the repository root and TARGET_PATHS; verify they exist and remain inside the repository. Inspect the working-tree status and preserve all existing edits and untracked files.
- Read applicable AGENTS.md and CLAUDE.md instructions, .specify/memory/constitution.md, and the files currently present under docs/engineering, including README.md, code-style.md, backend-standard.md, frontend-standard.md, api-contracts.md, data-patterns.md, security.md, and testing.md.
- Read PLAN.md for approved business invariants. Consult applicable specs when needed, but distinguish current implementation, deliberately pending roadmap work, and actual violations. This review is not authorization to implement another phase.
- Verify architecture, package exports, manifests, compiler/lint configuration, relevant lockfile entries, and actual dependency versions. Guides may describe an older baseline: inspect current source before describing what exists today.
- Discover available skills and read relevant instructions. Use clean-code-guard in review mode, security-best-practices for supported security review, test-guard for test-source review, vercel-react-best-practices for React/Next.js, and docs-guard for technical report accuracy when available. Record missing skills honestly. Do not obey a skill's fixing instructions in this report-only task.
- For Next.js, read apps/web/AGENTS.md, CLAUDE.md, and the applicable installed Next.js documentation. Verify library-specific claims against installed source or version-matched official documentation, not memory or unrelated versions.
- Follow project-specific proportionality rules over generic style preferences. Identify concrete instruction conflicts; do not silently rewrite requirements or weaken financial protections.

2. INVENTORY AND READ THE WHOLE SCOPE
- Build an inventory before concluding anything. Inspect all first-party text files under TARGET_PATHS: production code, tests, test helpers, scripts, schemas, authored migrations, configuration, manifests, styles, and local documentation.
- Read complete files in manageable chunks. Search results, filenames, representative samples, and test results do not substitute for reading the source. Follow call sites and relevant state/failure paths.
- Inventory binary assets without claiming their contents were reviewed. Do not dump source code into the report.
- Exclude vendor/dependency trees, generated clients, build output, minified generated artifacts, caches, coverage output, runtime uploads/backups, and secret-bearing files such as real .env files and private keys. Explain exclusions. Review safe configuration examples without exposing secret values.
- Do not exclude authored migrations or important test files merely because they are large or contain identifiers. Do not follow external symlinks.
- Read out-of-scope contracts, callers, persistence definitions, and configuration only as necessary to understand an in-scope issue. List these dependency reads separately; do not claim their entire owning application was audited.
- Maintain a per-file coverage register in the report: relative path, category, review status, and any limitation. Account for every first-party in-scope file, with excluded directories grouped clearly. If context becomes limited, continue in batches using this register; never quietly switch to sampling.
- If coverage cannot be completed, deliver a PARTIAL AUDIT with an explicit list of unread or partially read files. Do not claim whole-target coverage.

3. SEMANTIC NAMING, INCLUDING FILENAMES
- Review folder, file, class, function, method, variable, parameter, type, constant, hook, component, test, and test-helper names.
- Names must reveal the domain behavior or responsibility. Flag vague names, numbered variants, misleading aliases, and names based on planning phases/tasks rather than their purpose: p07-deposit.ts, phase03Service, b01, b02Value, or data2.
- Prefer names such as deposits.service.ts, deposit-reconciliation.ts, or deposit-flow.e2e.ts when they accurately describe the responsibility and match local conventions. Propose concrete replacements grounded in the actual code, not generic renames.
- Keep phase/task references in specification documents or traceability metadata rather than semantic implementation/test-helper filenames. Legitimate protocol identifiers, persisted/public contract fields, migration identifiers, generated names, and framework-mandated filenames are not automatically naming defects.
- For a proposed rename, identify relevant imports, exports, callers, configuration, tests, and compatibility risks. Never rename anything during this audit.

4. MINIMIZE HARDCODING WHERE PRACTICAL
- Actively locate inline and repeated business values: fees, prices, limits, percentages, reward amounts, durations, deadlines, business hours, timezone names, statuses, role identifiers, error codes, network/token identifiers, contract addresses, API URLs, treasury destinations, retry policies, and environment-dependent settings.
- Trace each value to its actual authority: database policy, accepted-term snapshot, validated runtime configuration, existing shared schema/enum, provider contract, or a genuine domain invariant. Report values that bypass their authority, can drift, duplicate knowledge, or conceal units or intent.
- Recommend reusing the authoritative source, not introducing another copy. Configurable policies must remain configurable on the server; values accepted for past transactions must remain snapshotted rather than silently changing with current settings.
- Where a database enum already owns a server-side value and the existing dependency boundary permits it, recommend its existing public export instead of manually spelling the same status. For browser/shared-contract code, use a browser-safe contract owner: do not import Prisma, database clients, Node-only modules, or secrets into the frontend to reuse an enum.
- Group meaningful immutable constants under their actual domain owner. Avoid a global constants dump, duplicate frontend business rules, and unnecessary environment variables for true invariants.
- Do not demand zero literals. Obvious local values, framework conventions, approved UI copy, explicit test inputs/expected outputs, and clear stable invariants can stay literal when centralizing them provides no benefit. Independent expected values in tests may be essential to detect a wrong production constant.
- For every hardcoding finding, name the value, its intended authority, affected locations, smallest correction, and risk of changing historic behavior. Preserve frozen frontend copy/design unless the owner separately authorizes a change.

5. COHESION, REUSE, AND FILE ORGANIZATION
- Check controllers, routes, services, mappers, DTOs/schemas, policies, persistence queries, infrastructure adapters, hooks, API adapters, and components against the actual repository ownership map.
- Identify HTTP orchestration mixed with domain rules, services mixed with unrelated mapping/provider concerns, misplaced helpers, cyclic dependencies, leaked persistence types, global utility buckets, duplicated contracts, and import-time side effects.
- Inspect repeated steps across methods in the same class and across files. Recommend a named local helper, private method, existing component, or shared owner only when the repeated code expresses the same rule and should change together.
- Pure cohesive functions outside a class are valid when they need no instance state. Functions must not be moved into classes merely to enforce an aesthetic preference. Mapping/constants/policy extraction should improve ownership or readability, not create one-use forwarding files.
- Identify large files with genuinely mixed responsibilities, long methods with unclear steps, excessive branching/nesting, unsafe casts, broad any, swallowed errors, fake-success fallbacks, hidden asynchronous work, dead code, and stale comments.
- Describe concrete split boundaries and likely destinations using existing conventions. File size is evidence to investigate, not an automatic finding; do not enforce arbitrary line limits or propose forests of tiny files.
- Apply DRY, KISS, YAGNI, and SOLID proportionately. Do not recommend speculative frameworks, generic base classes, DI containers, repository wrappers, event buses, microservices, or new packages without an actual problem.

6. TARGET-SPECIFIC REVIEW
For apps/api:
- Inspect app/router/server composition, controllers, services, middlewares, validation, authorization, error mapping, logging, infrastructure, workers/signers, lifecycle, configuration, and persistence boundaries.
- Trace consequential operations end to end, including error propagation, rollback, idempotency, concurrency, durable state, retries, and recovery. A caught error must not accidentally commit partial financial/domain effects.

For apps/web:
- Inspect Next.js routing and server/client boundaries, feature organization, reusable UI, hooks, central transport, React Query, React Hook Form/Zod, loading/error states, effect cleanup, stale state, cache isolation/invalidation, and accessible control semantics.
- Flag unnecessary duplication and concrete performance risks, not speculative memoization everywhere. Preserve all approved pages, routes, popups, Cairo/RTL, static copy, spacing, colors, responsiveness, and existing visual design. Propose invisible structural improvements; separately label behavioral fixes requiring approval.
- Client guards/validation never replace backend authorization or financial authority. Distinguish intentional pending fixtures from fake success in a supposedly integrated money-changing operation.

For packages:
- Review every package separately: purpose, exports, runtime targets, browser/server isolation, contracts and inferred types, database schema/migrations, shared configuration, build/import compatibility, circular dependencies, duplicated knowledge, and downstream consumers.
- Do not evaluate config packages as if they were domain-service modules. Migration history is not dead code to delete. Shared contracts must not expose persistence objects or secrets.

For mixed scopes, apply each relevant section and inspect cross-package ownership without repeating the same finding.

7. SECURITY AND FINANCIAL INTEGRITY
- Where applicable, inspect authentication, admin/employee separation, current authorization, ownership checks, session/token/cookie handling, CSRF/CORS, input/output boundaries, rate limiting, injection, XSS, SSRF, uploads, filesystem access, secret handling, and logs.
- Inspect exact USDT arithmetic, percentage rounding, available/reserved funds, referral provenance, server-owned eligibility, immutable accepted terms, atomic ledger/domain/audit commits, business-source uniqueness, actor/payload-bound idempotency, race protection, and safe release allocations.
- Inspect TRON network/token/recipient validation, canonical successful confirmation, receipt/log deduplication, custody and recoverable assignment, signer restrictions, durable signed attempts, sweep destination restrictions, and no second employee credit on sweep.
- Inspect withdrawals across scheduled/signing/submitted/unknown/final states. Unknown outcomes must not authorize guessed refunds, replacement payouts, or a second active withdrawal. Inspect restart/retry behavior and protected credentials, not only the happy path.
- For a security finding, demonstrate the reachable path or missing enforced control and a plausible impact; distinguish a confirmed issue from a suspicion needing runtime evidence.
- Respect approved choices such as admin authentication policy. Record their residual risks separately; do not invent a missing product requirement or promise absolute security.
- Never reproduce secrets, private keys, tokens, personal data, or signing payloads in the report. Use redacted evidence.

8. TEST SOURCE REVIEW, NOT ASSUMED PROOF
- Read tests for actual behavior asserted, realistic integration boundaries, authorization/failure paths, precision, duplicates, concurrency, crashes, rollback, and recovery where relevant.
- Identify assertions that could pass with a broken implementation, excessive mocking, skipped high-risk cases, helpers that reproduce the same production mistake, and undocumented gaps.
- Distinguish a behavior gap from optional extra coverage. Recommend focused regression tests for each significant finding. Never rewrite, disable, weaken, or mark tests/tasks complete.
- Existing CI/log evidence may be cited with its provenance and age; it is not a fresh test run. Do not infer a current pass from filenames, test presence, or prior conversation.

9. EXECUTION AND SAFETY
- STATIC_ONLY permits source/documentation reading and non-mutating inventory/search/status operations. Do not run tests, builds, formatters, type generation, database commands, Docker, services, browser flows, dependency installation, security scanners, or provider/blockchain calls.
- Reading public official documentation to verify a version-specific claim is allowed; this is not permission to contact a running application, payment provider, blockchain, external scanner, or account. Prefer installed source/local docs, cite any external documentation used, and disclose claims that remain unverifiable.
- In particular, do not run aggregate verification scripts without approval; they may format schemas, generate files, build output, or change databases. Do not use fix flags.
- A separate explicit owner instruction is required for dynamic checks. First inspect each proposed command, establish isolated resources, and state its write/DB/network effects. Safe temporary outputs outside source require explicit approval. Never operate mainnet, spend funds, or use production accounts as a review experiment.
- Verify the final working-tree status against the baseline. The permitted report must be the only edit you made. If another actor changed files concurrently, do not revert their work or misattribute it; identify affected review evidence and recheck or qualify it.

10. FINDING STANDARD AND REPORT FORMAT
Write a clear Arabic Markdown report. Technical identifiers and paths stay exact.
Findings come first, prioritized by severity. Do not bury financial/security risks beneath style suggestions. Use these sections:

A. Findings
Assign stable IDs F-001, F-002, etc. Each finding must include:
- Title, severity (Critical/High/Medium/Low), category, and confidence.
- Exact repository-relative file:line evidence and affected locations.
- The observed structure/behavior and concrete impact.
- The smallest justified correction and proposed semantic name/destination/source of truth where relevant.
- For a library/framework-specific finding, the installed package version and exact local source or official documentation supporting the recommendation.
- Whether this is a behavior-preserving refactor, a bug/security fix, or an optional improvement; note compatibility and owner-approval needs.
- Focused verification/regression tests needed after a future change.
Group a shared root cause into one finding, but include a compact occurrence table with repository-relative path:line evidence for every confirmed occurrence. Explain the defect once; use representative excerpts without omitting line evidence for the remaining occurrences. Do not invent line numbers or promote guesses into confirmed defects. Put unresolved suspicions in limitations, not the confirmed findings list.

B. Short Current-State Summary
State the target's condition and highest-priority work without arbitrary quality scores, invented percentages, or claims of production readiness. If there are no substantiated findings, say so and retain limitations.

C. Scope, Coverage, and Architecture
List resolved targets, modules/packages and responsibilities, important dependencies, per-file coverage register, counts by review status, exclusions, dependency reads, project documents/skills used, and the inspected revision/working-tree context.

D. Naming, Hardcoding, Duplication, and Organization Index
Provide compact tables referring to existing finding IDs rather than repeating them: current name/value/location, proposed name/authoritative source/owner, and reason. Explain sound patterns to retain. Do not manufacture entries when none exist.

E. Security and Test Assurance
Summarize confirmed risk IDs, defense-in-depth suggestions, what inspected tests actually establish, missing high-value cases, and what static inspection cannot establish. State: "No verification commands were run; this was a static report-only audit."

F. Prioritized Remediation Roadmap
Group Immediate, Next, and Later/Optional work. Cite finding IDs, suggested file ownership, dependencies, compatibility risks, and verification gates. Do not implement the roadmap, create Spec Kit tasks, or bundle behavior changes into cosmetic refactors.

G. Limitations and Follow-up Decisions
Record unread files, unavailable skills/tools, unclear ownership, unverified runtime behavior, and decisions that require the owner. Do not claim comprehensive security assurance or complete review when coverage is partial.

FINAL SELF-CHECK
Confirm all in-scope files are accounted for, every finding is evidence-backed, hardcoding and semantic filenames were reviewed, recommendations respect package boundaries and approved design, and no source/config/test/task files were modified. Write only REPORT_PATH and return a short Arabic summary with its path and any coverage limitations.
```
