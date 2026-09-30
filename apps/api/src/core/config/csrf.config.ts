import { cookieConfig } from "./cookie.config.js";

export const csrfConfig = Object.freeze({
  headerName: "x-csrf-token",
  cookieName: cookieConfig.csrfName,
});
