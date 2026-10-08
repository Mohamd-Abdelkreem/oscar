"use client";

import { QRCodeSVG } from "qrcode.react";

interface AddressQRProps {
  readonly value: string;
  readonly size?: number | undefined;
}

export function AddressQR({ value, size = 180 }: AddressQRProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={0}
        className="h-auto w-auto max-w-full"
      />
      <span className="mt-2 text-[11px] font-medium text-slate-400">
        امسح الرمز بواسطة تطبيق المحفظة
      </span>
    </div>
  );
}
