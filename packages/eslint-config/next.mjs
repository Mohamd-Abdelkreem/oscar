import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

import { createBaseConfig } from "./base.mjs";

const nextCoreVitals = nextVitals.filter(
  (config) => config.name !== "next/typescript",
);

export const createNextConfig = (options) => [
  ...nextCoreVitals,
  ...createBaseConfig(options),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
];
