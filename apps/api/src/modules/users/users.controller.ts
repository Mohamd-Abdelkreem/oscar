import type { Request, Response } from "express";

import { ResponseHelper } from "../../core/responses/api-response.js";
import { InternalServerError } from "../../core/errors/internal-server.error.js";
import type { UpdateProfileBodyDto } from "./dto/update-profile.dto.js";
import type { UsersService } from "./users.service.js";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getMe = async (request: Request, response: Response): Promise<Response> => {
    if (request.authSession === undefined)
      throw new InternalServerError(
        "Authenticated session context is required.",
      );
    const user = await this.usersService.getCurrentUser(request.authSession);
    return ResponseHelper.ok(
      response,
      { user },
      "Current user loaded.",
      request.path,
      request.requestId,
    );
  };

  updateMe = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const body = request.validated?.body as UpdateProfileBodyDto;
    if (request.authSession === undefined)
      throw new InternalServerError(
        "Authenticated session context is required.",
      );
    const user = await this.usersService.updateCurrentUser(
      request.authSession,
      body,
    );
    return ResponseHelper.ok(
      response,
      { user },
      "Profile updated.",
      request.path,
      request.requestId,
    );
  };
}
