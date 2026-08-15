import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/*": ["./knowledge/*.md", "./knowledge/*.json"],
  },
  outputFileTracingExcludes: {
    "/api/*": ["./data/**"],
  },
  serverExternalPackages: ["better-sqlite3", "@lancedb/lancedb"],
};

export default nextConfig;
