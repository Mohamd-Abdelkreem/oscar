import { CodeDetailScreen } from "@/features/admin/components/codes/code-detail-screen";

interface AdminCodeDetailPageProps {
  readonly params: Promise<{ codeId: string }>;
}

export default async function AdminCodeDetailPage({
  params,
}: AdminCodeDetailPageProps) {
  const { codeId } = await params;
  return <CodeDetailScreen codeId={codeId} />;
}
