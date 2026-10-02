# OSCAR Engineering Standards

These eight guides define how to implement and review OSCAR. They are tailored to
the repository, not a requirement to recreate another project's folders or examples.
They do not install Spec Kit or write the constitution.

**Verified baseline:** October 2, 2026. Existing implementation examples below are
reference points, not claims that every current file already satisfies these rules.
Financial/task/TRON modules are planned work; approved designs still use fixtures.

## 1. Authority and Reading Workflow

The approved requirements and active phase determine **what** to build. These guides
determine **how** to build it. Runtime schemas, configuration and source establish
what currently exists. Do not copy old fixture behavior over a newer approved rule.

Read this index and [code-style](code-style.md) before implementation or review.
At the start of an OSCAR phase, read all eight guides; for bounded task batches,
revisit the relevant sections and affected source. Read [security](security.md)
for any untrusted-input, identity, file, money or provider boundary.

When instructions conflict, identify the concrete conflict. Preserve explicit
approved business decisions and do not silently weaken a financial invariant.
Do not treat an example, a suggested path, or an upstream feature as authorization
to add scope, rename the boilerplate, replace dependencies, or spend real funds.

## 2. One Owner Per Topic

| Guide                                     | Owns                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| [README](README.md)                       | Reading workflow, repository map, placement decisions and adoption                 |
| [Code Style](code-style.md)               | Naming, types, imports, responsibility boundaries, reuse and clean-code review     |
| [Backend Standard](backend-standard.md)   | Express composition, request lifecycle, module layers and side effects             |
| [Frontend Standard](frontend-standard.md) | Next/React features, forms, API adapters, cache and usable UI                      |
| [API Contracts](api-contracts.md)         | Browser-safe request/response schemas, HTTP envelopes and contract compatibility   |
| [Data Patterns](data-patterns.md)         | Prisma/Postgres schema, selections, transactions, constraints and migrations       |
| [Security](security.md)                   | Authorization, credentials, financial/custody/file controls and residual risk      |
| [Testing](testing.md)                     | Test ownership, realistic fixtures, suite selection, failure evidence and commands |

Keep each detailed rule in its owner and link to it elsewhere. All eight files have
a distinct role; no additional design-system, operating-policy, rule registry or
architecture document is required for this MVP.

## 3. Verified Repository Map

| Existing Area                                                       | Owns                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/web/src/app/`                                                 | Next.js App Router pages/layouts and route composition                                 |
| `apps/web/src/features/auth/`, `features/users/`                    | Existing real session/account adapters and hooks                                       |
| `apps/web/src/features/employee/`, `features/admin/`                | Approved OSCAR screens and feature-local UI/state                                      |
| `apps/web/src/components/`                                          | Existing cross-feature auth, brand, form and workspace components                      |
| `apps/web/src/shared/forms/`, `shared/query/`                       | Form/error integration and shared QueryClient policy                                   |
| `apps/web/src/services/api/`                                        | Central Axios, credentials, refresh, CSRF and normalized transport errors              |
| `apps/web/src/config/`                                              | Validated public configuration; no backend secrets                                     |
| `apps/api/src/app.ts`, `router.ts`, `server.ts`                     | App construction, route/dependency composition and process lifecycle                   |
| `apps/api/src/modules/`                                             | Domain routes/controllers/services, DTO aliases, mappers and domain rules              |
| `apps/api/src/middlewares/`                                         | Reusable HTTP parsing, authentication, authorization and error handling                |
| `apps/api/src/core/`                                                | Existing config, errors, responses, pagination, date/serialization and request types   |
| `apps/api/src/infrastructure/`                                      | Database, email, logging, token/password and OpenAPI adapters                          |
| `packages/contracts/src/`                                           | `@template/contracts`: Zod schemas and inferred browser-safe wire types                |
| `packages/database/`                                                | `@template/database`: Prisma schema/migrations, client factory and persistence exports |
| `packages/typescript-config/`, `eslint-config/`, `prettier-config/` | Shared compiler/lint/format configuration                                              |
| `scripts/`, `compose.yaml`, `Caddyfile`                             | Existing build verification and local runtime/proxy configuration                      |

Preserve the package names and the pnpm/Turborepo workspace. Current stack families
are Node 24, pnpm 11, TypeScript 5.9, Next.js 16, React 19, Tailwind 4, Express 5,
Prisma 7/PostgreSQL, Zod 4 and Vitest 4. Manifests and the lockfile are authoritative;
do not adopt incompatible upstream examples or upgrade merely to match a guide.

The API currently wires auth/users/health/OpenAPI; the database currently contains
User/RefreshToken. Employee/admin fixture contexts do not establish financial truth.
TronWeb/TronGrid, custody, durable financial jobs, private proofs and production
deployment are implementation targets, not verified completed integrations.

## 4. Where New Code Belongs

| Responsibility                                   | Placement Decision                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| A page                                           | Thin App Router composition; substantial behavior in its feature                                         |
| Employee-only or admin-only reusable control     | That feature's existing `components/common/`                                                             |
| Stable control genuinely shared across audiences | `components/` under a meaningful owner; compose theme wrappers where needed                              |
| Form rules or a feature-only pure transformation | Feature-local `schemas/`, `types/` or `utils/`, matching adjacent files                                  |
| A network operation                              | Feature `api/` using the central transport                                                               |
| Query/mutation/cache lifecycle                   | Feature `hooks/`, not the component body or a second context store                                       |
| A browser-safe HTTP request/output shape         | `packages/contracts/src/<domain>/` and its intended exports                                              |
| Backend HTTP DTO                                 | Module `dto/` alias of the shared schema/type, not a duplicate                                           |
| Domain orchestration/permission/transaction      | Owning module service and focused module rules                                                           |
| Domain-specific safe error                       | Owning module; promote to `core/errors/` only when truly shared                                          |
| DB selection/output mapping                      | Module query/mapper when complexity or reuse justifies extraction                                        |
| Table, index or constraint                       | Database schema/migration, not a browser type or one-off startup query                                   |
| Provider SDK call                                | Protected infrastructure adapter; business policy remains in its service                                 |
| New financial/calendar helper                    | Owning module, or proposed `core/financial/` / `core/business-calendar/` for real cross-domain reuse     |
| New worker/signer entrypoint                     | Proposed private API runtime entrypoint with its own credentials/lifecycle; never a public signing route |
| Unit/behavior test                               | Existing colocated convention; database integration follows the database test tree                       |

These are responsibility decisions, not mandatory empty folders. A mapper or query
helper can remain local while simple; split it when responsibility, independent
testing, reuse, or readability warrants it. Do not force all employee and admin UI
through one giant generic component or move every utility into a global folder.

## 5. Task-Specific Reading

| Work                              | Read Deeply                                              |
| --------------------------------- | -------------------------------------------------------- |
| UI, form or query integration     | Frontend + contracts + applicable security/testing       |
| Backend command or endpoint       | Backend + contracts + data + security/testing            |
| Schema, money or concurrency      | Data + security + backend + contracts/testing            |
| Auth, shared transport or custody | Security + both affected layers + contracts/testing      |
| Refactor                          | Code style + owning layer + behavior/compatibility tests |
| Technical documentation           | Owning guide + actual source, using docs-guard           |

Read `apps/web/AGENTS.md` and `CLAUDE.md` and the relevant installed
`node_modules/next/dist/docs/` guidance before Next-dependent changes.
Use available skills for their applicable work: `clean-code-guard` for nontrivial
production changes; `vercel-react-best-practices` for React/Next; `test-guard`
for changed tests; `security-best-practices` for security-sensitive implementation;
`playwright` for browser verification; `docs-guard` for technical docs.
Do not claim a missing skill was read or replace source checks with its name.

## 6. Implementation and Review Gate

Before editing: read the active requirements, relevant source/callers, applicable
guides, and working-tree status. Choose a bounded task and identify its tests.
Use existing owners before adding another abstraction.

After editing: review the changed behavior and immediate dependencies against the
same guides. Check correctness, authority, contract compatibility, responsibility,
duplication, state/failure handling and relevant accessibility. Run focused checks
from [testing](testing.md). Include schema/shared/security regressions when affected.

Report changed files, applicable rules, actual commands/results and unresolved gaps.
A passing formatter is not a behavior or security review. Do not weaken tests,
invent execution evidence, bury high-risk findings, or claim guaranteed security.
No ceremonial review report file is required for every small edit.

## 7. Constitution Clause

This text can be incorporated into the owner's constitution. It is guidance to use,
not an automatically generated constitution or approval of existing code.

```text
Before planning, generating tasks, implementing, refactoring, or reviewing OSCAR,
read docs/engineering/README.md and use its reading map. Read all eight guides at
the start of each phase and revisit the applicable sections for each task batch.
Follow the existing apps/packages architecture, actual dependency versions and
approved business requirements. Use the guides both to write and to review code.
Keep backend/domain work complete and tested before integrating its frontend.
Apply relevant available skills and write/run realistic tests for affected behavior.
Preserve financial invariants, server authorization and protected custody.
Do not add speculative layers, duplicate contracts or authoritative browser fixtures.
Report concrete deviations, actual test results and unmet prerequisites honestly.
```
