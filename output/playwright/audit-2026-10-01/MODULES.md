# File sizes and extracted responsibilities

Physical line counts exclude a trailing empty line. Baseline source was captured before audit edits, including untracked admin code.

## Major source files

| Repository path                                                               | Before |                    After |
| ----------------------------------------------------------------------------- | -----: | -----------------------: |
| `apps/web/src/features/admin/context/admin-state.context.tsx`                 |   1621 |                      310 |
| `apps/web/src/features/admin/fixtures/admin.fixtures.ts`                      |   1321 | replaced by domain files |
| `apps/web/src/features/admin/components/employees/employee-detail-screen.tsx` |   1142 |                      434 |
| `apps/web/src/features/admin/components/referrals/referrals-screen.tsx`       |    535 |                      351 |
| `apps/web/src/features/admin/components/withdrawals/withdrawals-screen.tsx`   |    532 |                      399 |
| `apps/web/src/features/admin/components/settings/admins-list-screen.tsx`      |    527 |                      451 |
| `apps/web/src/features/employee/context/employee-state.context.tsx`           |    521 |                      178 |
| `apps/web/src/features/admin/components/submissions/submissions-screen.tsx`   |    482 |                      536 |
| `apps/web/src/features/admin/components/finance/finance-ledger-screen.tsx`    |    411 |                      444 |
| `apps/web/src/features/admin/components/codes/code-detail-screen.tsx`         |    460 |                      492 |
| `apps/web/src/features/admin/components/tasks/task-form-screen.tsx`           |    403 |                      448 |
| `apps/web/src/features/admin/components/deposits/deposits-screen.tsx`         |    396 |                      446 |
| `apps/web/src/styles/globals.css`                                             |   1194 |                     1194 |

## Resulting modules

| Repository path                                                                      | Lines | Responsibility                                                                                      |
| ------------------------------------------------------------------------------------ | ----: | --------------------------------------------------------------------------------------------------- |
| `apps/web/src/features/admin/components/employees/employee-address-dialog.tsx`       |    87 | Controlled address form markup                                                                      |
| `apps/web/src/features/admin/components/employees/employee-audit-tab.tsx`            |    42 | audit tab rendering from screen-owned filtered data and typed callbacks                             |
| `apps/web/src/features/admin/components/employees/employee-balance-dialog.tsx`       |   161 | Controlled balance form markup and existing preview expressions                                     |
| `apps/web/src/features/admin/components/employees/employee-codes-tab.tsx`            |    78 | codes tab rendering from screen-owned filtered data and typed callbacks                             |
| `apps/web/src/features/admin/components/employees/employee-deposits-tab.tsx`         |    62 | deposits tab rendering from screen-owned filtered data and typed callbacks                          |
| `apps/web/src/features/admin/components/employees/employee-ledger-tab.tsx`           |    65 | ledger tab rendering from screen-owned filtered data and typed callbacks                            |
| `apps/web/src/features/admin/components/employees/employee-overview-tab.tsx`         |   105 | overview tab rendering from screen-owned filtered data and typed callbacks                          |
| `apps/web/src/features/admin/components/employees/employee-package-tab.tsx`          |    55 | package tab rendering from screen-owned filtered data and typed callbacks                           |
| `apps/web/src/features/admin/components/employees/employee-restriction-controls.tsx` |   229 | Restriction action bar and its three confirmation lifetimes                                         |
| `apps/web/src/features/admin/components/employees/employee-tasks-tab.tsx`            |    72 | tasks tab rendering from screen-owned filtered data and typed callbacks                             |
| `apps/web/src/features/admin/components/employees/employee-team-tab.tsx`             |    62 | team tab rendering from screen-owned filtered data and typed callbacks                              |
| `apps/web/src/features/admin/components/employees/employee-withdrawals-tab.tsx`      |    80 | withdrawals tab rendering from screen-owned filtered data and typed callbacks                       |
| `apps/web/src/features/admin/components/referrals/referral-commission-details.tsx`   |   162 | Selected root/member commission details                                                             |
| `apps/web/src/features/admin/components/referrals/referral-level.tsx`                |   153 | Relative level expansion and descendant/path rows                                                   |
| `apps/web/src/features/admin/components/settings/add-admin-dialog.tsx`               |   114 | Controlled create-account form markup                                                               |
| `apps/web/src/features/admin/components/settings/edit-admin-dialog.tsx`              |   107 | Controlled edit-account form markup                                                                 |
| `apps/web/src/features/admin/components/withdrawals/withdrawal-row.tsx`              |   213 | One record’s financial snapshot/countdown/status/action rendering                                   |
| `apps/web/src/features/admin/context/actions/use-deposit-actions.ts`                 |   138 | Validated manual credit with duplicate-reference guard and coordinated records                      |
| `apps/web/src/features/admin/context/actions/use-employee-account-actions.ts`        |   200 | Balance/address/account archive actions and coordinated audit/ledger effects                        |
| `apps/web/src/features/admin/context/actions/use-employee-restriction-actions.ts`    |   119 | Independent account/task/withdrawal restrictions and audit records                                  |
| `apps/web/src/features/admin/context/actions/use-package-actions.ts`                 |    35 | Admin package configuration changes and audit                                                       |
| `apps/web/src/features/admin/context/actions/use-settings-actions.ts`                |   184 | Preview settings/admin-account changes and audit                                                    |
| `apps/web/src/features/admin/context/actions/use-submission-review-actions.ts`       |   174 | Submission review/reversal with coordinated balance, usage, ledger and audit updates                |
| `apps/web/src/features/admin/context/actions/use-task-actions.ts`                    |    91 | Task creation/edit/status and associated audit transitions                                          |
| `apps/web/src/features/admin/context/actions/use-task-code-actions.ts`               |   259 | Code uniqueness/normalization, creation/status/access and use records                               |
| `apps/web/src/features/admin/context/actions/use-withdrawal-actions.ts`              |   330 | Hold/release/reject/complete/extend operations and existing financial/schedule semantics            |
| `apps/web/src/features/admin/context/admin-state.types.ts`                           |   182 | Existing public admin API and narrow action dependency/setter contracts; transaction-size exception |
| `apps/web/src/features/admin/fixtures/account.fixtures.ts`                           |    31 | account domain preview fixture exports; values retained                                             |
| `apps/web/src/features/admin/fixtures/audit.fixtures.ts`                             |    56 | audit domain preview fixture exports; values retained                                               |
| `apps/web/src/features/admin/fixtures/code.fixtures.ts`                              |    61 | code domain preview fixture exports; values retained                                                |
| `apps/web/src/features/admin/fixtures/deposit.fixtures.ts`                           |    46 | deposit domain preview fixture exports; values retained                                             |
| `apps/web/src/features/admin/fixtures/employee.fixtures.ts`                          |   341 | employee domain preview fixture exports; values retained                                            |
| `apps/web/src/features/admin/fixtures/finance.fixtures.ts`                           |   129 | finance domain preview fixture exports; values retained                                             |
| `apps/web/src/features/admin/fixtures/package.fixtures.ts`                           |    59 | package domain preview fixture exports; values retained                                             |
| `apps/web/src/features/admin/fixtures/referral.fixtures.ts`                          |   387 | referral domain preview fixture exports; values retained                                            |
| `apps/web/src/features/admin/fixtures/submission.fixtures.ts`                        |    59 | submission domain preview fixture exports; values retained                                          |
| `apps/web/src/features/admin/fixtures/task.fixtures.ts`                              |    40 | task domain preview fixture exports; values retained                                                |
| `apps/web/src/features/admin/fixtures/withdrawal.fixtures.ts`                        |   114 | withdrawal domain preview fixture exports; values retained                                          |
| `apps/web/src/features/admin/utils/admin-records.ts`                                 |    15 | Original ID generation and local audit timestamp formatting                                         |
| `apps/web/src/features/employee/context/actions/use-employee-package-actions.ts`     |   113 | Package upgrade and confirmed activation using existing calculation/ledger helpers                  |
| `apps/web/src/features/employee/context/actions/use-employee-task-actions.ts`        |    94 | Submission/reward/screenshot replacement actions against one employee owner                         |
| `apps/web/src/features/employee/context/actions/use-employee-wallet-actions.ts`      |   212 | Withdrawal request/process/cancel/reject and address changes                                        |
| `apps/web/src/features/employee/context/employee-state.types.ts`                     |    72 | Existing employee public API and focused dependency contracts                                       |
| `apps/web/src/shared/hooks/use-managed-timeout.ts`                                   |    23 | Cross-feature scheduled callback tracking and unmount cleanup                                       |

Route entries, root admin provider and employee subtree provider remain in their original locations. Screen owners retain selected record/form/filter state; action hooks receive narrow typed dependencies against those owners. No export barrel or extra state owner was introduced.
