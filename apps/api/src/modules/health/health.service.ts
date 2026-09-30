import type { DatabaseClient } from "@template/database";

import type { HealthResult } from "./health.types.js";

export class HealthService {
  constructor(private readonly database: DatabaseClient) {}

  getLiveness(): HealthResult {
    return {
      status: "ok",
      database: "not_checked",
      uptime: `${String(Math.floor(process.uptime()))}s`,
      timestamp: new Date().toISOString(),
    };
  }

  async checkHealth(): Promise<HealthResult> {
    const database = await this.checkDatabase();

    return {
      status: database === "ok" ? "ok" : "degraded",
      database,
      uptime: `${String(Math.floor(process.uptime()))}s`,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<"ok" | "error"> {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return "ok";
    } catch {
      return "error";
    }
  }
}
