import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep verification builds separate from a running development server.
  distDir: process.env.ASTUNE_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Baseline CSP: preserve Next.js hydration and Leaflet's dynamic styles.
      // A script/style allowlist needs a separate nonce-based rendering design.
      { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'" },
    ] }];
  },
};
export default config;
