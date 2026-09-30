import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/app/providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Relay — Full-stack TypeScript starter",
    template: "%s | Relay",
  },
  description:
    "An authentication-ready Next.js, Express, and PostgreSQL TypeScript foundation.",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
