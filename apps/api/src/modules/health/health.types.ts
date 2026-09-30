export interface HealthResult {
  status: "ok" | "degraded";
  database: "ok" | "error" | "not_checked";
  uptime: string;
  timestamp: string;
}
