import { z } from "zod";
import {
  boundedPageQuerySchema,
  submissionListQuerySchema,
  adminSubmissionListQuerySchema,
  submissionPageSchema,
  evidencePageSchema,
  adminSubmissionPageSchema,
  proofAssetSchema,
  type SubmissionDetail,
} from "@template/contracts";
import { Prisma, type DatabaseClient, type UserRole } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { employeeWork } from "../tasks/employee-tasks.service.js";
import type {
  TaskActorIdentity,
  TaskClock,
} from "../tasks/task-transaction.js";
import {
  submissionInclude,
  mapSubmissionSummary,
  mapSubmissionDetail,
  mapEvidence,
  mapAdminSubmissionDetail,
} from "./task-submissions.mapper.js";

export class TaskSubmissionsQueries {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: TaskClock,
    private readonly reads?: ProofReadService,
  ) {}
  private read<T>(
    identity: TaskActorIdentity,
    role: UserRole,
    work: (transaction: Prisma.TransactionClient, now: Date) => Promise<T>,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, role);
        return work(transaction, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async refresh(detail: SubmissionDetail, identity: TaskActorIdentity) {
    if (this.reads !== undefined)
      detail.evidence.asset = proofAssetSchema.parse(
        await this.reads.metadata(identity, "PROOF", detail.evidence.assetId),
      );
    return detail;
  }
  async detail(identity: TaskActorIdentity, submissionId: string) {
    z.uuid().parse(submissionId);
    const detail = await this.read(
      identity,
      "USER",
      async (transaction, now) => {
        const submission = await transaction.taskSubmission.findFirst({
          where: { id: submissionId, employeeId: identity.userId },
          include: submissionInclude,
        });
        if (submission === null)
          throw new AppError("Submission not found.", 404, "NOT_FOUND");
        const work = await employeeWork(transaction, identity, now);
        return mapSubmissionDetail(
          submission,
          submission.status === "PENDING" &&
            work.eligibility === "ELIGIBLE" &&
            now < submission.deadlineAt,
        );
      },
    );
    return this.refresh(detail, identity);
  }
  list(identity: TaskActorIdentity, rawQuery: unknown) {
    const query = submissionListQuerySchema.parse(rawQuery);
    return this.read(identity, "USER", async (transaction) => {
      const where = {
        employeeId: identity.userId,
        ...(query.status === undefined ? {} : { status: query.status }),
      };
      const rows = await transaction.taskSubmission.findMany({
        where,
        include: submissionInclude,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.taskSubmission.count({ where });
      return submissionPageSchema.parse({
        items: rows.map(mapSubmissionSummary),
        pagination: buildPaginationMeta({ ...query, total }),
      });
    });
  }
  async evidence(
    identity: TaskActorIdentity,
    submissionId: string,
    rawQuery: unknown,
    role: UserRole = "USER",
  ) {
    z.uuid().parse(submissionId);
    const query = boundedPageQuerySchema.parse(rawQuery);
    const page = await this.read(identity, role, async (transaction) => {
      const submission = await transaction.taskSubmission.findFirst({
        where: {
          id: submissionId,
          ...(role === "USER" ? { employeeId: identity.userId } : {}),
        },
        select: { id: true },
      });
      if (submission === null)
        throw new AppError("Submission not found.", 404, "NOT_FOUND");
      const where = { submissionId };
      const rows = await transaction.submissionEvidence.findMany({
        where,
        include: { asset: true },
        orderBy: [{ version: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.submissionEvidence.count({ where });
      return evidencePageSchema.parse({
        items: rows.map(mapEvidence),
        pagination: buildPaginationMeta({ ...query, total }),
      });
    });
    if (this.reads !== undefined)
      for (const evidence of page.items)
        evidence.asset = proofAssetSchema.parse(
          await this.reads.metadata(identity, "PROOF", evidence.assetId),
        );
    return page;
  }
  async adminDetail(identity: TaskActorIdentity, submissionId: string) {
    z.uuid().parse(submissionId);
    const detail = await this.read(identity, "ADMIN", async (transaction) => {
      const submission = await transaction.taskSubmission.findUnique({
        where: { id: submissionId },
        include: submissionInclude,
      });
      if (submission === null)
        throw new AppError("Submission not found.", 404, "NOT_FOUND");
      return mapAdminSubmissionDetail(submission);
    });
    detail.submission = await this.refresh(detail.submission, identity);
    return detail;
  }
  async adminList(identity: TaskActorIdentity, rawQuery: unknown) {
    const query = adminSubmissionListQuerySchema.parse(rawQuery);
    const page = await this.read(identity, "ADMIN", async (transaction) => {
      const base: Prisma.TaskSubmissionWhereInput = {
        ...(query.taskId === undefined ? {} : { taskId: query.taskId }),
        ...(query.employeeId === undefined
          ? {}
          : { employeeId: query.employeeId }),
        ...(query.dateFrom || query.dateTo
          ? {
              businessDate: {
                ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                {
                  employee: {
                    fullName: { contains: query.search, mode: "insensitive" },
                  },
                },
                {
                  employee: {
                    email: { contains: query.search, mode: "insensitive" },
                  },
                },
                {
                  capturedTaskContent: {
                    path: ["title"],
                    string_contains: query.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      };
      const where = {
        ...base,
        ...(query.status === undefined ? {} : { status: query.status }),
      };
      const rows = await transaction.taskSubmission.findMany({
        where,
        include: submissionInclude,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.taskSubmission.count({ where });
      const counts = await transaction.taskSubmission.groupBy({
        by: ["status"],
        where: base,
        _count: { _all: true },
      });
      const count = (status: "PENDING" | "APPROVED" | "REJECTED") =>
        counts.find((row) => row.status === status)?._count._all ?? 0;
      return adminSubmissionPageSchema.parse({
        items: rows.map((row) => ({
          ...mapSubmissionSummary(row),
          employee: row.employee,
          evidence: mapSubmissionDetail(row, false).evidence,
        })),
        pagination: buildPaginationMeta({ ...query, total }),
        statusCounts: {
          all: counts.reduce((sum, row) => sum + row._count._all, 0),
          pending: count("PENDING"),
          approved: count("APPROVED"),
          rejected: count("REJECTED"),
        },
      });
    });
    if (this.reads !== undefined)
      for (const row of page.items)
        row.evidence.asset = proofAssetSchema.parse(
          await this.reads.metadata(identity, "PROOF", row.evidence.assetId),
        );
    return page;
  }
}
