import type { UserRole } from "@template/contracts";
import type { Route } from "next";
import { DEFAULT_RETURN_PATH } from "../constants/auth.constants";

export const roleHomePath = (role: UserRole): Route =>
  role === "ADMIN" ? "/admin" : DEFAULT_RETURN_PATH;

export const replaceWithLogin = (): void => {
  if (typeof window !== "undefined") window.location.replace("/auth/login");
};
