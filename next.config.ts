import type { NextConfig } from "next";

const repo = 'lewis-player';
const nextConfig: NextConfig = {
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
