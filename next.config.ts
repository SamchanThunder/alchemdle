import type { NextConfig } from "next";

// Set NEXT_PUBLIC_BASE_PATH (e.g. "/alchemdle") when hosting under a sub-path
// such as GitHub Pages. Runtime fetches/icons read the same variable.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
