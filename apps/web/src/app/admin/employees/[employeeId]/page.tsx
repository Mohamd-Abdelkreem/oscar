import { EmployeeDetailScreen } from "@/features/admin/components/employees/employee-detail-screen";

interface AdminEmployeeDetailPageProps {
  readonly params: Promise<{ employeeId: string }>;
}

export default async function AdminEmployeeDetailPage({
  params,
}: AdminEmployeeDetailPageProps) {
  const { employeeId } = await params;
  return <EmployeeDetailScreen employeeId={employeeId} />;
}
