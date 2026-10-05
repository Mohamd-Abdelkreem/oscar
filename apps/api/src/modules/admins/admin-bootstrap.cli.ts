import { userInfo } from "node:os";
import { pathToFileURL } from "node:url";

import {
  bootstrapInputSchema,
  type BootstrapOperator,
  type BootstrapInput,
} from "./admin-bootstrap.input.js";

type RunnerIdentity = Readonly<{
  platform: string;
  realUid: number | undefined;
  effectiveUid: number | undefined;
  osUid: number;
  username: string;
}>;

export function authorizeBootstrapOperator(
  configuredUid: string | undefined,
  identity: RunnerIdentity,
): BootstrapOperator {
  if (configuredUid === undefined || !/^[1-9][0-9]{0,9}$/u.test(configuredUid))
    throw new Error("Bootstrap operator authorization failed.");
  const uid = Number(configuredUid);
  if (
    uid > 4_294_967_294 ||
    identity.platform !== "linux" ||
    identity.realUid !== uid ||
    identity.effectiveUid !== uid ||
    identity.osUid !== uid ||
    identity.username.trim().length === 0 ||
    identity.username.length > 128 ||
    /\p{Cc}/u.test(identity.username)
  )
    throw new Error("Bootstrap operator authorization failed.");
  return { uid, username: identity.username };
}

export async function readBootstrapInput(
  input: AsyncIterable<Uint8Array | string>,
): Promise<BootstrapInput> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 8192) throw new Error("Invalid bootstrap input.");
    chunks.push(bytes);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid bootstrap input.");
  }
  const command = bootstrapInputSchema.safeParse(parsed);
  if (!command.success) throw new Error("Invalid bootstrap input.");
  return command.data;
}

export async function runBootstrapCli(
  runtime: Readonly<{
    configuredUid: string | undefined;
    argv: readonly string[];
    identity: () => RunnerIdentity;
    input: AsyncIterable<Uint8Array | string>;
    provision: (
      command: BootstrapInput,
      operator: BootstrapOperator,
    ) => Promise<{ userId: string }>;
    output: (message: string) => void;
  }>,
): Promise<number> {
  try {
    if (runtime.argv.length !== 0)
      throw new Error("Bootstrap accepts protected stdin only.");
    const operator = authorizeBootstrapOperator(
      runtime.configuredUid,
      runtime.identity(),
    );
    const command = await readBootstrapInput(runtime.input);
    const completion = await runtime.provision(command, operator);
    runtime.output(
      `Administrator setup complete: ${completion.userId}; pending email proof.\n`,
    );
    return 0;
  } catch {
    runtime.output(
      "Administrator setup failed or delivery is uncertain. Inspect setup state; use verification resend if pending.\n",
    );
    return 1;
  }
}

async function main(): Promise<void> {
  process.exitCode = await runBootstrapCli({
    configuredUid: process.env["ADMIN_BOOTSTRAP_OPERATOR_UID"],
    argv: process.argv.slice(2),
    identity: () => {
      const observed = userInfo();
      return {
        platform: process.platform,
        realUid: process.getuid?.(),
        effectiveUid: process.geteuid?.(),
        osUid: observed.uid,
        username: observed.username,
      };
    },
    input: process.stdin,
    output: (message) => {
      process.stdout.write(message);
    },
    provision: async (command, operator) => {
      // Secret-bearing configuration and database access follow OS authorization and input validation.
      const [
        { createDatabaseClient },
        { databaseConfig },
        { createEmailDelivery, EmailService },
        { AdminBootstrapService },
      ] = await Promise.all([
        import("@template/database"),
        import("../../core/config/database.config.js"),
        import("../../infrastructure/email/index.js"),
        import("./admin-bootstrap.service.js"),
      ]);
      const database = createDatabaseClient(databaseConfig.url);
      try {
        return await new AdminBootstrapService(
          database,
          new EmailService(createEmailDelivery()),
        ).provision(command, operator);
      } finally {
        await database.$disconnect();
      }
    },
  });
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  await main();
