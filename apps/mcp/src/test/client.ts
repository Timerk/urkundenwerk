import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer, type ServerDependencies } from "../server";

/** Connects an MCP client to a fresh server over the in-memory transport. */
export async function connect(deps: ServerDependencies) {
  const server = createServer({ log: () => undefined, ...deps });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "urkundenwerk-test", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text?: string }[];
    return {
      result,
      isError: result.isError === true,
      text: content.find((block) => block.type === "text")?.text ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: result.structuredContent as any,
    };
  }

  return {
    client,
    call,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
