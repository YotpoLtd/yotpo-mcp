import type { Capability } from "./types.js";
import { fetchBadges } from "../api/yotpo-client.js";

export const badges: Capability = (server) => {
  server.tool(
    "getBadges",
    `Fetch the list of Yotpo community badges.
<use_case>
Use this tool to retrieve all available Yotpo gamification badges that users can earn
through community engagement (writing reviews, gaining followers, etc.).
</use_case>
<important_notes>
This is a public endpoint that requires no authentication.
Returns a static list of 8 badge definitions with names, descriptions, and image URLs.
</important_notes>`,
    {},
    async () => {
      try {
        const data = await fetchBadges();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to fetch badges: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
};
