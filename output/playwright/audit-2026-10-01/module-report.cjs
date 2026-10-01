const fs=require('node:fs');
const dir='output/playwright/audit-2026-10-01';
const data=JSON.parse(fs.readFileSync(dir+'/audit-evidence.json','utf8'));
const inventory=JSON.parse(fs.readFileSync(dir+'/source-inventory.json','utf8'));
const lineCount=file=>{const source=fs.readFileSync(file,'utf8');return source.split('\n').length-(source.endsWith('\n')?1:0);};
const modules=inventory.filter(f=>
  /features\/(?:admin|employee)\/context\/(?:actions\/|.*state\.types)/.test(f.path) ||
  /features\/admin\/fixtures\//.test(f.path) ||
  /features\/admin\/components\/employees\/employee-(?!(?:detail-screen|list-screen))/.test(f.path) ||
  /features\/admin\/components\/(?:referrals\/(?:referral-level|referral-commission-details)|withdrawals\/withdrawal-row|settings\/(?:add-admin-dialog|edit-admin-dialog))/.test(f.path) ||
  /features\/admin\/utils\/admin-records/.test(f.path) ||
  /shared\/hooks\/use-managed-timeout\.ts$/.test(f.path)
);
const responsibilities={
 'admin-state.types.ts':'Existing public admin API and narrow action dependency/setter contracts; transaction-size exception',
 'employee-state.types.ts':'Existing employee public API and focused dependency contracts',
 'admin-records.ts':'Original ID generation and local audit timestamp formatting',
 'use-task-code-actions.ts':'Code uniqueness/normalization, creation/status/access and use records',
 'use-task-actions.ts':'Task creation/edit/status and associated audit transitions',
 'use-submission-review-actions.ts':'Submission review/reversal with coordinated balance, usage, ledger and audit updates',
 'use-employee-account-actions.ts':'Balance/address/account archive actions and coordinated audit/ledger effects',
 'use-employee-restriction-actions.ts':'Independent account/task/withdrawal restrictions and audit records',
 'use-package-actions.ts':'Admin package configuration changes and audit',
 'use-deposit-actions.ts':'Validated manual credit with duplicate-reference guard and coordinated records',
 'use-withdrawal-actions.ts':'Hold/release/reject/complete/extend operations and existing financial/schedule semantics',
 'use-settings-actions.ts':'Preview settings/admin-account changes and audit',
 'use-employee-task-actions.ts':'Submission/reward/screenshot replacement actions against one employee owner',
 'use-employee-package-actions.ts':'Package upgrade and confirmed activation using existing calculation/ledger helpers',
 'use-employee-wallet-actions.ts':'Withdrawal request/process/cancel/reject and address changes',
 'employee-balance-dialog.tsx':'Controlled balance form markup and existing preview expressions',
 'employee-address-dialog.tsx':'Controlled address form markup',
 'employee-restriction-controls.tsx':'Restriction action bar and its three confirmation lifetimes',
 'referral-level.tsx':'Relative level expansion and descendant/path rows',
 'referral-commission-details.tsx':'Selected root/member commission details',
 'withdrawal-row.tsx':'One record’s financial snapshot/countdown/status/action rendering',
 'add-admin-dialog.tsx':'Controlled create-account form markup',
 'edit-admin-dialog.tsx':'Controlled edit-account form markup',
 'use-managed-timeout.ts':'Cross-feature scheduled callback tracking and unmount cleanup'
};
function responsibility(file){
 const name=file.split('/').at(-1);
 if(responsibilities[name])return responsibilities[name];
 if(name.endsWith('.fixtures.ts'))return name.replace('.fixtures.ts','')+' domain preview fixture exports; values retained';
 if(name.endsWith('-tab.tsx'))return name.replace('employee-','').replace('-tab.tsx','')+' tab rendering from screen-owned filtered data and typed callbacks';
 return 'See source contract';
}
fs.writeFileSync(dir+'/MODULES.md','# File sizes and extracted responsibilities\n\nPhysical line counts exclude a trailing empty line. Baseline source was captured before audit edits, including untracked admin code.\n\n## Major source files\n\n| Repository path | Before | After |\n| --- | ---: | ---: |\n'+data.leads.map(f=>`| \`${f.path}\` | ${f.before} | ${f.after??'replaced by domain files'} |`).join('\n')+'\n\n## Resulting modules\n\n| Repository path | Lines | Responsibility |\n| --- | ---: | --- |\n'+modules.map(f=>`| \`${f.path}\` | ${lineCount(f.path)} | ${responsibility(f.path)} |`).join('\n')+'\n\nRoute entries, root admin provider and employee subtree provider remain in their original locations. Screen owners retain selected record/form/filter state; action hooks receive narrow typed dependencies against those owners. No export barrel or extra state owner was introduced.\n');
console.log(modules.length+' resulting modules documented');
