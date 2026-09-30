import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateProfileBody } from "@template/contracts";

import { AUTH_SESSION_QUERY_KEY } from "@/features/auth/hooks/auth.hooks";

import { usersApi } from "../api/users.api";

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileBody) => usersApi.updateMe(body),
    onSuccess: (account) => {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    },
  });
};
