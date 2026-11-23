import { resolve } from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@urkundenwerk/core"],
};

export default nextConfig;
