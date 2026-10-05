import { createNextConfig } from "@template/eslint-config/next";

const config = [
  ...createNextConfig({
    tsconfigRootDir: import.meta.dirname,
    allowDefaultProject: ["vitest.config.ts"],
  }),
  {
    files: ["playwright.config.ts", "e2e/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./e2e/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["e2e/support/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
      },
    },
  },
];
export default config;
