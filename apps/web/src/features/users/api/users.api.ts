import {
  identityUserDataSchema,
  type IdentityUserData,
  type UpdateProfileBody,
} from "@template/contracts";

import { apiClient, parseApiResponse } from "@/services/api/api-client";

export const usersApi = {
  async getMe(signal?: AbortSignal): Promise<IdentityUserData> {
    const response = await apiClient.get<unknown>(
      "/users/me",
      signal === undefined ? {} : { signal },
    );
    return parseApiResponse(response, identityUserDataSchema, 200).data;
  },
  async updateMe(body: UpdateProfileBody): Promise<IdentityUserData> {
    const response = await apiClient.patch<unknown>("/users/me", body);
    return parseApiResponse(response, identityUserDataSchema, 200).data;
  },
};
