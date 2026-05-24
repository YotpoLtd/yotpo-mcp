import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscoverClient } from "../../api/discover-client.js";
import type { DiscoverCapability } from "./index.js";

export const getPromptAnalytics: DiscoverCapability = (
  server: McpServer,
  client: DiscoverClient
) => {
  server.tool(
    "getPromptAnalytics",
    `Retrieve visibility analytics for prompts across LLM platforms with rich filtering.
<use_case>
Use this tool to analyze how prompts perform across different LLM providers, geographies,
audience segments, and customer journey stages. Supports date ranges, score filtering,
text search, sorting, and optional aggregate summary statistics.
</use_case>
<important_notes>
Requires authentication. Results are paginated — use limit and offset for navigation.
Score values range from 0 to 100. Journey stages are: awareness, consideration, decision.
Use includeSummary to get aggregate statistics alongside individual results.
</important_notes>`,
    {
      limit: z.number().optional().describe("Max results to return"),
      offset: z.number().optional().describe("Pagination offset"),
      geoLocations: z.array(z.string()).optional().describe("Filter by ISO country codes"),
      llmProviders: z.array(z.string()).optional().describe("Filter by LLM provider names (e.g. chatgpt, gemini)"),
      startDate: z.string().optional().describe("ISO date string for range start"),
      endDate: z.string().optional().describe("ISO date string for range end"),
      audienceIds: z.array(z.number()).optional().describe("Filter by audience IDs"),
      productCategoryIds: z.array(z.number()).optional().describe("Filter by product category IDs"),
      topicIds: z.array(z.number()).optional().describe("Filter by topic IDs"),
      journeyStages: z.array(z.enum(["awareness", "consideration", "decision"])).optional().describe("Filter by customer journey stages"),
      scoreMin: z.number().min(0).max(100).optional().describe("Minimum visibility score"),
      scoreMax: z.number().min(0).max(100).optional().describe("Maximum visibility score"),
      searchQuery: z.string().optional().describe("Text search on prompt text"),
      sort: z.string().optional().describe("Sort field and direction, e.g. 'score:desc'"),
      includeSummary: z.boolean().optional().describe("Include aggregate summary stats"),
    },
    async (params) => {
      try {
        const data = await client.getPromptAnalytics(params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to fetch prompt analytics: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
};
