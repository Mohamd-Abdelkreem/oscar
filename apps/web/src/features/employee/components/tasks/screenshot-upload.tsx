"use client";

import { AlertCircle, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ScreenshotUploadProps {
  readonly onFileSelected: (file: File | null) => void;
  readonly initialPreview?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export function ScreenshotUpload({
  onFileSelected,
  initialPreview,
  disabled = false,
}: ScreenshotUploadProps) {
  const [selectedPreview, setPreview] = useState<string | null>(null);
  const preview = selectedPreview ?? initialPreview ?? null;
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeObjectUrlRef = useRef<string | null>(null);

  // Clean up any generated object URL on unmount
  useEffect(() => {
    return () => {
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
      }
    };
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);

      // Validate type
      if (
        disabled ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        setError("يرجى اختيار ملف صورة صالح (PNG أو JPG أو WebP).");
        return;
      }

      // Validate size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("حجم الصورة يتجاوز الحد المسموح به (5 ميجابايت).");
        return;
      }

      // Revoke previous object URL
      if (activeObjectUrlRef.current) {
        URL.revokeObjectURL(activeObjectUrlRef.current);
      }

      const objectUrl = URL.createObjectURL(file);
      activeObjectUrlRef.current = objectUrl;
      setPreview(objectUrl);
      onFileSelected(file);
    },
    [onFileSelected, disabled],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClear = () => {
    if (disabled) return;
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onFileSelected(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800">
        لقطة شاشة إثبات التنفيذ (Screenshot){" "}
        <span className="text-rose-600">*</span>
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        id="task-screenshot-input"
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="معاينة لقطة الشاشة المرفوعة"
            className="max-h-56 w-full rounded border border-slate-100 bg-white object-contain"
          />
          {!disabled && (
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <ImageIcon size={14} aria-hidden="true" />
                تم اختيار الصورة بنجاح
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="flex min-h-[44px] items-center gap-1 rounded px-2.5 py-1.5 font-medium text-rose-600 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-rose-600"
              >
                <Trash2 size={16} aria-hidden="true" />
                <span>إلغاء الصورة</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          htmlFor="task-screenshot-input"
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
              : "border-slate-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/20"
          }`}
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Upload size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            اضغط لاختيار لقطة الشاشة
          </p>
          <p className="mt-1 text-xs text-slate-500">
            صيغ الملفات المقبولة: PNG, JPG, WebP (بحد أقصى 5 ميجابايت)
          </p>
        </label>
      )}

      {error && (
        <p
          className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
          role="alert"
        >
          <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
