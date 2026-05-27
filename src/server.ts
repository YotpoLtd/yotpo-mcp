import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from 'express';
import { capabilities } from "./capabilities/index.js";
import { loadEnv, type Env } from "./config/env.js";
import { createDiscoverClient } from "./api/discover-client.js";
import { registerDiscoverCapabilities } from "./capabilities/discover/index.js";
import { AuthContext, kongAuthMiddleware } from "./middleware/kong-auth.js";

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

export function createServer(authContext: AuthContext): McpServer {
  const env = loadEnv();

  if (!authContext.storeId) {
    throw new Error('Missing store identity');
  }

  if (!/^[a-zA-Z0-9\-_]+$/.test(authContext.storeId)) {
    throw new Error('Invalid store identity format');
  }

  const discoverClient = createDiscoverClient({
    storeId: authContext.storeId,
    baseUrl: env.DISCOVER_API_BASE_URL,
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

export function createApp(_env: Env) {
  void _env;
  const app = express();

  app.use(kongAuthMiddleware());

  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const authContext = (req as Request & { authContext: AuthContext }).authContext;
      createServer(authContext);

      res.status(200).json({
        context: {
          storeId: authContext.storeId,
          authContext: {
            storeId: authContext.storeId,
            userEmail: authContext.userEmail,
            externalUserId: authContext.externalUserId,
            agencyId: authContext.agencyId,
            organizationKey: authContext.organizationKey,
          },
        },
      });
    } catch (error) {
      res.status(401).json({
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication failed',
      });
    }
  });

  return app;
}
