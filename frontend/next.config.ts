import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev and prod server to run smoothly;
  // the _global-error static prerender issue is a known Next.js 16 + React 19
  // incompatibility with @base-ui/react context initialisation — does not
  // affect runtime behaviour.
};

export default nextConfig;
