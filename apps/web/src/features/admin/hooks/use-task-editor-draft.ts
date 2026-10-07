"use client";

import type { AdminTaskDetail, TaskCreate } from "@template/contracts";
import { useState } from "react";

export type TaskEditorDraft = Omit<TaskCreate, "commandId" | "confirmed">;

function editableTask(task?: AdminTaskDetail): TaskEditorDraft {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    targetUrl: task?.targetUrl ?? "https://partner.example.com/task-link",
    platform: task?.platform ?? "منصة التقييم المعتمدة أوسكار",
    publicationDate: task?.publicationDate ?? "",
    publicationState: task?.publicationState ?? "PUBLISHED",
    isCodeRequired: task?.isCodeRequired ?? true,
    illustrationAssetId: task?.illustration?.id ?? null,
  };
}

const editableKeys = [
  "title",
  "description",
  "targetUrl",
  "platform",
  "publicationDate",
  "publicationState",
  "isCodeRequired",
  "illustrationAssetId",
] as const;

export function useTaskEditorDraft(
  currentTask: AdminTaskDetail | undefined,
  interaction: {
    readonly selectedImage: boolean;
    readonly preserveDraft: boolean;
  },
) {
  const [editor, setEditor] = useState(() => ({
    base: currentTask,
    draft: editableTask(currentTask),
  }));
  const original = editableTask(editor.base);
  const dirty =
    interaction.selectedImage ||
    editableKeys.some((key) => editor.draft[key] !== original[key]);
  const remoteChanged =
    !!currentTask &&
    !!editor.base &&
    (currentTask.revision !== editor.base.revision ||
      currentTask.dateEditable !== editor.base.dateEditable);

  // A refreshed revision must never authorize fields from an older task.
  if (remoteChanged && !dirty && !interaction.preserveDraft)
    setEditor({ base: currentTask, draft: editableTask(currentTask) });

  return {
    ...editor,
    remoteChanged,
    updateDraft: (patch: Partial<TaskEditorDraft>) => {
      setEditor((previous) => ({
        ...previous,
        draft: { ...previous.draft, ...patch },
      }));
    },
    replaceWithCurrent: () => {
      setEditor({ base: currentTask, draft: editableTask(currentTask) });
    },
  };
}
