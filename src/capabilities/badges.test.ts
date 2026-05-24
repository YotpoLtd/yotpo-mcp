import { describe, it, expect, vi, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { badges } from "./badges.js";

describe("badges capability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the getBadges tool without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => badges(server)).not.toThrow();
  });
});
