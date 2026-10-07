"use client";

import { Image as ImageIcon, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface AdminImageUploadProps {
  readonly initialImageUrl?: string | undefined;
  readonly label?: string | undefined;
  readonly onImageSelected: (file: File | null) => void;
  readonly disabled?: boolean;
  readonly aspectHint?: string | undefined;
}

export function AdminImageUpload({
  initialImageUrl,
  label = "صورة المعاينة",
  onImageSelected,
  disabled = false,
  aspectHint = "PNG أو JPG أو WebP بحد أقصى 5 ميجابايت",
}: AdminImageUploadProps) {
  const [selectedPreview, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const previewUrl = selectedPreview ?? initialImageUrl;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    let current = true;
    queueMicrotask(() => {
      if (current) setPreviewUrl(url);
    });
    return () => {
      current = false;
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("حجم الملف يتجاوز الحد الأقصى المسموح به (5 ميجابايت).");
      return;
    }

    // Validate format
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage(
        "نوع الملف غير مدعوم. يرجى اختيار ملف PNG أو JPG أو WebP.",
      );
      return;
    }

    setErrorMessage(null);

    setSelectedFile(file);
    onImageSelected(file);
  };

  const handleRemove = () => {
    if (disabled) return;
    setSelectedFile(null);
    setPreviewUrl("");
    onImageSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700 sm:text-sm">
        {label}
      </label>

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="flex max-h-56 items-center justify-center overflow-hidden rounded-md bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="معاينة الصورة"
              className="max-h-52 w-full object-contain"
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
            <span className="text-[11px] text-slate-500">{aspectHint}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!disabled) fileInputRef.current?.click();
                }}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Upload size={13} aria-hidden="true" />
                <span>تغيير الصورة</span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={handleRemove}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                title="إزالة الصورة"
              >
                <X size={14} aria-hidden="true" />
                <span>إزالة</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            if (!disabled) fileInputRef.current?.click();
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center transition-colors hover:border-emerald-600 hover:bg-slate-50"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <ImageIcon size={20} aria-hidden="true" />
          </div>
          <p className="text-xs font-bold text-slate-700 sm:text-sm">
            انقر هنا لاختيار صورة من جهازك
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{aspectHint}</p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        disabled={disabled}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      {errorMessage && (
        <p className="text-xs font-medium text-rose-600">{errorMessage}</p>
      )}
    </div>
  );
}
