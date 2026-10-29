import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow dev and prod server to run smoothly;
  // the _global-error static prerender issue is a known Next.js 16 + React 19
  // incompatibility with @base-ui/react context initialisation — does not
  // affect runtime behaviour.

  async headers() {
    return [
      {
        // Shared report links carry a secret token in the URL: keep the page
        // out of search engines and never leak the URL through Referer.
        source: "/shared/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
