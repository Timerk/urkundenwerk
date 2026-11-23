import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { parseConfig } from "./config";
import { todayInGermany } from "./domain";
import { createServer, SERVER_NAME } from "./server";
import { signIn } from "./session";
import { createSupabaseStore } from "./store";

// stdout carries the MCP protocol: every diagnostic goes to stderr, and none
// of them contains credentials or document data.
function log(message: string): void {
  console.error(`[${SERVER_NAME}] ${message}`);
}

async function main(): Promise<void> {
  const config = parseConfig(process.env);
  const session = await signIn(config);
  log(
    `signed in; serving stdio${config.exportDir ? " with exports to disk enabled" : ""}`,
  );

  const handle = serveStdio(() =>
    createServer({
      context: {
        store: createSupabaseStore(session.client, session.userId),
        today: () => todayInGermany(),
        exportDir: config.exportDir,
      },
      ensureSession: () => session.ensureActive(),
      log,
    }),
  );

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await handle.close().catch(() => undefined);
    await session.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("end", shutdown);
}

main().catch((error: unknown) => {
  log(error instanceof Error ? error.message : "failed to start");
  process.exit(1);
});
