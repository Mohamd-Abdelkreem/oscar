import { TaskFormScreen } from "@/features/admin/components/tasks/task-form-screen";

interface AdminTaskEditPageProps {
  readonly params: Promise<{ taskId: string }>;
}

export default async function AdminTaskEditPage({
  params,
}: AdminTaskEditPageProps) {
  const { taskId } = await params;
  return <TaskFormScreen taskId={taskId} isEdit />;
}
