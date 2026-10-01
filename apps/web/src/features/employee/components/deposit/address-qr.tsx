"use client";

import { QRCodeSVG } from "qrcode.react";

interface AddressQRProps {
  readonly value: string;
  readonly size?: number | undefined;
}

export function AddressQR({ value, size = 180 }: AddressQRProps) {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={0}
        className="w-auto h-auto max-w-full"
      />
      <span className="text-[11px] text-slate-400 mt-2 font-medium">
        امسح الرمز بواسطة تطبيق المحفظة
      </span>
    </div>
  );
}
