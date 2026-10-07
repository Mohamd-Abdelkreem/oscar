import type { Logger } from "pino";
import { z } from "zod";

const eventSchema = z.enum([
  "SCAN_LAG",
  "PENDING_WORK",
  "RECOVERY_UNAVAILABLE",
  "EVIDENCE_CONFLICT",
  "RUNTIME_ADMISSION",
  "RESOURCE_SHORTFALL",
  "UNRESOLVED_ATTEMPT",
]);
const metadataSchema = z
  .object({
    code: z
      .string()
      .regex(/^[A-Z0-9_]{1,64}$/u)
      .optional(),
    processKind: z
      .enum(["API", "DEPOSIT_WORKER", "SIGNER", "RECOVERY_OPERATOR"])
      .optional(),
    bootId: z.uuid().optional(),
    assignmentId: z.uuid().optional(),
    attemptId: z.uuid().optional(),
    count: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    ageMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    generation: z
      .string()
      .regex(/^\d{1,19}$/u)
      .optional(),
  })
  .strip();
type SignalEvent = z.infer<typeof eventSchema>;
type SignalMetadata = z.infer<typeof metadataSchema>;
export class RuntimeSignals {
  private readonly active = new Map<string, number>();
  constructor(
    private readonly logger: Logger,
    private readonly clock: () => Date,
  ) {}
  observe(event: SignalEvent, active: boolean, metadata: SignalMetadata = {}) {
    const validatedEvent = eventSchema.parse(event);
    const projected = metadataSchema.parse(metadata);
    const now = this.clock();
    const scope = `${event}:${projected.attemptId ?? projected.assignmentId ?? "runtime"}`;
    const previous = this.active.get(scope);
    if (
      active &&
      (previous === undefined || now.getTime() - previous >= 300000)
    ) {
      this.active.set(scope, now.getTime());
      const metadata = {
        event: validatedEvent,
        state: previous === undefined ? "ACTIVE" : "REMINDER",
        timestamp: now.toISOString(),
        ...projected,
      };
      if (event === "EVIDENCE_CONFLICT")
        this.logger.error(metadata, "Protected runtime state.");
      else if (event === "RUNTIME_ADMISSION")
        this.logger.info(metadata, "Protected runtime state.");
      else this.logger.warn(metadata, "Protected runtime state.");
    } else if (!active && previous !== undefined) {
      this.active.delete(scope);
      this.logger.info(
        {
          event: validatedEvent,
          state: "CLEARED",
          timestamp: now.toISOString(),
          ...projected,
        },
        "Protected runtime state.",
      );
    }
  }
  admission(
    state: "REQUESTED" | "FENCED" | "ACKNOWLEDGED",
    metadata: SignalMetadata,
  ) {
    this.logger.info(
      {
        event: "RUNTIME_ADMISSION",
        state,
        timestamp: this.clock().toISOString(),
        ...metadataSchema.parse(metadata),
      },
      "Protected runtime admission.",
    );
  }
}
