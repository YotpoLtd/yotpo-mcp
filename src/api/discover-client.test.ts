import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDiscoverClient } from "./discover-client.js";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

function createClient(storeId = "my-store") {
  return createDiscoverClient({ storeId });
}

function mockSuccessResponse(data: unknown = { ok: true }) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockErrorResponse(status: number, body: string) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

describe("discover-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL construction", () => {
    it("uses correct base URL with store ID", async () => {
      mockSuccessResponse();
      const client = createClient("my-store");

      await client.getBrandIdentity();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.yotpo.com/discover/v3/stores/my-store/brand-identity",
        expect.any(Object)
      );
    });

    it("calls /prompts path for listPrompts", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.listPrompts();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/prompts");
    });

    it("calls /prompt-analytics path for getPromptAnalytics", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.getPromptAnalytics();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/prompt-analytics");
    });
  });

  // Authorization header tests removed as per OAuth Pivot design
  // We no longer use token injection, relying on Kong headers instead

  describe("query param serialization", () => {
    it("serializes arrays as comma-separated values", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.listPrompts({ geoLocations: ["US", "UK"] });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("geoLocations=US%2CUK");
    });

    it("serializes numbers as strings", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.listPrompts({ limit: 10, offset: 5 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=5");
    });

    it("omits undefined values", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.listPrompts({ limit: 10, offset: undefined });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("limit=10");
      expect(url).not.toContain("offset");
    });

    it("serializes includeSummary as include=summary", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.getPromptAnalytics({ includeSummary: true });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("include=summary");
      expect(url).not.toContain("includeSummary");
    });

    it("does not add include param when includeSummary is false", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.getPromptAnalytics({ includeSummary: false });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("include");
    });

    it("serializes string params directly", async () => {
      mockSuccessResponse();
      const client = createClient();

      await client.getPromptAnalytics({ searchQuery: "shoes", sort: "score" });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("searchQuery=shoes");
      expect(url).toContain("sort=score");
    });
  });

  describe("error handling", () => {
    it("throws on non-2xx response with status and body", async () => {
      mockErrorResponse(404, "Not found");
      const client = createClient();

      await expect(client.getBrandIdentity()).rejects.toThrow(
        "Discover API error: 404 Not found"
      );
    });

    it("throws on 500 errors", async () => {
      mockErrorResponse(500, "Internal server error");
      const client = createClient();

      await expect(client.listPrompts()).rejects.toThrow(
        "Discover API error: 500 Internal server error"
      );
    });
  });

  describe("successful responses", () => {
    it("returns parsed JSON on success", async () => {
      const data = { brand: "Acme" };
      mockSuccessResponse(data);
      const client = createClient();

      const result = await client.getBrandIdentity();

      expect(result).toEqual(data);
    });
  });
});
