import { z } from "zod";
import { createDocument } from "zod-openapi";

import {
  accountResponseSchemas,
  errorEnvelopeSchema,
  successEnvelopeSchema,
} from "@template/contracts";

import { appConfig } from "../../core/config/app.config.js";
import {
  changePasswordBodyDtoSchema,
  emailRequestBodyDtoSchema,
  loginBodyDtoSchema,
  registerBodyDtoSchema,
  resetPasswordBodyDtoSchema,
} from "../../modules/auth/dto/index.js";
import { updateProfileBodyDtoSchema } from "../../modules/users/dto/update-profile.dto.js";

const tokenParameter = z
  .string()
  .min(1)
  .meta({
    param: {
      name: "token",
      in: "query",
    },
  });

const jsonBody = (schema: z.ZodType) => ({
  required: true,
  content: { "application/json": { schema } },
});

const successEnvelope = (data: z.ZodType): z.ZodType =>
  successEnvelopeSchema.safeExtend({ data });

const successResponse = (description: string, data: z.ZodType) => ({
  description,
  content: { "application/json": { schema: successEnvelope(data) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorEnvelopeSchema } },
});

const commonErrors = {
  "400": errorResponse("Invalid request"),
  "401": errorResponse("Authentication failed"),
  "403": errorResponse("Request forbidden"),
  "429": errorResponse("Rate limit exceeded"),
  "500": errorResponse("Unexpected server error"),
};

const emptyObjectSchema = z.object({}).strict();
const messageSchema = z.object({ message: z.string() }).strict();
const validResetTokenSchema = z.object({ valid: z.literal(true) }).strict();
const healthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["ok", "error", "not_checked"]),
    uptime: z.string(),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .strict();

export const buildOpenApiDocument = () =>
  createDocument({
    openapi: "3.1.0",
    info: {
      title: `${appConfig.name} OpenAPI`,
      version: "1.0.0",
      description:
        "Authentication-ready REST API with access tokens, rotating refresh cookies, CSRF protection, and current-user profile management.",
    },
    servers: [{ url: appConfig.apiPrefix, description: "Configured API" }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        RefreshCookie: {
          type: "apiKey",
          in: "cookie",
          name: "refreshToken",
        },
        CsrfHeader: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
        },
      },
      schemas: {
        SafeUser: accountResponseSchemas.safeUser,
        AuthUserData: accountResponseSchemas.authUserData,
        AuthSessionData: accountResponseSchemas.authSessionData,
        ErrorEnvelope: errorEnvelopeSchema,
      },
    },
    paths: {
      "/auth/register": {
        post: {
          summary: "Register with email and password",
          requestBody: jsonBody(registerBodyDtoSchema),
          responses: {
            "201": successResponse(
              "Account created; verification email queued for delivery",
              accountResponseSchemas.authUserData,
            ),
            "409": errorResponse("Email already registered"),
            ...commonErrors,
          },
        },
      },
      "/auth/verify-email": {
        post: {
          summary: "Verify an email address",
          parameters: [tokenParameter],
          responses: {
            "200": successResponse(
              "Email verified",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/resend-verification": {
        post: {
          summary: "Request another verification link",
          description:
            "Always returns a neutral response to prevent account enumeration.",
          requestBody: jsonBody(emailRequestBodyDtoSchema),
          responses: {
            "200": successResponse("Request processed", messageSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/login": {
        post: {
          summary: "Create an authenticated session",
          requestBody: jsonBody(loginBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Signed in; refresh and CSRF cookies set",
              accountResponseSchemas.authSessionData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/refresh": {
        post: {
          summary: "Rotate the refresh token and issue a new access token",
          security: [{ RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse(
              "Session refreshed",
              accountResponseSchemas.authSessionData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Revoke the current refresh token",
          security: [{ BearerAuth: [], RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse("Signed out", emptyObjectSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/logout-all": {
        post: {
          summary: "Revoke every refresh token for the current user",
          security: [{ BearerAuth: [], RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse(
              "Signed out from all devices",
              emptyObjectSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          summary: "Request a password reset",
          description:
            "Always returns a neutral response to prevent account enumeration.",
          requestBody: jsonBody(emailRequestBodyDtoSchema),
          responses: {
            "200": successResponse("Request processed", messageSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Reset a password with a one-time token",
          parameters: [tokenParameter],
          requestBody: jsonBody(resetPasswordBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Password reset and existing sessions revoked",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/validate-reset-token": {
        get: {
          summary: "Validate a password-reset link",
          parameters: [tokenParameter],
          responses: {
            "200": successResponse("Reset link valid", validResetTokenSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/change-password": {
        patch: {
          summary: "Change the authenticated user's password",
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(changePasswordBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Password changed and existing sessions revoked",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/users/me": {
        get: {
          summary: "Read the current user",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": successResponse(
              "Current user",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
        patch: {
          summary: "Update the current user's profile",
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(updateProfileBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Profile updated",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/health/live": {
        get: {
          summary: "Liveness check",
          responses: { "200": successResponse("Service alive", healthSchema) },
        },
      },
      "/health/ready": {
        get: {
          summary: "Readiness check",
          responses: {
            "200": successResponse("Service ready", healthSchema),
            "503": errorResponse("Database unavailable"),
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI 3.1 document",
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
    },
  });
