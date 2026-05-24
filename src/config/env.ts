import { z } from "zod";

const envSchema = z.object({
  YOTPO_APP_KEY: z.string().optional(),
  YOTPO_SECRET_KEY: z.string().optional(),
  YOTPO_AUTH0_DOMAIN: z.string(),
  YOTPO_AUTH0_CLIENT_ID: z.string(),
  YOTPO_AUTH0_CLIENT_SECRET: z.string(),
  YOTPO_AUTH0_AUDIENCE: z.string(),
  YOTPO_STORE_ID: z.string(),
  MCP_TRANSPORT: z.enum(["stdio", "sse"]).default("stdio"),
  MCP_PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
