import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  const validEnv: Record<string, string> = {
    YOTPO_AUTH0_DOMAIN: "yotpo.auth0.com",
    YOTPO_AUTH0_CLIENT_ID: "test-client-id",
    YOTPO_AUTH0_AUDIENCE: "https://api.yotpo.com",
    DISCOVER_API_BASE_URL: "https://api.yotpo.com/discover/v3/stores",
    MCP_BASE_URL: "https://mcp.yotpo.com",
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function envWithout(key: string): Record<string, string> {
    return Object.fromEntries(
      Object.entries(validEnv).filter(([k]) => k !== key)
    );
  }

  it("succeeds when all required fields are present", () => {
    process.env = { ...validEnv };
    const env = loadEnv();
    expect(env.YOTPO_AUTH0_DOMAIN).toBe("yotpo.auth0.com");
    expect(env.DISCOVER_API_BASE_URL).toBe("https://api.yotpo.com/discover/v3/stores");
  });

  it("throws when YOTPO_AUTH0_DOMAIN is missing", () => {
    process.env = envWithout("YOTPO_AUTH0_DOMAIN");
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when YOTPO_AUTH0_CLIENT_ID is missing", () => {
    process.env = envWithout("YOTPO_AUTH0_CLIENT_ID");
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when DISCOVER_API_BASE_URL is missing", () => {
    process.env = envWithout("DISCOVER_API_BASE_URL");
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when MCP_BASE_URL is missing", () => {
    process.env = envWithout("MCP_BASE_URL");
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when YOTPO_AUTH0_AUDIENCE is missing", () => {
    process.env = envWithout("YOTPO_AUTH0_AUDIENCE");
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });
});
