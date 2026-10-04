"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { UpdateProfileBody } from "@template/contracts";

import { sessionQueryKey } from "@/features/auth/hooks/auth.hooks";
import { useCredentialCommand } from "@/features/auth/hooks/credential-commands.hooks";
import { getSessionRuntime } from "@/services/api/session-runtime";

import { usersApi } from "../api/users.api";

export const useUpdateProfile = () => {
  const client = useQueryClient();
  return useCredentialCommand(
    "update-profile",
    async (body: UpdateProfileBody) => {
      const runtime = getSessionRuntime();
      const scope = runtime.scope();
      const account = await usersApi.updateMe(body);
      runtime.assertCurrent(scope);
      runtime.admitIdentity(scope, account.user);
      client.setQueryData(sessionQueryKey(runtime.scope()), account);
      return account;
    },
  );
};
