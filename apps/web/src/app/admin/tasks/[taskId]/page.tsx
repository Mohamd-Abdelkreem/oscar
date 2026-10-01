import { TaskDetailScreen } from "@/features/admin/components/tasks/task-detail-screen";

interface AdminTaskDetailPageProps {
  readonly params: Promise<{ taskId: string }>;
}

export default async function AdminTaskDetailPage({
  params,
}: AdminTaskDetailPageProps) {
  const { taskId } = await params;
  return <TaskDetailScreen taskId={taskId} />;
}
