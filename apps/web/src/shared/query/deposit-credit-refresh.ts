"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getSessionRuntime,
  type SessionScope,
} from "@/services/api/session-runtime";
import { financialQueryKey } from "./financial-query";

// Keep only the current page's operation identities; observations never patch money.
export function useDepositCreditRefresh({
  scope,
  items,
}: {
  scope: SessionScope;
  items: readonly { operationId: string }[] | undefined;
}) {
  const client = useQueryClient();
  const previous = useRef({ identity: "", operations: new Set<string>() });
  const identity = JSON.stringify([scope.epoch, scope.accountId, scope.role]);
  useEffect(() => {
    if (items === undefined || !getSessionRuntime().isCurrentCheck(scope))
      return;
    const known =
      previous.current.identity === identity
        ? previous.current.operations
        : new Set<string>();
    const operations = new Set(items.map((row) => row.operationId));
    previous.current = { identity, operations };
    if (![...operations].some((operation) => !known.has(operation))) return;
    const domains =
      scope.role === "USER"
        ? ["wallet", "ledger", "ledger-detail"]
        : ["finance", "finance-detail"];
    void client.invalidateQueries({
      queryKey: financialQueryKey(scope),
      predicate: (query) => domains.includes(String(query.queryKey[5])),
    });
  }, [client, scope, identity, items]);
}
