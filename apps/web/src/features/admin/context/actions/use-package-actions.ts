"use client";

import { useCallback } from "react";
import type { PackageId } from "@/features/employee/types/employee.types";
import type { AdminPackage } from "../../types/admin.types";
import type { AdminActionDependencies } from "../admin-state.types";

export function usePackageActions({
  packages,
  setPackages,
  addAuditLog,
}: Pick<AdminActionDependencies, "packages" | "setPackages" | "addAuditLog">) {
  const updatePackage = useCallback(
    (packageId: PackageId, updates: Partial<AdminPackage>) => {
      const target = packages.find((p) => p.id === packageId);
      if (!target) return;

      setPackages((prev) =>
        prev.map((p) => (p.id === packageId ? { ...p, ...updates } : p)),
      );

      addAuditLog({
        action: "تعديل بيانات المنصب/الباقة",
        targetType: "package",
        targetId: packageId,
        targetTitle: target.name,
        previousState: JSON.stringify(target),
        newState: JSON.stringify({ ...target, ...updates }),
        reason: "تعديل إعدادات المنصب التشغيلي",
      });
    },
    [addAuditLog, packages, setPackages],
  );
  return { updatePackage };
}
