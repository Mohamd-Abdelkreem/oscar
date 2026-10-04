import { createNodeConfig } from "@template/eslint-config/node";

export default [
  ...createNodeConfig({
    tsconfigRootDir: import.meta.dirname,
    allowDefaultProject: [
      "vitest.config.ts",
      "vitest.integration.config.ts",
      "vitest.setup.ts",
    ],
  }),
  {
    files: ["tests/e2e/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tests/e2e/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
