import { createNextConfig } from "@template/eslint-config/next";

export default createNextConfig({
  tsconfigRootDir: import.meta.dirname,
  allowDefaultProject: ["vitest.config.ts"],
});
