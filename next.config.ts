import type { NextConfig } from "next";

const isDocker = process.env.BUILD_TARGET === "docker";

const nextConfig: NextConfig = {
  // Standalone server for the Cloud Run image (same pattern as marketing-app).
  output: isDocker ? "standalone" : undefined,
  // Two dev servers on one checkout corrupt a shared .next (turbopack write
  // conflicts). Verification instances set NEXT_DIST_DIR to stay isolated.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep puppeteer external to the server bundle; it resolves chromium at runtime.
  serverExternalPackages: ["puppeteer"],
  // The dev-tools badge sits exactly over the nav rail's avatar; keep demo
  // runs from `next dev` clean.
  devIndicators: false,
};

export default nextConfig;
