import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { helloWorld } from "./hello-world.js";

describe("helloWorld capability", () => {
  it("registers the sayHello tool on the server", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => helloWorld(server)).not.toThrow();
  });
});
