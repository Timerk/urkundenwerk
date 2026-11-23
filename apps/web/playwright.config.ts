import { defineConfig, devices } from "@playwright/test";

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
    env: { HOSTNAME: hostname, PORT: String(port) },
    url: baseURL,
    reuseExistingServer: false,
  },
});
