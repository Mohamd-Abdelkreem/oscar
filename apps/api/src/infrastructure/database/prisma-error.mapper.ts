import { AppError } from "../../core/errors/app.error.js";
import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ConflictException } from "../../core/errors/conflict.error.js";
import { InternalServerError } from "../../core/errors/internal-server.error.js";
import { NotFoundException } from "../../core/errors/not-found.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";

const connectivityCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1009",
  "P1010",
  "P1011",
  "P1012",
  "P1013",
  "P1014",
  "P1015",
  "P1016",
  "P1017",
]);

const approvedCheckConstraints = new Set([
  "ck_users_email_normalized",
  "ck_users_status_timestamps_consistent",
]);

const mappedCodes = new Set([
  "P2002",
  "P2003",
  "P2004",
  "P2009",
  "P2014",
  "P2025",
  "P2034",
  ...connectivityCodes,
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isAllowlistedPrismaCode = (value: unknown): value is string =>
  typeof value === "string" && mappedCodes.has(value);

const containsApprovedConstraint = (value: unknown): boolean => {
  if (typeof value === "string") {
    return [...approvedCheckConstraints].some((name) => value.includes(name));
  }
  if (Array.isArray(value)) return value.some(containsApprovedConstraint);
  if (!isRecord(value)) return false;
  return Object.values(value).some(containsApprovedConstraint);
};

export const mapPrismaError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (!isRecord(error)) return new InternalServerError();

  const code = error["code"];
  if (code === "P2002") {
    return new ConflictException(
      "A unique constraint prevents this operation.",
    );
  }
  if (code === "P2003" || code === "P2014") {
    return new ConflictException("A related record prevents this operation.");
  }
  if (code === "P2025") {
    return new NotFoundException("The requested record was not found.");
  }
  if (code === "P2034") {
    return new ConflictException(
      "A conflicting transaction is in progress. Retry the request.",
    );
  }
  if (
    (code === "P2004" || code === "P2009") &&
    containsApprovedConstraint(error["meta"])
  ) {
    return new BadRequestException(
      "A database constraint rejected the submitted value.",
    );
  }
  if (typeof code === "string" && connectivityCodes.has(code)) {
    return new ServiceUnavailableException(
      "The database is not currently available.",
    );
  }

  const message = error["message"];
  if (
    typeof message === "string" &&
    ["Can't reach database server", "ECONNREFUSED", "ENOTFOUND"].some(
      (fragment) => message.includes(fragment),
    )
  ) {
    return new ServiceUnavailableException(
      "The database is not currently available.",
    );
  }

  return new InternalServerError();
};
