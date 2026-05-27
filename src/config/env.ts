import { z } from "zod";

const envSchema = z.object({
  // OAuth and API Configuration
  DISCOVER_API_BASE_URL: z.string().url().describe("Base URL for the Discover API"),
  MCP_BASE_URL: z.string().url().describe("Base URL for the MCP server"),

  // Auth Configuration
  YOTPO_AUTH0_DOMAIN: z.string().min(1).describe("Auth0 domain for authentication"),
  YOTPO_AUTH0_CLIENT_ID: z.string().min(1).describe("Client ID for Auth0 authentication"),
  YOTPO_AUTH0_AUDIENCE: z.string().min(1).describe("Audience for Auth0 token"),

  // Kong Configuration
  KONG_ADMIN_URL: z.string().url().optional().describe("Optional Kong admin URL for API gateway configuration"),

  // System Configuration
  MCP_TRANSPORT: z.enum(["stdio", "sse"]).default("stdio").describe("Transport mechanism for MCP"),
  MCP_PORT: z.coerce.number().default(3000).describe("Port for MCP server"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info").describe("Logging verbosity level"),

  // Test Configuration
  NODE_ENV: z.enum(["development", "test", "production"]).default("development").describe("Current environment"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => {
        const path = i.path.join(".");
        return `  ${path ? path + ": " : ""}${i.message}`;
      })
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}