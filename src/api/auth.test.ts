import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { createAuthClient } from "./auth.js";

const mockConfig = {
  domain: "yotpo.auth0.com",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  audience: "https://api.yotpo.com",
};

describe("createAuthClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("fetches a token on first call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token-abc",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      })
    );

    const client = createAuthClient(mockConfig);
    const token = await client.getToken();

    expect(token).toBe("token-abc");
    expect(fetch).toHaveBeenCalledWith("https://yotpo.auth0.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        audience: "https://api.yotpo.com",
      }),
    });
  });

  it("returns cached token on second call when not expired", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token-abc",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      })
    );

    const client = createAuthClient(mockConfig);
    await client.getToken();
    const token = await client.getToken();

    expect(token).toBe("token-abc");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches a new token when cached token is expired", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token-1",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "token-2",
            expires_in: 3600,
            token_type: "Bearer",
          }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = createAuthClient(mockConfig);
    const first = await client.getToken();
    expect(first).toBe("token-1");

    // Advance time past expiration (3600 - 60 = 3540 seconds)
    vi.advanceTimersByTime(3540 * 1000 + 1);

    const second = await client.getToken();
    expect(second).toBe("token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      })
    );

    const client = createAuthClient(mockConfig);
    await expect(client.getToken()).rejects.toThrow(
      "Auth0 token request failed: 401 Unauthorized"
    );
  });

  it("throws on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const client = createAuthClient(mockConfig);
    await expect(client.getToken()).rejects.toThrow("Network error");
  });
});
