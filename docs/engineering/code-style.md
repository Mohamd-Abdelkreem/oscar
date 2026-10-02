# Code Style and Clean-Code Review

Scope: source organization and maintainability across OSCAR. Data/security/HTTP/UI
details belong to their linked guides; clean code does not override their invariants.

## 1. Executable Configuration Wins

Use the repository's shared Prettier, ESLint and TypeScript configuration. Current
formatting is two spaces, double quotes, semicolons, LF and trailing commas.
Do not create a competing formatter/linter or weaken checks to accommodate output.

The shared TypeScript base enables strict checking, unknown catch values,
exact optional semantics, unchecked-index handling and verbatim module syntax.
Use type-only imports where required and narrow unknown external values explicitly.

Match the actual import/runtime convention: API relative imports use emitted
`.js` paths; contracts use source `.ts` paths with the configured rewrite;
web uses its existing `@/` alias. Workspace dependencies use
`@template/contracts` / `@template/database`, not template aliases from another project.
Inspect adjacent files and package build settings before introducing a new import.

## 2. Names and Responsibilities

- Name code for its domain operation. Avoid generic `handleData`, `processAll`,
  vague boolean props, numbered variants and unrelated `utils` buckets.
- Preserve existing role-based filenames and feature conventions. Do not rename
  working trees just to make them resemble a sample.
- Keep routes, controllers, services, DTOs, rules, mappers, adapters, hooks and UI in
  their responsible owners; see the placement map in [README](README.md).
- Existing API controllers/services use classes and constructor dependencies.
  Follow that pattern for similar modules; pure transforms and route factories can
  be functions. Neither every function nor every helper needs a class.
- Split a file at a coherent responsibility, independent test/change boundary, or
  genuine reuse. No universal maximum lines, parameters or branches.
- Keep module indexes deliberate. Export their intended public surface, avoid cycles
  and do not perform provider calls or initialize secret-bearing state during import.

## 3. Types Without Pretending

Infer obvious local types; explicitly type public contracts, callbacks and important
boundaries. HTTP types come from shared schemas, persistence types remain server-only.
Use `readonly` where mutation is not part of a contract; it is not runtime freezing.

Avoid `any`, double casts, unexplained non-null assertions, `ts-ignore`,
`ts-nocheck` and broad lint disables. A narrow integration assertion may be necessary
after a real validation boundary: document why, keep it local, and cover it.
Do not cast a DTO into a Prisma model or claim a generic performs runtime validation.

Handle `undefined`, `null`, empty and invalid distinctly. Do not introduce empty IDs,
zero money, fake dates or success defaults to hide missing required context.
Use discriminated unions for states with different behavior; ordinary booleans and
nullable fields remain appropriate when their meaning is clear.

Use an object parameter when it makes a multi-field operation safer/readable, not
as a compulsory wrapper for every function. Avoid generic type machinery that makes
a straightforward domain operation harder to inspect.

## 4. Functions and Failure

Keep one understandable operation per function, prefer named steps and guard clauses
when they reduce nesting, and make consequential side effects visible.
Do not extract trivial one-use steps merely to satisfy a slogan or line-count rule.

Await work whose result/failure matters. Catch only to recover, translate, compensate,
or deliberately report; do not return fake success, zero balance or empty history on
failure. Preserve useful safe error context, without credentials or private payloads.

A detached promise or timeout is not a durable money job. Lifecycle/restart/retry
semantics belong to the backend/data owners. Inject a clock, provider or ID source
when behavior genuinely depends on it, not to wrap every standard library call.

Remove unreachable/dead code, abandoned alternatives and obsolete exports.
Preserve unrelated edits; avoid cleanup outside the requested behavioral surface.

## 5. DRY, SOLID, KISS and YAGNI in This Repository

Reuse duplicated **knowledge** with the same meaning and change reason.
Similar-looking code from unrelated domains need not be coupled.
For a repeated button/form/error/cache policy, improve its existing owner and reuse it.

Keep a helper feature-local until stable independent consumers justify sharing.
Low-level shared utilities and UI primitives must not depend on feature internals.
Composition components, such as the existing auth guards and workspace shell, may
consume established feature hooks/APIs when that is their responsibility; do not
move or duplicate authentication just to remove that valid dependency. Prefer
domain composition over giant switches, universal base classes, service locators
and speculative interfaces.

Constructor injection already provides useful API test boundaries. Do not add a DI
container, repository layer, event bus, strategy registry or microservice solely
because it is called a best practice. Introduce one only for a concrete problem
that simpler local code cannot reasonably solve.

Avoid single giant components with dozens of unrelated modes, and avoid the opposite:
a forest of five-line files, empty interfaces and forwarding wrappers.
A useful abstraction makes its contract, ownership and failure behavior clearer.

## 6. Immutable Rules and Mutable State

Keep constants with the module that owns their meaning. Reuse canonical statuses
and stable error codes instead of scattered raw strings.
Do not create a global constant dump or replace configurable policies with UI constants.

Persist accepted financial terms and transitions on the backend. A browser helper
can format a server value, but cannot authorize a balance, entitlement or payment.
Frontend transient state and backend financial truth are different responsibilities.

Use immutable inputs/results where helpful. When mutation is necessary, make its
owner and scope explicit; do not mutate props, shared cached DTOs or historic records.

## 7. Comments and Examples

Comments explain intent, a security/concurrency constraint or a non-obvious
compatibility decision. Do not narrate obvious assignments or leave stale comments.

Keep docs/examples aligned with actual source. Examples must name whether they are
existing or proposed, and must not bring dependencies or product scope from Fury.
A necessary Arabic label is appropriate; identifiers and technical documentation
remain consistent English. Do not introduce unexplained machine paths or credentials.

## 8. Review Checklist

- Can a maintainer locate the owner and follow the operation/failure path?
- Did the change preserve public behavior and relevant null/optional semantics?
- Are untrusted values validated, types truthful and side effects awaited?
- Are dependencies acyclic and imports compatible with the actual runtime?
- Is shared code genuine reuse, without speculative frameworks or duplication?
- Were large responsibilities separated without arbitrary fragmentation?
- Are errors, loading/unavailable state and uncertainty represented honestly?
- Do comments, tests and docs reflect the final behavior?
- Did focused lint/type/format and appropriate behavior checks actually run?

Use `clean-code-guard` for nontrivial production changes, `test-guard` for tests,
and `docs-guard` for documentation. Apply relevant frontend/security skills as
described in [README](README.md). Record actionable findings with file/line,
behavior or maintenance risk and the smallest correction; do not invent issues
for subjective preferences. A clean pass is allowed.

References: [TypeScript verbatim module syntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html).
Repository configuration, not an upstream default, remains authoritative.
