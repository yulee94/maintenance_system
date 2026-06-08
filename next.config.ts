import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  outputFileTracingIncludes: {
    "/api/**/*": ["./docs/templates/**/*", "./storage/**/*"]
  }
};

export default nextConfig;
