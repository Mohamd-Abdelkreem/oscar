# OSCAR Frontend Standard

Use this standard before implementing a frontend task and during review. Apply the
sections touched by the change; they do not create new product features. The
approved OSCAR roadmap defines business behavior and phase gates. Read the
[ownership guide](README.md), [contracts](api-contracts.md),
[security rules](security.md), [data rules](data-patterns.md),
[code style](code-style.md), and [testing standard](testing.md) as applicable.

## 1. Verified Baseline and Migration Boundary

Verified on October 2, 2026. Full paths are repository-relative; shorter feature,
component, shared, service, config, and app paths are under `apps/web/src/`.
Requirements below describe the integration target, not already completed work.
Package manifests, the lockfile, and installed metadata agree on this baseline:

| Responsibility             | Installed Package and Version                                       |
| -------------------------- | ------------------------------------------------------------------- |
| Framework and UI           | Next.js 16.2.12; React/React DOM 19.2.8                             |
| Styling                    | Tailwind CSS and its PostCSS plugin 4.3.3; @fontsource/cairo 5.3.0  |
| Server state and transport | TanStack React Query 5.101.4; Axios 1.19.0                          |
| Forms and validation       | React Hook Form 7.84.0; resolvers 5.7.1; Zod 4.4.3                  |
| Icons and interaction      | Lucide React 1.49.0; Radix Select 2.3.7; Radix Dropdown Menu 2.1.24 |
| QR presentation            | qrcode.react 4.2.0                                                  |

Preserve Node 24, pnpm 11, the lockfile, and the existing stack. `apps/web/next.config.ts`
already enables `typedRoutes` and `reactCompiler`, and transpiles
`@template/contracts`. `apps/web/AGENTS.md` requires reading relevant installed
guides in `apps/web/node_modules/next/dist/docs/`; `apps/web/CLAUDE.md` delegates to it.
Do this before version-dependent edits, rather than importing older Next patterns.

The following are current implementation facts, not proof of production readiness:

| Existing Location                                          | Current State and Required Integration                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/features/auth/` and `features/users/`        | Real shared auth/account adapters and hooks exist. Reuse and extend them.                                                           |
| `apps/web/src/features/employee/` and `features/admin/`    | Approved screens substantially depend on fixtures and local actions. Preserve their visual design while integrating real contracts. |
| `apps/web/src/app/providers.tsx`                           | Owns a stable QueryClient and globally mounts `AdminStateProvider`. Remove the fixture provider after migrating its consumers.      |
| `apps/web/src/app/employee/layout.tsx`                     | Mounts `EmployeeStateProvider`; this fixture state is not authenticated identity or wallet authority.                               |
| `apps/web/src/app/admin/layout.tsx`                        | Wraps the subtree in `AdminShell`; it currently does not enforce shared session access.                                             |
| `apps/web/src/features/admin/constants/admin.constants.ts` | Contains `CURRENT_ADMIN` and demo settings. Neither may supply a real audit actor, permission, balance, or saved operation term.    |

Connect each domain only after its backend, shared contracts, and required tests
pass the roadmap gate. A timer, fixture reducer, or simulated success must never
authorize access, credit a balance, approve a reward, or complete a withdrawal.
Keep fixtures isolated for tests and explicitly separate demonstrations; production
API failures must not fall back to them. Migrated production screens retain only
input, filter, dialog, preview, and other transient interaction state locally.

## 2. Ownership and Dependency Direction

The browser integration path is:

```text
App Router page/layout -> feature screen -> domain query/command hook
    -> feature API adapter -> services/api/api-client.ts -> Express API
```

| Location Under `apps/web/src/`                    | Responsibility                                                                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                                            | Route composition, layouts, metadata, and framework loading/error boundaries.                                                                                        |
| `features/<domain>/components/`                   | Domain presentation and transient interaction.                                                                                                                       |
| `features/<domain>/api/` and `hooks/`             | Validated API adapters, query keys, command lifecycle, and scoped reconciliation. Create them when integrating that domain.                                          |
| Feature `types/`, `utils/`, or a focused `model/` | Pure presentation types, normalization, draft/conflict decisions, and reusable domain logic. Preserve established paths; add folders only for real responsibilities. |
| `components/`                                     | Components reused across feature boundaries, including existing auth, form, and workspace components.                                                                |
| `shared/forms/`, `shared/query/`, `shared/hooks/` | Cross-feature form helpers, query policy, and hooks.                                                                                                                 |
| `services/api/` and `config/`                     | Central transport/session handling and validated public configuration.                                                                                               |
| `packages/contracts/src/`                         | Public request/response schemas and inferred DTOs shared with the API.                                                                                               |

Keep employee-only controls in `features/employee/components/common/` and admin-only
controls in `features/admin/components/common/`. Promote a component to `components/`
when it has actual cross-feature consumers and a stable common contract. Similar
appearance alone does not justify a universal form or one configurable screen.
Pure feature logic must not import components. UI-only callback types stay with
their component; wire DTOs come from `@template/contracts`.

TanStack Query owns server state. React Hook Form owns form input; React state owns
local interaction. Do not mirror balances, users, subscriptions, or API lists into
a global context/store. Components must not call Axios directly. Do not add React
Router, SWR, another QueryClient provider, another Axios instance, or a separate
token/refresh stack to integrate an OSCAR domain.

## 3. Next.js Server and Client Boundaries

Keep route files thin, using the existing pattern of a Server Component page that
renders a feature screen. Pages and layouts are Server Components by default.
Declare `"use client"` at a deliberate boundary for state, event handlers, Query
hooks, forms, or browser APIs; its imports enter the client graph. Server-rendered
children can still be passed through a client provider or shell.

Choose a boundary by responsibility. Do not mark every page client-only, force
interactive workflows onto the server, or convert the existing Axios/Query flow
to Server Actions during an unrelated integration. Express remains the business
authority. A future server data path must have explicit request-local authority
and contracts; do not import the browser transport's mutable access-token owner
into server requests or share a user-specific QueryClient between server renders.
Never import database, custody, worker, signer, or private configuration modules
into the client graph, or serialize their secrets into client props.

Use `next/link` for navigation and `next/navigation` for App Router hooks. Preserve
typed route checking; arbitrary casts must not hide invalid destinations. Await
promise-valued page `params` and `searchParams` in server pages. The existing
`app/admin/employees/[employeeId]/page.tsx` demonstrates awaited `params`.
For a statically rendered route using client `useSearchParams`, provide the
required Suspense boundary; development behavior alone does not verify the build.
Use route groups to separate layout responsibilities without changing URLs.

Use route loading/error files for framework-level work and Query/form states for
client requests. The root loading boundary cannot replace a wallet request's
loading/error UI. Keep hydration deterministic: do not read browser storage,
random values, or client-local time during server rendering to choose authoritative
content. Browser resources belong in events or effects with cleanup.

## 4. Shared Authentication and Route Access

Integrate employee auth screens with `features/auth/api/auth.api.ts`,
`features/auth/hooks/auth.hooks.ts`, the existing account schemas, and the central
transport. The current employee login screen uses a simulated timeout; replace
that behavior with real login and current account loading, retaining its approved
Arabic presentation. Do not treat navigation to `/employee` as successful login.

The required `/admin/auth/login` route is **planned and absent at this baseline**.
Add a dedicated email/password screen using shared authentication/password/session
services, with current server-enforced `ADMIN` role and active-account checks.
Keep it outside the protected dashboard shell through an intentional layout
boundary: adding a page beneath the current admin layout would inherit `AdminShell`.
There is no public admin signup, client-selected role, Google OAuth, registration
OTP, admin 2FA, or second-admin approval requirement. Additional admins follow the
protected invitation flow defined by the contracts and roadmap.

Adapt `components/auth/protected-route.tsx`, `guest-only-route.tsx`,
`features/auth/utils/safe-return-path.ts`, and central session navigation together.
Their current defaults target generic `/auth/*` and `/dashboard`, and the return
path allowlist currently covers `/dashboard` and `/settings`. OSCAR destinations
must become role-aware without weakening internal-path and credential-query checks.
Use the authenticated account response, never fixture identity, to choose access
and destinations. A session request failure is a retryable error view when relevant,
not proof of an anonymous or authorized session. While checking access, do not
render privileged content or start its queries.

Client guards prevent stale disclosure and inappropriate interaction; every server
request still enforces authorization. On session termination or identity change,
cancel/clear private client state and old work so another account cannot inherit it.
See [security](security.md) for credential, cookie, link, and authorization rules.

## 5. Contracts, Validation, and Transport

Use request schemas and inferred input/output types from `@template/contracts`.
Add approved domain response schemas there before connecting their screens. In
feature adapters, receive untrusted response bodies as `unknown`, parse the envelope
and domain payload once, and return the validated DTO. Axios generic types are not
runtime validation. The current `auth.api.ts` and `users.api.ts` rely on generics;
runtime parsing is required integration work, not an existing guarantee.

Preserve the central base URL, memory-only access-token owner, single-flight
refresh, cookies, CSRF handling, and error boundary. `NEXT_PUBLIC_API_URL` is
validated in `config/public-environment.ts`; it is public configuration, not a
place for provider credentials or custody secrets. Follow the deployment contract
for same-origin API routing. Do not construct transport URLs in components.

Pass Query's `AbortSignal` through read adapters to Axios. Cancellation must not
be presented as a network failure or access denial. Scope requests and completion
handlers to the account/resource they started for; an obsolete response cannot
update a newly opened employee, task, code, or form.

Project errors must reach Query/Mutation caches as bounded safe projections,
without raw Axios config, headers, request bodies, URLs, stacks, or private backend
details. Reuse/enhance the central `getApiError` owner rather than creating competing
error stacks. It currently retains server messages/field errors and does not
sanitize errors before cache storage. Map approved codes to Arabic copy and allow
only the current form's safe field errors. If changing this boundary, adapt
`shouldRetryRequest` in `shared/query/query-client.ts` at the same time: its current
read policy recognizes raw Axios errors. Contract/parse failures must not masquerade
as successful empty responses or endlessly retryable network errors.

## 6. Query Ownership, Lists, and Freshness

Keep the stable QueryClient owned by `AppProviders`. Define feature keys containing
all result inputs: non-secret session/account scope, resource ID, normalized
filters, sort, and pagination. Never put passwords or verification/reset/invitation
tokens into keys or metadata. The current `useValidateResetToken` includes its
token in a query key; remove that exposure as part of auth integration. Use bounded
transient ownership for credential checks rather than persisting them in caches.

The current central read policy uses 30 seconds of stale time and at most two
retries for selected transport/server failures; mutations use `retry: false`.
Keep read retries bounded and override freshness/retry only where the contract
requires it. Freshness does not grant authorization or financial eligibility.
An action using a stale quote/detail must still satisfy server validation.

Integrate live employee/admin histories and admin lists with backend pagination,
search, filtering, and deterministic sorting. Reset the page when filters change. Distinguish
empty, filtered-empty, unavailable, and failed results. Clamp an out-of-range page
only from a settled authoritative response for that same list scope; expose a way
back. Do not fetch an unbounded financial/audit dataset for local pagination.
Previous-page placeholders must never be shown as a different resource's detail
or used to enable its protected actions.

Each mutation identifies affected list/detail/summary/history keys. Invalidate or
patch those scopes from validated server results; incomplete responses require
refetching, not invented fields. Preserve independent history when current entities
or settings change. Broad `queryClient.clear()` belongs to actual session teardown,
not ordinary saves. Other browser sessions have independent caches: use suitable
focus refetch, manual refresh, or bounded polling for pending server operations,
and stop polling at terminal states. Do not add subscriptions without a real need.

## 7. Financial Commands and Truthful State

Balances, available/reserved/source-eligible funds, package terms, reward approval,
fees, deadlines, destination snapshots, chain outcomes, and audit actor/time are
server-authoritative. Do not promote local arithmetic or fixture transitions into
financial truth. Present pending task rewards separately from available funds.
Amounts on the wire follow the exact decimal-string contract; retain amount input
as text and avoid floating-point conversion for authoritative money calculations.
Adapt the current number-based `MoneyAmount` and demo calculators during their
domain integration. Display precision must not alter the command amount or hide
meaningful precision in a confirmation; see [data rules](data-patterns.md).

Use a server quote/current eligibility response where the contract provides one.
Confirm the actual gross/fee/net, package price/terms, destination, or affected
record before submission. Material admin mutations require confirmation; financial,
address, and account actions also require a reason where specified. Recheck current
eligibility after async validation and inside the command handler, not only in the
button's disabled state.

Do not optimistically purchase a package, adjust balances, reserve/release funds,
approve a reward, reject a payout, or mark a deposit/withdrawal complete. Keep
`retry: false` for financial mutations; no automatic offline replay or hidden
resubmission. A command hook owns an in-flight guard across all callers until the
request settles. Reset/closing a dialog cannot unlock pending work. Local duplicate
prevention supplements server idempotency and concurrency protection.

A lost response, timeout, navigation, or cancelled local observation does not prove
a command failed. Show the unknown/pending outcome, reconcile the existing operation
through the API, and prevent a second financial attempt until the contract permits
it. Review central 401 refresh replay against server rejection semantics: only an
authentication rejection guaranteed to precede execution may justify that controlled
replay. Do not add a feature-level retry to compensate for uncertainty.

A countdown is a display derived from a server deadline/time, not a scheduler.
The browser cannot declare dispatch, refund, task availability, or deposit finality.
Opening/copying a deposit address or QR does not credit funds; an external task link
does not prove execution. Use the approved Baghdad calendar and returned statuses.
Remove obsolete fixture copy such as a 24-hour withdrawal cooldown or admin payout
approval when the applicable roadmap integration replaces it.

## 8. Forms, Dirty Drafts, and Access Changes

Use React Hook Form with shared Zod schemas and `shared/forms/form.ts` helpers when
their contracts fit. Preserve distinct schema input/output types for preprocessing
and transformations. Login validation uses the login schema rather than applying
new-password creation rules to an existing password. Client validation supplies
feedback; server validation decides acceptance.

Associate labels, hints, and errors with their inputs, using `FormField` where
appropriate and feature controls where the approved design differs. Set native
types and autocomplete deliberately. Field errors map only to known editable
paths; response-only identity, balances, roles, fee terms, and actor fields must
not become writable merely because they appear in a DTO.

Initialize a detail form after its first authoritative detail read. A list row is
not sufficient to enable protected Save/Delete. A refresh may update pristine
editable fields; it must preserve a dirty draft. If those fields changed remotely,
show an explicit conflict choice. Continuing the draft still respects the server's
current command/version contract. Unrelated status/history updates must not reset
input. If a bound changes, preserve the invalid selection visibly and validate it
rather than silently changing the user's choice.

Keep an open editor through transient parent refresh errors. Disable writes that
need fresh eligibility and provide retry without destroying the draft. Confirmed
access denial hides protected content and blocks handlers; old responses, cache
writes, mutation success, or dialog reset cannot restore access. Recovery requires
a newer authoritative allowed read for the same account, authority, parent, and
resource. Use a focused scoped owner when that lifecycle needs one; do not copy a
generic global denial framework into every screen.

Passwords and one-time tokens need short-lived input ownership outside retained
mutation variables/data/errors. Clean them on completion and scope teardown;
`gcTime: 0` and `reset()` are cleanup aids, not sufficient isolation. Existing auth
hooks expose sensitive mutation variables, so their wrappers require adaptation.
Ordinary safe command fields need no special secret wrapper solely because they
are sent in a request. Follow [security](security.md) for the approved link protocol.

## 9. Approved Arabic UI and Accessibility

Preserve the existing route screens, section order, typography, colors, imagery,
spacing, and responsive behavior while integrating them. Apply the smallest local
changes needed for truthful states and accessible feedback. A required new screen,
including admin login, matches an identified existing peer. Do not recreate pages
or redesign the product as incidental backend integration work.

The employee experience is Arabic-only, RTL, Cairo, light, and mobile-first with
the existing bottom navigation. The admin experience remains a normal responsive
dashboard, usable on phones and desktop. Preserve `employee.css` and `admin.css`
scoping, zero letter spacing, existing font weights, and no-gradient presentation.
Keep amount/address/email/code/hash runs directionally isolated with `bdi` or
`dir="ltr"`. Use logical alignment/spacing when practical; do not mirror meaningful
asset content or numbers indiscriminately.

Reuse the employee `Button`/`ConfirmationSheet`, admin `AdminButton`/
`AdminConfirmDialog`/`AdminSelect`, and existing menu/table primitives. Radix Select
and Dropdown Menu are installed; **Radix Dialog is not**. Existing sheets/dialogs
are custom implementations, so reuse does not certify accessibility. Improve their
shared implementation when needed rather than reproducing focus/keyboard code
in each feature. Verify focus containment, initial focus, Escape/dismiss behavior,
pending-command handling, background interaction blocking, unique IDs, and focus
restoration. The current employee sheet lacks focus trapping.

Use real buttons for commands and links for navigation. Use Lucide icons, mark
decorative icons hidden from assistive technology, and give icon-only controls an
Arabic accessible name and an understandable tooltip when needed. Keep icon/text
inline, touch targets practical (existing core controls are generally 44-48px),
focus visible, and disabled controls truly guarded. Give selects a meaningful
label; preserve Radix keyboard behavior and portal RTL/Cairo styling. A status
must have text, not just color or an icon. Use `role="alert"` for actionable errors
and `role="status"` for suitable progress/success feedback.

Check narrow 320px flows and representative 390/430px phones plus desktop. Avoid
page-level overflow, clipped Arabic/buttons, hidden bottom-nav content, overlapping
fields, and off-screen dialog actions. Confine wide-table scrolling to its intended
region. Keep long addresses inspectable/copyable. Preserve image dimensions/aspect
ratios and meaningful alt text; prefer Next's image handling when it fits the asset
and protected-image contract. Private proof images are authorized API resources,
not files placed in `public/` or assumed safe for public image caching.

## 10. Effects, Performance, and Resource Cleanup

Derive inexpensive values during render; do not copy query results into state or
chain effects to compute labels, totals, or filtered views. User commands belong
in explicit event handlers. Effects synchronize external resources or an actual
form lifecycle; their cleanup must handle listeners, timers, object URLs, and
obsolete completions, including remounts. Reuse `use-managed-timeout.ts` for suitable
UI timers, never to simulate financial confirmation.

React Compiler is enabled. Add `memo`, `useMemo`, or `useCallback` for a measured
cost or a required stable integration identity, not to every expression or handler.
Keep expensive dependencies out of broad client imports. Use dynamic loading for
a genuinely heavy optional UI, and parallelize independent reads only after access
is established; preserve real dependencies. Do not install SWR, an LRU user cache,
or hydration scripts merely because an upstream performance example uses them.

Use Tailwind 4's existing CSS/PostCSS setup. Map variants to complete utility
strings so the scanner can find them; do not interpolate fragments of utility
class names or introduce Tailwind 3 configuration conventions. Preserve existing
reduced-motion behavior and stable control dimensions. Optimize demonstrated
interaction/bundle problems without changing approved behavior.

## 11. Implementation and Review Checklist

- Confirm the domain's backend/contract gate and identify the existing route,
  screen, style, shared helper, and visual peer before editing.
- Keep Next 16 boundaries/navigation correct and use one auth, transport, and Query
  stack. Protect dashboard content and queries with current shared session state.
- Parse wire data at the adapter, keep keys non-secret and correctly scoped, and
  project safe errors before caching. Preserve bounded read retry behavior.
- Keep money and identity server-authoritative. No fixture fallback, optimistic
  financial success, automatic financial retry, or invented audit actor.
- Cover applicable loading, refresh, empty, filtered-empty, error/retry, pending,
  success, conflict, restricted, and stale-known states without fabricating zeros.
- Preserve dirty input, isolate resource/session changes, and prevent duplicate or
  obsolete completions in handlers as well as controls.
- Verify Arabic RTL/Cairo, phone and desktop layout, keyboard/focus behavior,
  labels, mixed-direction content, private media, and pending confirmations.
- Run the focused checks and browser evidence required by [testing](testing.md).
  Apply the applicable code, React, test, security, and docs review skills. Report
  actual results and unperformed checks; do not claim real-money readiness from UI
  or fixture tests. Do not invent a `test:e2e` script before it is configured.

## 12. Framework References

Use the installed Next documentation as the version-matched source for
server/client components, page props, route groups, `useSearchParams`, typed routes,
and React Compiler. For library behavior, consult the primary references and
confirm compatibility with the locked version:

- [React: effects and derived state](https://react.dev/learn/you-might-not-need-an-effect).
- [TanStack Query: cancellation and Axios signals](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
- [TanStack Query: mutation promises and retries](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).
- [Tailwind: complete class detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

These references explain library behavior; the OSCAR requirements above decide
which capabilities are appropriate. They do not authorize new product features.
