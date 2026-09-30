import type { AuthUserData, UpdateProfileBody } from "@template/contracts";

import { apiClient, type ApiResponse } from "@/services/api/api-client";

export const usersApi = {
  async getMe(): Promise<AuthUserData> {
    const response =
      await apiClient.get<ApiResponse<AuthUserData>>("/users/me");
    return response.data.data;
  },
  async updateMe(body: UpdateProfileBody): Promise<AuthUserData> {
    const response = await apiClient.patch<ApiResponse<AuthUserData>>(
      "/users/me",
      body,
    );
    return response.data.data;
  },
};
