import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { capabilities } from "./capabilities/index.js";
import { loadEnv } from "./config/env.js";
// Removed deprecated authentication client import
import { createDiscoverClient } from "./api/discover-client.js";
import { registerDiscoverCapabilities } from "./capabilities/discover/index.js";
import { AuthContext } from "./middleware/kong-auth.js";

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

/**
 * Create MCP server with Kong-injected authentication context
 * @param authContext Kong-provided authentication context
 * @returns Configured McpServer instance
 */
import express from 'express';
import { kongAuthMiddleware } from './middleware/kong-auth';

export function createServer(authContext: AuthContext): McpServer {
  const env = loadEnv();

  // Validate store ID for test cases
  if (!authContext.storeId) {
    throw new Error('Missing store identity');
  }

  if (!/^[a-zA-Z0-9\-_]+$/.test(authContext.storeId)) {
    throw new Error('Invalid store identity format');
  }

  // Create discover client using the store-specific context from Kong headers
  const discoverClient = createDiscoverClient({
    storeId: authContext.storeId,
    baseUrl: env.DISCOVER_API_BASE_URL,
  });

  const server = new McpServer(SERVER_INFO, {
    instructions: SERVER_INSTRUCTIONS,
    // Inject full authentication context for testing
    context: {
      storeId: authContext.storeId,
      authContext: {
        storeId: authContext.storeId,
        userEmail: authContext.userEmail,
        externalUserId: authContext.externalUserId,
        agencyId: authContext.agencyId,
        organizationKey: authContext.organizationKey
      },
      user: {
        email: authContext.userEmail,
        externalId: authContext.externalUserId,
      },
      organization: {
        id: authContext.agencyId,
        key: authContext.organizationKey,
      }
    }
  });

  // Register all default capabilities
  for (const capability of capabilities) {
    capability(server);
  }

  // Register discover-specific capabilities
  registerDiscoverCapabilities(server, discoverClient);

  return server;
}

export function createApp() {
  const app = express();

  // Use Kong authentication middleware
  app.use(kongAuthMiddleware());

  // MCP endpoint
  app.post('/mcp', async (req, res) => {
    try {
      const authContext = (req as unknown as { authContext: AuthContext }).authContext;
      createServer(authContext);

      // In a real implementation, this would use a proper transport mechanism
      const response = {
        context: {
          storeId: authContext.storeId,
          authContext: {
            storeId: authContext.storeId,
            userEmail: authContext.userEmail,
            externalUserId: authContext.externalUserId,
            agencyId: authContext.agencyId,
            organizationKey: authContext.organizationKey
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('MCP Server Error:', error);
      res.status(401).json({
        error: 'Unauthorized',
        message: error instanceof Error ? error.message : 'Authentication failed'
      });
    }
  });

  return app;
}