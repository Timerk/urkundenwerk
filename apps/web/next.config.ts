import { resolve } from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  // The renderer reads its font with `new URL("…", import.meta.url)`, which
  // the bundler emits as a server asset that the standalone output includes.
  transpilePackages: [
    "@urkundenwerk/ai",
    "@urkundenwerk/core",
    "@urkundenwerk/render",
  ],
  // PDFKit loads its default standard font from its own package directory, so
  // it must stay an external package that output tracing copies as a whole.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
