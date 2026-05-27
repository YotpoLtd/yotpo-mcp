#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp, createServer } from "./server.js";
import { loadEnv } from "./config/env.js";

async function main(): Promise<void> {
  const env = loadEnv();

  if (env.MCP_TRANSPORT === "stdio") {
    const storeId = env.YOTPO_STORE_ID!;
    const server = createServer({ storeId });
    const transport = new StdioServerTransport();
    transport.onerror = (error) => {
      console.error("MCP stdio transport error:", error);
      process.exit(1);
    };
    await server.connect(transport);
    process.stdin.once("end", () => {
      void server.close().then(
        () => process.exit(0),
        (err) => {
          console.error("MCP server close error after stdin end:", err);
          process.exit(1);
        }
      );
    });
  } else if (env.MCP_TRANSPORT === "sse") {
    const app = createApp(env);
    app.listen(env.MCP_PORT, () => {
      console.log(`Yotpo MCP HTTP server listening on port ${env.MCP_PORT}`);
    });
  } else {
    throw new Error(`Unsupported MCP_TRANSPORT: ${env.MCP_TRANSPORT}`);
  }
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
