import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client.js";

export type DatabaseClient = PrismaClient;

export const createDatabaseClient = (
  connectionString: string,
): DatabaseClient => {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
};
