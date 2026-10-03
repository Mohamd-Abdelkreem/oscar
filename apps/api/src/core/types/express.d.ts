import type {
  AuthenticatedUser,
  AuthenticatedSession,
  ValidatedRequestData,
} from "./request-context.types.js";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
      authSession?: AuthenticatedSession;
      validated?: ValidatedRequestData;
    }
  }
}

export {};
