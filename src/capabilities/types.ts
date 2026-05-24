import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type Capability = (server: McpServer) => void;
