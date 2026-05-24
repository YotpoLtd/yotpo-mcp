import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capabilities } from "./capabilities/index.js";
import { loadEnv } from "./config/env.js";
import { createAuthClient } from "./api/auth.js";
import { createDiscoverClient } from "./api/discover-client.js";
import { registerDiscoverCapabilities } from "./capabilities/discover/index.js";

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
- getBrandIdentity: Get the store's brand identity profile
- listPrompts: List monitoring prompts with filters
- getPromptAnalytics: Get visibility analytics across LLM platforms

When using these tools, prefer calling the most specific tool for the user's intent.
If a tool returns an error, report the error clearly without retrying unless explicitly asked.`;

export function createServer(): McpServer {
  const env = loadEnv();

  const authClient = createAuthClient({
    domain: env.YOTPO_AUTH0_DOMAIN,
    clientId: env.YOTPO_AUTH0_CLIENT_ID,
    clientSecret: env.YOTPO_AUTH0_CLIENT_SECRET,
    audience: env.YOTPO_AUTH0_AUDIENCE,
  });

  const discoverClient = createDiscoverClient({
    storeId: env.YOTPO_STORE_ID,
    getToken: authClient.getToken,
  });

  const server = new McpServer(SERVER_INFO, {
    instructions: SERVER_INSTRUCTIONS,
  });

  for (const capability of capabilities) {
    capability(server);
  }

  registerDiscoverCapabilities(server, discoverClient);

  return server;
}
