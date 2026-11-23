import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The standalone server does not read .env files. Locally, pass on the values
// written by `pnpm db:env`; CI sets the variables directly.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const port = 3100;
const hostname = "127.0.0.1";
const baseURL = `http://${hostname}:${port}`;

export default defineConfig({
  testDir: "./e2e",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node .next/standalone/apps/web/server.js",
    // The scripted AI provider answers explanations without the network, so
    // no test can spend money, even with a key in .env.local.
    env: { HOSTNAME: hostname, PORT: String(port), AI_PROVIDER: "fake" },
    url: baseURL,
    reuseExistingServer: false,
  },
});
