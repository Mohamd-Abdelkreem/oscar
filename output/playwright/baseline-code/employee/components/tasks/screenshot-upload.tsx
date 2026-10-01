"use client";

import { AlertCircle, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ScreenshotUploadProps {
  readonly onFileSelected: (previewUrl: string) => void;
  readonly initialPreview?: string | undefined;
  readonly disabled?: boolean | undefined;
}

export function ScreenshotUpload({
  onFileSelected,
  initialPreview,
  disabled = false,
}: ScreenshotUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null);
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
      if (!file.type.startsWith("image/")) {
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
      onFileSelected(objectUrl);
    },
    [onFileSelected],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClear = () => {
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onFileSelected("");
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800">
        لقطة شاشة إثبات التنفيذ (Screenshot) <span className="text-rose-600">*</span>
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
        <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-900/5 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="معاينة لقطة الشاشة المرفوعة"
            className="w-full max-h-56 object-contain rounded bg-white border border-slate-100"
          />
          {!disabled && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 text-xs">
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <ImageIcon size={14} aria-hidden="true" />
                تم اختيار الصورة بنجاح
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-medium px-2.5 py-1.5 min-h-[44px] rounded focus-visible:outline-2 focus-visible:outline-rose-600"
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
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            disabled
              ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-60"
              : "bg-white border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20"
          }`}
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-500 mb-2">
            <Upload size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            اضغط لاختيار لقطة الشاشة
          </p>
          <p className="text-xs text-slate-500 mt-1">
            صيغ الملفات المقبولة: PNG, JPG, WebP (بحد أقصى 5 ميجابايت)
          </p>
        </label>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-600 font-medium" role="alert">
          <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
