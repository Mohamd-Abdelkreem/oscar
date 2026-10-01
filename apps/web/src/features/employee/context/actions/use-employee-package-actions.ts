"use client";
import { useCallback } from "react";
import { PACKAGES } from "../../fixtures/package.fixtures";
import type { PackageId } from "../../types/employee.types";
import { spendAvailable } from "../../utils/balance-transitions";
import {
  getRequiredDeposit,
  getUpgradeCost,
} from "../../utils/financial-calculations";
import { createPackageUpgradeTransaction } from "../../utils/ledger-transactions";
import type { EmployeeActionDependencies } from "../employee-state.types";

export function useEmployeePackageActions({
  balance,
  setBalance,
  setTask,
  setTransactions,
  setCurrentPackageId,
  currentPackageId,
  currentPackage,
}: Pick<
  EmployeeActionDependencies,
  | "balance"
  | "setBalance"
  | "setTask"
  | "setTransactions"
  | "setCurrentPackageId"
  | "currentPackageId"
  | "currentPackage"
>) {
  const upgradeToPackage = useCallback(
    (targetPackageId: PackageId): { success: boolean; message: string } => {
      const target = PACKAGES.find((p) => p.id === targetPackageId);
      if (!target) return { success: false, message: "المنصب غير موجود." };

      if (currentPackageId === targetPackageId) {
        return { success: false, message: "أنت مفعّل بالفعل في هذا المنصب." };
      }

      const currentPrice = currentPackage.price;
      const targetPrice = target.price;

      if (currentPackage.id !== "FREE" && targetPrice <= currentPrice) {
        return {
          success: false,
          message:
            "لا يمكن التراجع لمنصب أدنى. تقتصر الترقية على المناصب الأعلى فقط.",
        };
      }

      const upgradeCost = getUpgradeCost(currentPackage, target);

      if (balance.available < upgradeCost) {
        const requiredDeposit = getRequiredDeposit(
          upgradeCost,
          balance.available,
        );
        return {
          success: false,
          message:
            "الرصيد المتاح (" +
            balance.available.toFixed(2) +
            " USDT) غير كافٍ. يتطلب إيداع إضافي قدره " +
            requiredDeposit.toFixed(2) +
            " USDT.",
        };
      }

      setBalance((prev) => spendAvailable(prev, upgradeCost));

      setCurrentPackageId(targetPackageId);

      // Future unsubmitted tasks reflect the new position's daily reward
      setTask((prev) => {
        if (
          prev.status === "submitted" ||
          prev.status === "approved" ||
          prev.status === "rejected"
        ) {
          return prev;
        }
        return {
          ...prev,
          rewardAmount: target.dailyReward,
        };
      });

      const newTx = createPackageUpgradeTransaction(
        currentPackage,
        target,
        upgradeCost,
        new Date(),
      );

      setTransactions((prev) => [newTx, ...prev]);

      return {
        success: true,
        message: "تم تفعيل " + target.name + " بنجاح.",
      };
    },
    [
      balance.available,
      currentPackage,
      currentPackageId,
      setBalance,
      setTask,
      setTransactions,
      setCurrentPackageId,
    ],
  );
  return { upgradeToPackage };
}
