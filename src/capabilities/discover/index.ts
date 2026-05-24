import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscoverClient } from "../../api/discover-client.js";
import { getBrandIdentity } from "./get-brand-identity.js";
import { listPrompts } from "./list-prompts.js";
import { getPromptAnalytics } from "./get-prompt-analytics.js";

export type DiscoverCapability = (server: McpServer, client: DiscoverClient) => void;

export function registerDiscoverCapabilities(server: McpServer, client: DiscoverClient): void {
  getBrandIdentity(server, client);
  listPrompts(server, client);
  getPromptAnalytics(server, client);
}
