import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep verification builds separate from a running development server.
  distDir: process.env.ASTUNE_NEXT_DIST_DIR || ".next",
};
export default config;
