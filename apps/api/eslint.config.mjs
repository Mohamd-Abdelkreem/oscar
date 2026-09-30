import { createNodeConfig } from "@template/eslint-config/node";

export default createNodeConfig({
  tsconfigRootDir: import.meta.dirname,
  allowDefaultProject: [
    "vitest.config.ts",
    "vitest.integration.config.ts",
    "vitest.setup.ts",
  ],
});
