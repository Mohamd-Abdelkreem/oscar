"use client";
import { usePrivateProof } from "@/features/proofs/hooks/use-private-proof";

export function PrivateTaskImage({
  assetId,
  identity,
  purpose = "PROOF",
  className,
  alt,
}: {
  readonly assetId: string | null;
  readonly identity: string;
  readonly purpose?: "PROOF" | "TASK_ILLUSTRATION";
  readonly className: string;
  readonly alt: string;
}) {
  const preview = usePrivateProof({
    purpose,
    assetId,
    evidenceIdentity: identity,
    role: "ADMIN",
    open: true,
  });
  if (preview.url)
    // Authenticated transient URLs must bypass the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={preview.url} alt={alt} className={className} />;
  return (
    <span role="status" className="text-[11px] text-slate-500">
      {preview.availability === "REMOVED"
        ? "حُذفت الصورة بعد مدة الاحتفاظ"
        : preview.error || preview.availability === "STORAGE_UNAVAILABLE"
          ? "الصورة غير متاحة حالياً"
          : assetId
            ? "جارٍ تحميل الصورة..."
            : "لا توجد صورة"}
    </span>
  );
}
