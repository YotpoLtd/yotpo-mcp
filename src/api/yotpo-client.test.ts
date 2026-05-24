import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBadges } from "./yotpo-client.js";

describe("yotpo-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchBadges", () => {
    it("returns parsed JSON on successful response", async () => {
      const mockResponse = {
        status: { code: 200, message: "OK" },
        response: {
          badges: [{ id: 1, name: "Newbie", description: "First review", image_300: "https://img/300.png", image_100: "https://img/100.png" }],
        },
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const result = await fetchBadges();

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith("https://api.yotpo.com/badges");
    });

    it("throws an error on non-OK response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }));

      await expect(fetchBadges()).rejects.toThrow(
        "Yotpo API error: 500 Internal Server Error"
      );
    });

    it("throws an error on network failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network timeout")));

      await expect(fetchBadges()).rejects.toThrow("Network timeout");
    });
  });
});
