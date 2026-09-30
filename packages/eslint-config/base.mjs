import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const defaultIgnores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/src/generated/prisma/**",
  "**/next-env.d.ts",
];

export const createBaseConfig = ({
  tsconfigRootDir,
  ignores = [],
  allowDefaultProject = [],
}) => [
  { ignores: [...defaultIgnores, ...ignores] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,mts,cts}"],
  })),
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService:
          allowDefaultProject.length > 0 ? { allowDefaultProject } : true,
        tsconfigRootDir,
      },
    },
    plugins: {
      "import-x": importX,
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
];
