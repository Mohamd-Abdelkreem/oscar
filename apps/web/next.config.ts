import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  typedRoutes: true,
  reactCompiler: true,
  logging: {
    incomingRequests: {
      ignore: [
        /^\/(?:employee\/)?auth\/(?:verify-email|reset-password)(?:[/?]|$)/u,
        /^\/admin\/auth\/accept-invitation(?:[/?]|$)/u,
      ],
    },
  },
  headers() {
    return [
      "/auth/verify-email",
      "/auth/reset-password",
      "/employee/auth/verify-email",
      "/employee/auth/reset-password",
      "/admin/auth/accept-invitation",
    ].map((source) => ({
      source,
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }));
  },
  transpilePackages: ["@template/contracts"],
  experimental: {
    // Bound prerender concurrency on memory-constrained build hosts.
    cpus: 2,
  },
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
};

export default nextConfig;
