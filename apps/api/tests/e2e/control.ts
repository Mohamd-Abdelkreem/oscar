import { z } from "zod";
import {
  financialInstantSchema,
  usdtAmountSchema,
  walletComponentsSchema,
  tronPublicAddressSchema,
  depositTransactionIdSchema,
} from "@template/contracts";

export const p07EmailSchema = z.enum([
  "employee@p03.test",
  "other@p03.test",
  "first-credit@p07.test",
]);
export const p07FixturesSchema = z.strictObject({
  employeeId: z.uuid(),
  otherId: z.uuid(),
  firstCreditId: z.uuid(),
});
export const p07StateSchema = z.strictObject({
  employeeId: z.uuid(),
  wallet: walletComponentsSchema,
  assignment: z
    .strictObject({
      id: z.uuid(),
      state: z.enum(["REQUESTED", "KEY_STORED", "RECOVERY_ACKED", "READY"]),
      address: tronPublicAddressSchema.nullable(),
    })
    .nullable(),
  receipts: z
    .array(
      z.strictObject({
        transactionId: depositTransactionIdSchema,
        logIndex: z.number().int().nonnegative(),
        amount: usdtAmountSchema,
      }),
    )
    .max(100),
  manualCredits: z.number().int().nonnegative(),
  operations: z.number().int().nonnegative(),
  postings: z.number().int().nonnegative(),
  auditCount: z.number().int().nonnegative(),
  reservations: z
    .array(
      z.strictObject({
        id: z.uuid(),
        state: z.enum(["ACTIVE", "RELEASED"]),
        referral: usdtAmountSchema,
        nonReferral: usdtAmountSchema,
      }),
    )
    .max(100),
});

export const p04StateSchema = z
  .object({
    employeeId: z.uuid(),
    purchases: z.number().int().min(0),
    subscriptions: z.number().int().min(0),
    awards: z.number().int().min(0),
    skipped: z.number().int().min(0),
    operations: z.number().int().min(0),
    postings: z.number().int().min(0),
    configurationChanges: z.number().int().min(0),
    wallet: walletComponentsSchema,
    savedPrices: z.array(usdtAmountSchema).max(20),
    savedCountedDates: z.array(z.number().int().positive()).max(20),
    expiresAt: financialInstantSchema.nullable(),
  })
  .strict();

export const p05StateSchema = z.strictObject({
  employeeId: z.uuid(),
  submissions: z.number().int().nonnegative(),
  evidence: z.number().int().nonnegative(),
  rewardPostings: z.number().int().nonnegative(),
  available: usdtAmountSchema,
  assets: z
    .array(
      z.strictObject({
        id: z.uuid(),
        uploadedAt: financialInstantSchema,
        state: z.enum(["READY", "DELETING", "DELETED"]),
      }),
    )
    .max(100),
});
export const p05DecoderStateSchema = z.strictObject({
  held: z.boolean(),
  closedSignal: z.enum(["SIGKILL", "OTHER"]).nullable(),
});
export const p05FixturesSchema = z.strictObject({
  employeeId: z.uuid(),
  otherId: z.uuid(),
  publicationDate: z.iso.date(),
});
export const controlRequestSchema = z.discriminatedUnion("command", [
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p07-fixtures"),
    pagedTargets: z.boolean().optional(),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p07-ready"),
    email: p07EmailSchema,
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p07-state"),
    email: p07EmailSchema,
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p07-credit"),
    email: p07EmailSchema,
    event: z.enum(["confirmed", "two-logs", "unfinalized", "wrong-token"]),
    day: z.enum(["SATURDAY", "SUNDAY"]).optional(),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-fixtures"),
    futureWorkDate: z.literal(true).optional(),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-fund-upgrade"),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-state"),
    email: z.email(),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-scan"),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-pages"),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-hold-decoder"),
  }),
  z.strictObject({
    id: z.number().int().min(1),
    command: z.literal("p05-decoder-state"),
  }),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("p04-referral-purchase"),
      event: z.enum(["after-rate", "after-expiry"]),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("p04-release"),
      email: z.email().max(320),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("p04-fixtures"),
      profile: z.enum(["purchase", "wallet", "referrals"]),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("p04-state"),
      email: z.email().max(320),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("p04-clock"),
      instant: financialInstantSchema,
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("p04-fund"),
      email: z.email().max(320),
      referral: usdtAmountSchema,
      nonReferral: usdtAmountSchema,
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("mail"),
      email: z.email().max(320),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("delivery"),
      outcome: z.enum(["acknowledged", "rejected", "unknown"]),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("expire"),
      purpose: z.enum(["verification", "reset", "invitation"]),
      targetId: z.uuid(),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("state"),
      email: z.email().max(320),
    })
    .strict(),
  z
    .object({ id: z.number().int().min(1), command: z.literal("stop") })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("display-fixtures"),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("management-fixtures"),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("management-state"),
      email: z.email().max(320),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(1),
      command: z.literal("invitation-cooldown"),
      email: z.email().max(320),
    })
    .strict(),
]);
export type ControlRequest = z.infer<typeof controlRequestSchema>;
export const controlReplySchema = z
  .object({
    id: z.number().int().min(0),
    status: z.enum(["ready", "ok", "failed", "stopped"]),
    data: z.union([
      z.null(),
      z.strictObject({
        nativeFailure: z.enum([
          "DATABASE",
          "MIGRATION",
          "SNAPSHOT",
          "LINUX_LAUNCH",
          "DEPENDENCIES",
          "API_BOOT",
        ]),
      }),
      p04StateSchema,
      p05StateSchema,
      p05DecoderStateSchema,
      p05FixturesSchema,
      p07FixturesSchema,
      p07StateSchema,
      z
        .object({ buyerId: z.uuid(), rootId: z.uuid(), otherId: z.uuid() })
        .strict(),
      z
        .object({
          invitation: z
            .object({
              id: z.uuid(),
              tokenVersion: z.number().int(),
              accepted: z.boolean(),
              revoked: z.boolean(),
              deliveryStatus: z.string().max(32),
            })
            .strict()
            .nullable(),
          audits: z
            .array(
              z
                .object({
                  action: z.string().max(64),
                  actorUserId: z.uuid().nullable(),
                  reason: z.string().max(500).nullable(),
                })
                .strict(),
            )
            .max(100),
        })
        .strict(),
      z.object({ url: z.string().max(8192).nullable() }).strict(),
      z
        .object({
          user: z
            .object({
              id: z.uuid(),
              role: z.enum(["USER", "ADMIN"]),
              status: z.string().max(30),
              verified: z.boolean(),
              sessions: z.number().int().min(0),
              referralCode: z.string().regex(/^[0-9a-f]{32}$/u),
              sponsorUserId: z.uuid().nullable(),
            })
            .strict()
            .nullable(),
        })
        .strict(),
    ]),
  })
  .strict();
export type ControlReply = z.infer<typeof controlReplySchema>;
