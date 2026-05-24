#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadEnv } from "./config/env.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const server = createServer();

  if (env.MCP_TRANSPORT === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    throw new Error(
      `SSE transport not yet implemented. Use MCP_TRANSPORT=stdio.`
    );
  }
}

main().catch((error) => {
  console.error("Fatal error starting MCP server:", error);
  process.exit(1);
});
