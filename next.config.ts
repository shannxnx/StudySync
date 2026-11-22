import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/materials/upload": [
      "./scripts/extract-pdf.cjs",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/@napi-rs/**/*",
    ],
  },
  experimental: {
    agentFeedback: true,
    // Limit simultaneous prerender writes in Windows synced workspaces.
    ...(process.platform === "win32" ? { cpus: 2 } : {}),
    proxyClientMaxBodySize: "21mb",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
