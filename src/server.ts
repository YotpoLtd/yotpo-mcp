import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capabilities } from "./capabilities/index.js";

const SERVER_INFO = {
  name: "yotpo-mcp",
  version: "0.1.0",
};

const SERVER_INSTRUCTIONS = `You are connected to the Yotpo MCP Server.

This server provides tools for interacting with Yotpo's eCommerce marketing platform,
including reviews, loyalty programs, SMS marketing, subscriptions, and visual UGC.

Available capabilities:
- sayHello: Verify server connectivity and get a greeting
- getBadges: Fetch the list of Yotpo community gamification badges

When using these tools, prefer calling the most specific tool for the user's intent.
If a tool returns an error, report the error clearly without retrying unless explicitly asked.`;

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: SERVER_INSTRUCTIONS,
  });

  for (const capability of capabilities) {
    capability(server);
  }

  return server;
}
