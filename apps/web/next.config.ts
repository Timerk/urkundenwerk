import { resolve } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const workspaceRoot = resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The proxy supplies the full nonce policy on production pages.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  outputFileTracingRoot: workspaceRoot,
  // The renderer reads its font with `new URL("…", import.meta.url)`, which
  // the bundler emits as a server asset that the standalone output includes.
  transpilePackages: [
    "@urkundenwerk/ai",
    "@urkundenwerk/core",
    "@urkundenwerk/extraction",
    "@urkundenwerk/render",
  ],
  experimental: {
    // Contract uploads go to a server action. The limit leaves room for the
    // multipart overhead above MAX_UPLOAD_BYTES (src/lib/import/limits.ts),
    // which the action checks again before reading the file.
    serverActions: { bodySizeLimit: "5mb" },
    // The proxy buffers request bodies up to this size before the action
    // sees them; keep it in step with the action's limit.
    proxyClientMaxBodySize: "5mb",
  },
  // PDFKit loads its default standard font from its own package directory, so
  // it must stay an external package that output tracing copies as a whole.
  serverExternalPackages: ["pdfkit", "xmllint-wasm"],
  outputFileTracingIncludes: {
    "/app/documents/*/export": [
      // xmllint-wasm starts a worker that loads the WASM file alongside it.
      "../../node_modules/.pnpm/xmllint-wasm@*/node_modules/xmllint-wasm/xmllint*",
    ],
  },
};

// Resolves the per-request locale and messages from src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
