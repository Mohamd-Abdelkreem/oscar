import * as tailwindPlugin from "prettier-plugin-tailwindcss";

/** @type {import("prettier").Config} */
const config = {
  endOfLine: "lf",
  plugins: [tailwindPlugin],
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
};

export default config;
