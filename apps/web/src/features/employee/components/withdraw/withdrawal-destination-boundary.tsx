"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useWithdrawalDestinationLink } from "../../hooks/use-withdrawal-destination-link";

const DestinationLinkContext = createContext<ReturnType<
  typeof useWithdrawalDestinationLink
> | null>(null);
export const useDestinationLink = () => useContext(DestinationLinkContext);
export function WithdrawalDestinationBoundary({
  children,
}: {
  readonly children: ReactNode;
}) {
  const link = useWithdrawalDestinationLink(usePathname());
  return (
    <DestinationLinkContext value={link}>{children}</DestinationLinkContext>
  );
}
