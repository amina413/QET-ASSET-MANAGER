import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use project directory as root to avoid lockfile warning when multiple lockfiles exist
  turbopack: {
    root: process.cwd(),
  },
  // cPanel / shared hosting: disable image optimization (often not supported)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
