import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

  app.use(express.json());
  app.use(kongAuthMiddleware());

  app.post('/mcp', async (req: Request, res: Response) => {
    const authContext = (req as Request & { authContext?: AuthContext }).authContext;
    if (!authContext) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication context',
      });
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createServer(authContext);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP HTTP handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'MCP request failed',
        });
      }
    } finally {
      try {
        await server.close();
      } catch (closeError) {
        console.error('MCP server shutdown error:', closeError);
      }
    }
  });

  return app;
}
