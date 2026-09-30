import type {
  AuthenticatedUser,
  ValidatedRequestData,
} from "./request-context.types.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
      validated?: ValidatedRequestData;
    }
  }
}

export {};
