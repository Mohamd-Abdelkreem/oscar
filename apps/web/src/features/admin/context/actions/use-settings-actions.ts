"use client";

import { useCallback } from "react";
import type {
  AdminAccount,
  AdminSystemSettings,
} from "../../types/admin.types";
import { CURRENT_ADMIN } from "../../constants/admin.constants";
import { generateId, getNowTimestamp } from "../../utils/admin-records";
import type { AdminActionDependencies } from "../admin-state.types";

export function useSettingsActions({
  settings,
  admins,
  setSettings,
  setAdmins,
  addAuditLog,
}: Pick<
  AdminActionDependencies,
  "settings" | "admins" | "setSettings" | "setAdmins" | "addAuditLog"
>) {
  const updateSettings = useCallback(
    (newSettings: Partial<AdminSystemSettings>) => {
      setSettings((prev) => ({ ...prev, ...newSettings }));

      addAuditLog({
        action: "تحديث إعدادات المنصة",
        targetType: "settings",
        targetId: "global_settings",
        targetTitle: "الإعدادات العامة",
        previousState: JSON.stringify(settings),
        newState: JSON.stringify({ ...settings, ...newSettings }),
        reason: "تحديث معايير السحب والمهام ونسب الإحالات",
      });
    },
    [addAuditLog, settings, setSettings],
  );

  const createAdminAccount = useCallback(
    (data: {
      name: string;
      email: string;
    }): { success: boolean; message: string } => {
      const trimmedName = data.name.trim();
      const trimmedEmail = data.email.trim();

      if (!trimmedName || !trimmedEmail) {
        return {
          success: false,
          message: "يرجى إدخال الاسم والبريد الإلكتروني.",
        };
      }

      const exists = admins.some(
        (a) => a.email.toLowerCase() === trimmedEmail.toLowerCase(),
      );
      if (exists) {
        return {
          success: false,
          message: "هذا البريد الإلكتروني مسجل مسبقاً لمسؤول آخر.",
        };
      }

      const newAdmin: AdminAccount = {
        id: generateId("adm"),
        name: trimmedName,
        email: trimmedEmail,
        role: "ADMIN",
        status: "active",
        lastActiveAt: getNowTimestamp(),
        createdAt: getNowTimestamp(),
      };

      setAdmins((prev) => [newAdmin, ...prev]);

      addAuditLog({
        action: "إضافة مسؤول نظام جديد",
        targetType: "admin",
        targetId: newAdmin.id,
        targetTitle: newAdmin.name,
        previousState: "غير موجود",
        newState: "نشط (صلاحية ADMIN)",
        reason: "إنشاء حساب مسؤول جديد للمنصة",
      });

      return {
        success: true,
        message: "تم إنشاء حساب المسؤول بنجاح.",
      };
    },
    [addAuditLog, admins, setAdmins],
  );

  const toggleAdminStatus = useCallback(
    (adminId: string) => {
      if (adminId === CURRENT_ADMIN.id) return; // Prevent disabling self

      const target = admins.find((a) => a.id === adminId);
      if (!target) return;

      const nextStatus = target.status === "active" ? "inactive" : "active";

      setAdmins((prev) =>
        prev.map((a) => (a.id === adminId ? { ...a, status: nextStatus } : a)),
      );

      addAuditLog({
        action: "تعديل حالة مسؤول النظام",
        targetType: "admin",
        targetId: adminId,
        targetTitle: target.name,
        previousState: target.status,
        newState: nextStatus,
        reason:
          nextStatus === "active" ? "تفعيل حساب المسؤول" : "تعطيل حساب المسؤول",
      });
    },
    [addAuditLog, admins, setAdmins],
  );

  const updateAdminAccount = useCallback(
    (
      adminId: string,
      data: { name: string; email: string },
    ): { success: boolean; message: string } => {
      const trimmedName = data.name.trim();
      const trimmedEmail = data.email.trim();

      if (!trimmedName || !trimmedEmail) {
        return {
          success: false,
          message: "يرجى إدخال الاسم والبريد الإلكتروني.",
        };
      }

      const emailConflict = admins.some(
        (a) =>
          a.id !== adminId &&
          a.email.toLowerCase() === trimmedEmail.toLowerCase(),
      );
      if (emailConflict) {
        return {
          success: false,
          message: "هذا البريد الإلكتروني مسجل مسبقاً لمسؤول آخر.",
        };
      }

      const existing = admins.find((a) => a.id === adminId);
      if (!existing) {
        return { success: false, message: "حساب المسؤول غير موجود." };
      }

      setAdmins((prev) =>
        prev.map((a) =>
          a.id === adminId
            ? { ...a, name: trimmedName, email: trimmedEmail }
            : a,
        ),
      );

      addAuditLog({
        action: "تعديل بيانات مسؤول النظام",
        targetType: "admin",
        targetId: adminId,
        targetTitle: trimmedName,
        previousState: `${existing.name} (${existing.email})`,
        newState: `${trimmedName} (${trimmedEmail})`,
        reason: "تحديث معلومات حساب المسؤول",
      });

      return {
        success: true,
        message: "تم تحديث بيانات المسؤول بنجاح.",
      };
    },
    [addAuditLog, admins, setAdmins],
  );
  return {
    updateSettings,
    createAdminAccount,
    toggleAdminStatus,
    updateAdminAccount,
  };
}
