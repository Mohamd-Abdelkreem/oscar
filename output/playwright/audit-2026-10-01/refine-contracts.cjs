const fs = require('node:fs');
const root = 'apps/web/src/features/employee';
for (const file of fs.readdirSync(root, {recursive:true}).filter(f => /\.tsx?$/.test(f))) {
  const path = root + '/' + file;
  const source = fs.readFileSync(path, 'utf8');
  const updated = source.replaceAll('@/features/employee/hooks/use-managed-timeout', '@/shared/hooks/use-managed-timeout').replaceAll('from "./use-managed-timeout"', 'from "@/shared/hooks/use-managed-timeout"');
  if (updated !== source) fs.writeFileSync(path, updated);
}
function update(file, transform) {
  fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
}
const admin = 'apps/web/src/features/admin/';
update(admin+'components/common/admin-button.tsx', s => s.replace('import Link', 'import type { Route } from "next";\nimport Link').replace('readonly href: string;', 'readonly href: Route;').replace('props.href as never', 'props.href'));
update(admin+'components/common/admin-breadcrumbs.tsx', s => s.replace('readonly href?: string;', 'readonly href?: Route;').replace('item.href as Route', 'item.href'));
update(admin+'constants/admin.constants.ts', s => 'import type { Route } from "next";\n'+s.replace('readonly href: string;', 'readonly href: Route;'));
update(admin+'components/common/admin-sidebar.tsx', s => s.replace('item.href as never', 'item.href'));
update(admin+'components/employees/employee-detail-screen.tsx', s => s.replace(/  \/\/ Restriction and Status Confirmation Dialogs\n\s+/, '').replace(/\n      \{\/\* (Account Status Toggle|Task Restriction|Withdrawal Restriction) Confirmation Dialog \*\/\}\n\s+/g, '\n'));
