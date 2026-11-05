"use client";

import type { CurrentUser } from "@nangman/shared-types";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { getCurrentUser, logout } from "./api";

const CURRENT_USER_QUERY_KEY = ["auth", "me"] as const;

/** data가 null이면 로그인 안 된 상태 — 에러가 아니라 정상적인 결과값으로 다룬다. */
export function useCurrentUser(): UseQueryResult<CurrentUser | null, Error> {
  return useQuery({ queryKey: CURRENT_USER_QUERY_KEY, queryFn: getCurrentUser, retry: false });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, null);
      void queryClient.invalidateQueries({ queryKey: ["architectures"] });
    },
  });
}
