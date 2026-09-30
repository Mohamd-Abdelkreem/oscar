import { defineConfig } from "vitest/config";
import path from "node:path";

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api/v1";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    globals: false,
    restoreMocks: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
