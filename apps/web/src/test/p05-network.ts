import {
  employeeTaskDaySchema,
  adminTaskDetailSchema,
  submissionDetailSchema,
  adminSubmissionDetailSchema,
  taskCodeSummarySchema,
} from "@template/contracts";
import { actorId, otherId, now, terms, pagination } from "./p04-network";

export const window = {
  opensAt: now,
  closesAt: "2026-10-05T15:00:00.000Z",
  nextOpeningAt: "2026-10-06T09:00:00.000Z",
};
export const content = {
  title: "مهمة اليوم",
  description: "نفذ التعليمات وأرفق الصورة",
  platform: "منصة",
  targetUrl: "https://example.com/task",
};
export const proof = {
  id: otherId,
  purpose: "PROOF",
  uploadedAt: now,
  width: 1,
  height: 1,
  contentType: "image/png",
  byteCount: 9,
  availability: "PRESENT",
} as const;
export const task = adminTaskDetailSchema.parse({
  id: actorId,
  revision: 1,
  publicationDate: "2026-10-05",
  ...content,
  isCodeRequired: true,
  illustration: null,
  window,
  publicationState: "PUBLISHED",
  displayStatus: "ACTIVE",
  linkedCodeCount: 1,
  distinctUnlockedEmployeeCount: 0,
  submissionCount: 0,
  approvedSubmissionCount: 0,
  firstParticipationAt: null,
  dateEditable: true,
  createdAt: now,
  updatedAt: now,
});
export const day = employeeTaskDaySchema.parse({
  serverNow: now,
  businessDate: "2026-10-05",
  window,
  calendarState: "OPEN",
  workEligibility: "ELIGIBLE",
  opportunityState: "PUBLISHED",
  task: {
    id: actorId,
    revision: 1,
    publicationDate: "2026-10-05",
    ...content,
    isCodeRequired: true,
    illustration: null,
  },
  unlock: null,
  submission: null,
  currentEntitlement: {
    effective: true,
    packageCode: "S1",
    packageLabel: "S1",
    dailyReward: "2",
  },
  canUnlock: true,
  canSubmit: false,
  canReplace: false,
  unavailableReason: "CODE_REQUIRED",
});
export const submission = submissionDetailSchema.parse({
  id: actorId,
  taskId: actorId,
  businessDate: "2026-10-05",
  taskTitle: content.title,
  reward: "2",
  submittedAt: now,
  status: "PENDING",
  version: 1,
  currentEvidenceVersion: 1,
  snapshot: {
    taskId: actorId,
    businessDate: "2026-10-05",
    capturedTaskRevision: 1,
    capturedTaskContent: content,
    subscriptionId: otherId,
    capturedSubscriptionTerms: terms,
    reward: "2",
    declaredExecuted: true,
    submittedAt: now,
    deadlineAt: window.closesAt,
  },
  evidence: {
    id: actorId,
    version: 1,
    assetId: otherId,
    acceptedAt: now,
    asset: proof,
  },
  finalDecision: null,
  canReplace: true,
});
export const employee = {
  id: otherId,
  fullName: "Employee",
  email: "employee@example.test",
};
export const adminSubmission = adminSubmissionDetailSchema.parse({
  submission,
  employee,
  review: null,
});
export const code = taskCodeSummarySchema.parse({
  id: actorId,
  normalizedText: "CODE",
  state: "ENABLED",
  version: 1,
  description: null,
  createdAt: now,
  updatedAt: now,
  creator: employee,
  task: {
    id: actorId,
    title: content.title,
    platform: content.platform,
    window,
  },
  distinctSuccessfulEmployeeCount: 0,
  successfulUsageCount: 0,
});
export const emptyPage = (limit = 25) => ({
  items: [],
  pagination: { ...pagination, limit },
});
