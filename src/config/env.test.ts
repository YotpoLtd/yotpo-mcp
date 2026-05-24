import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  const validEnv = {
    YOTPO_AUTH0_DOMAIN: "yotpo.auth0.com",
    YOTPO_AUTH0_CLIENT_ID: "test-client-id",
    YOTPO_AUTH0_CLIENT_SECRET: "test-client-secret",
    YOTPO_AUTH0_AUDIENCE: "https://api.yotpo.com",
    YOTPO_STORE_ID: "store-123",
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("succeeds when all required fields are present", () => {
    process.env = { ...validEnv };
    const env = loadEnv();
    expect(env.YOTPO_AUTH0_DOMAIN).toBe("yotpo.auth0.com");
    expect(env.YOTPO_STORE_ID).toBe("store-123");
  });

  it("throws when YOTPO_AUTH0_DOMAIN is missing", () => {
    const { YOTPO_AUTH0_DOMAIN: _, ...rest } = validEnv;
    process.env = { ...rest };
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when YOTPO_AUTH0_CLIENT_ID is missing", () => {
    const { YOTPO_AUTH0_CLIENT_ID: _, ...rest } = validEnv;
    process.env = { ...rest };
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when YOTPO_AUTH0_CLIENT_SECRET is missing", () => {
    const { YOTPO_AUTH0_CLIENT_SECRET: _, ...rest } = validEnv;
    process.env = { ...rest };
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when YOTPO_AUTH0_AUDIENCE is missing", () => {
    const { YOTPO_AUTH0_AUDIENCE: _, ...rest } = validEnv;
    process.env = { ...rest };
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });

  it("throws when YOTPO_STORE_ID is missing", () => {
    const { YOTPO_STORE_ID: _, ...rest } = validEnv;
    process.env = { ...rest };
    expect(() => loadEnv()).toThrow("Invalid environment configuration");
  });
});
