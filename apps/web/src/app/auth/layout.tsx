import type { ReactNode } from "react";

import { GuestOnlyRoute } from "@/components/auth/guest-only-route";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <GuestOnlyRoute>{children}</GuestOnlyRoute>;
}
