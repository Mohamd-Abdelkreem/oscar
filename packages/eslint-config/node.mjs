import globals from "globals";

import { createBaseConfig } from "./base.mjs";

export const createNodeConfig = (options) => [
  ...createBaseConfig(options),
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: { globals: globals.node },
  },
];
