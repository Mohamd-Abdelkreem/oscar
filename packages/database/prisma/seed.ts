import { createDatabaseClient } from "../src/client.js";
import {
  buildSeedUpsert,
  parseSeedGroup,
  type SeedDecision,
} from "../src/seed-config.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const nodeEnv = process.env["NODE_ENV"] ?? "development";
const decisions = await Promise.all([
  parseSeedGroup("ADMIN", process.env, nodeEnv),
  parseSeedGroup("USER", process.env, nodeEnv),
]);
const enabled = decisions.filter(
  (decision): decision is Extract<SeedDecision, { kind: "enabled" }> =>
    decision.kind === "enabled",
);

if (enabled.length === 0) {
  console.info("Seed skipped: no optional users were configured.");
} else {
  const database = createDatabaseClient(databaseUrl);
  try {
    const now = new Date();
    for (const decision of enabled) {
      await database.user.upsert(buildSeedUpsert(decision, now));
      console.info(`Seeded optional ${decision.group.toLowerCase()} account.`);
    }
  } finally {
    await database.$disconnect();
  }
}
