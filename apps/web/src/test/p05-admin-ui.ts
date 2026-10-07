import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { reply, now, pagination } from "./p04-network";
import { task, code, adminSubmission, proof } from "./p05-network";

export function privateBinary(config: InternalAxiosRequestConfig) {
  return {
    config,
    status: 200,
    statusText: "OK",
    data: new Blob(["synthetic"], { type: "image/png" }),
    headers: new AxiosHeaders({
      "content-type": "image/png",
      "content-length": "9",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": 'inline; filename="image.png"',
    }),
  };
}
export const onePage = (items: unknown[], limit = 25) => ({
  items,
  pagination: {
    ...pagination,
    limit,
    total: items.length,
    totalPages: items.length ? 1 : 0,
  },
});
export function adminRead(config: InternalAxiosRequestConfig) {
  if (config.url?.endsWith("/content")) return privateBinary(config);
  if (config.url?.startsWith("/proofs/")) return reply(config, proof);
  if (config.url === "/admin/tasks")
    return reply(
      config,
      onePage([
        {
          ...(({
            firstParticipationAt: _first,
            dateEditable: _editable,
            createdAt: _created,
            updatedAt: _updated,
            ...summary
          }) => summary)(task),
        },
      ]),
    );
  if (config.url === "/admin/task-codes")
    return reply(config, onePage([code], 10));
  if (config.url?.endsWith("/usages") || config.url?.endsWith("/changes"))
    return reply(config, onePage([]));
  if (config.url === "/admin/task-codes/" + code.id) return reply(config, code);
  if (config.url === "/admin/task-submissions")
    return reply(config, {
      ...onePage(
        [
          {
            ...adminSubmission.submission,
            employee: adminSubmission.employee,
            evidence: adminSubmission.submission.evidence,
          },
        ].map(
          ({
            snapshot: _snapshot,
            finalDecision: _decision,
            canReplace: _replace,
            ...summary
          }) => summary,
        ),
      ),
      statusCounts: { all: 1, pending: 1, approved: 0, rejected: 0 },
    });
  if (config.url?.endsWith("/evidence"))
    return reply(config, onePage([adminSubmission.submission.evidence]));
  if (config.url?.startsWith("/admin/task-submissions/"))
    return reply(config, adminSubmission);
  return reply(config, task);
}
export const observed = (
  commandId: string,
  kind: string,
  targetId: string,
  outcome: unknown,
) => ({
  state: "OBSERVED",
  command: { commandId, kind, targetId, committedAt: now, outcome },
});
