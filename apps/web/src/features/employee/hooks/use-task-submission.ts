"use client";

import { useState, type SyntheticEvent } from "react";
import { useEmployeeState } from "../context/employee-state.context";
import type { EmployeeActionResult } from "../types/employee.types";
import { useManagedTimeout } from "./use-managed-timeout";

function commitScreenshot(
  file: File,
  save: (url: string) => EmployeeActionResult,
): EmployeeActionResult {
  // The provider owns committed URLs; the upload control owns only its temporary preview.
  const committedUrl = URL.createObjectURL(file);
  const submission = save(committedUrl);
  if (!submission.success) URL.revokeObjectURL(committedUrl);
  return submission;
}

export function useTaskSubmission() {
  const { submitTask, replaceTaskScreenshot } = useEmployeeState();
  const scheduleTimeout = useManagedTimeout();
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<EmployeeActionResult | null>(null);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!screenshotFile) {
      setFeedback({
        success: false,
        message: "يرجى إرفاق لقطة شاشة لإثبات إنجاز المهمة.",
      });
      return;
    }
    if (!acknowledged) {
      setFeedback({
        success: false,
        message: "يرجى الإقرار بصحة التنفيذ وعدم تكرار لقطة الشاشة.",
      });
      return;
    }
    setIsSubmitting(true);
    scheduleTimeout(() => {
      setFeedback(commitScreenshot(screenshotFile, submitTask));
      setIsSubmitting(false);
    }, 400);
  };

  const handleReplaceScreenshot = () => {
    if (!screenshotFile) {
      setFeedback({
        success: false,
        message: "يرجى اختيار لقطة شاشة جديدة للاستبدال.",
      });
      return;
    }
    setFeedback(commitScreenshot(screenshotFile, replaceTaskScreenshot));
  };

  return {
    screenshotFile,
    setScreenshotFile,
    acknowledged,
    setAcknowledged,
    isSubmitting,
    feedback,
    handleSubmit,
    handleReplaceScreenshot,
  };
}
