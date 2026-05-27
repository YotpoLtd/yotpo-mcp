import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscoverClient } from "../../api/discover-client.js";
import type { DiscoverCapability } from "./index.js";

export const getBrandIdentity: DiscoverCapability = (
  server: McpServer,
  client: DiscoverClient
) => {
  server.tool(
    "getBrandIdentity",
    `Retrieve the brand's identity profile from Yotpo Discover.
<use_case>
Use this tool to fetch the store's brand identity including name, URL, mission statement,
brand values, and associated keywords. Useful for understanding how the brand presents
itself across AI-powered discovery platforms.
</use_case>
<important_notes>
Requires authentication. The store ID is derived from server configuration.
Returns a single brand identity object with name, URL, mission, values, and keywords.
</important_notes>`,
    {},
    async () => {
      try {
        const data = await client.getBrandIdentity();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to fetch brand identity: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
};
