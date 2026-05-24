import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscoverClient } from "../../api/discover-client.js";
import type { DiscoverCapability } from "./index.js";

export const listPrompts: DiscoverCapability = (
  server: McpServer,
  client: DiscoverClient
) => {
  server.tool(
    "listPrompts",
    `List monitoring prompts for the store with pagination and optional filters.
<use_case>
Use this tool to retrieve prompts that are being monitored across LLM platforms.
Supports filtering by geographic location and LLM provider for targeted analysis.
</use_case>
<important_notes>
Requires authentication. Results are paginated — use limit and offset for navigation.
Filters can be combined for more targeted results.
</important_notes>`,
    {
      limit: z.number().optional().describe("Max results to return"),
      offset: z.number().optional().describe("Pagination offset"),
      geoLocations: z.array(z.string()).optional().describe("Filter by ISO country codes"),
      llmProviders: z.array(z.string()).optional().describe("Filter by LLM provider names (e.g. chatgpt, gemini)"),
    },
    async (params) => {
      try {
        const data = await client.listPrompts(params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to list prompts: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
};
