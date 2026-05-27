import { describe, it, expect, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscoverClient } from "../../api/discover-client.js";
import { getBrandIdentity } from "./get-brand-identity.js";
import { listPrompts } from "./list-prompts.js";
import { getPromptAnalytics } from "./get-prompt-analytics.js";
import { registerDiscoverCapabilities } from "./index.js";

function createMockServer() {
  return { tool: vi.fn() } as unknown as McpServer;
}

function createMockClient(overrides: Partial<DiscoverClient> = {}): DiscoverClient {
  return {
    getBrandIdentity: vi.fn().mockResolvedValue({ name: "Test Brand" }),
    listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
    getPromptAnalytics: vi.fn().mockResolvedValue({ analytics: [] }),
    ...overrides,
  };
}

describe("getBrandIdentity capability", () => {
  it("registers the tool on the server", () => {
    const server = createMockServer();
    const client = createMockClient();
    getBrandIdentity(server, client);
    expect(server.tool).toHaveBeenCalledWith(
      "getBrandIdentity",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns brand identity data on success", async () => {
    const server = createMockServer();
    const mockData = { name: "Acme", url: "https://acme.com", mission: "Be great" };
    const client = createMockClient({ getBrandIdentity: vi.fn().mockResolvedValue(mockData) });
    getBrandIdentity(server, client);

    const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const result = await handler({});

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockData, null, 2) }],
    });
  });

  it("returns isError response on failure", async () => {
    const server = createMockServer();
    const client = createMockClient({
      getBrandIdentity: vi.fn().mockRejectedValue(new Error("Network error")),
    });
    getBrandIdentity(server, client);

    const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network error");
  });
});

describe("listPrompts capability", () => {
  it("registers the tool on the server", () => {
    const server = createMockServer();
    const client = createMockClient();
    listPrompts(server, client);
    expect(server.tool).toHaveBeenCalledWith(
      "listPrompts",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns prompts data on success", async () => {
    const server = createMockServer();
    const mockData = { prompts: [{ id: 1, text: "test prompt" }] };
    const client = createMockClient({ listPrompts: vi.fn().mockResolvedValue(mockData) });
    listPrompts(server, client);

    const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const result = await handler({ limit: 10, offset: 0 });

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockData, null, 2) }],
    });
    expect(client.listPrompts).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });

  it("returns isError response on failure", async () => {
    const server = createMockServer();
    const client = createMockClient({
      listPrompts: vi.fn().mockRejectedValue(new Error("Unauthorized")),
    });
    listPrompts(server, client);

    const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unauthorized");
  });
});

describe("getPromptAnalytics capability", () => {
  it("registers the tool on the server", () => {
    const server = createMockServer();
    const client = createMockClient();
    getPromptAnalytics(server, client);
    expect(server.tool).toHaveBeenCalledWith(
      "getPromptAnalytics",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("returns analytics data on success", async () => {
    const server = createMockServer();
    const mockData = { analytics: [{ promptId: 1, score: 85 }], summary: { avg: 85 } };
    const client = createMockClient({ getPromptAnalytics: vi.fn().mockResolvedValue(mockData) });
    getPromptAnalytics(server, client);

    const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const result = await handler({ scoreMin: 50, includeSummary: true });

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(mockData, null, 2) }],
    });
    expect(client.getPromptAnalytics).toHaveBeenCalledWith({ scoreMin: 50, includeSummary: true });
  });

  it("returns isError response on failure", async () => {
    const server = createMockServer();
    const client = createMockClient({
      getPromptAnalytics: vi.fn().mockRejectedValue(new Error("Timeout")),
    });
    getPromptAnalytics(server, client);

    const handler = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0][3];
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Timeout");
  });
});

describe("registerDiscoverCapabilities", () => {
  it("registers all three discover tools", () => {
    const server = createMockServer();
    const client = createMockClient();
    registerDiscoverCapabilities(server, client);
    expect(server.tool).toHaveBeenCalledTimes(3);
    expect((server.tool as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("getBrandIdentity");
    expect((server.tool as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe("listPrompts");
    expect((server.tool as ReturnType<typeof vi.fn>).mock.calls[2][0]).toBe("getPromptAnalytics");
  });
});
