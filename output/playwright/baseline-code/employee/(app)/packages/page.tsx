"use client";

import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { PackageCard } from "@/features/employee/components/packages/package-card";
import { PackageUpgradeModal } from "@/features/employee/components/packages/package-upgrade-modal";
import { useEmployeeState } from "@/features/employee/context/employee-state.context";
import { PACKAGES } from "@/features/employee/fixtures/employee.fixtures";
import type { PackageTier } from "@/features/employee/types/employee.types";

export default function EmployeePackagesPage() {
  const { currentPackage, packageExpiryDays } = useEmployeeState();
  const [selectedTarget, setSelectedTarget] = useState<PackageTier | null>(null);

  // The 5 official paid positions: S1, S2, O1, O2, A1 (FREE is internal fallback state only)
  const paidPositions = PACKAGES.filter((pkg) => pkg.id !== "FREE");

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="المناصب والباقات"
        subtitle="اختر المنصب المناسب لتفعيل المهام اليومية ومضاعفة العوائد"
      />

      <div className="p-4 sm:p-5 space-y-4">
        {paidPositions.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            isCurrent={pkg.id === currentPackage.id}
            currentPrice={currentPackage.price}
            daysRemaining={pkg.id === currentPackage.id ? packageExpiryDays : undefined}
            onSelectUpgrade={(target) => {
              setSelectedTarget(target);
            }}
          />
        ))}
      </div>

      <PackageUpgradeModal
        targetPackage={selectedTarget}
        onClose={() => {
          setSelectedTarget(null);
        }}
      />
    </div>
  );
}
