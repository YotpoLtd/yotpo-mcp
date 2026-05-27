# Discover Read-Only Analytics — Design Spec

## Context

The Yotpo MCP server currently has two trivial tools (`sayHello`, `getBadges`) with no authentication. We need to add authenticated access to the Discover Everywhere API to enable AI agents to query brand visibility analytics across LLM platforms.

This is a minimal viable iteration: 3 read-only tools to validate the auth + HTTP plumbing, forming the pattern for all future tools.

## Decisions

- **Auth**: Auth0 Client Credentials flow (M2M JWT)
- **Architecture**: Layered — auth module → discover client → MCP tools
- **Store ID**: Server-wide config (one MCP instance = one merchant)
- **Scope**: 3 tools — `getBrandIdentity`, `listPrompts`, `getPromptAnalytics`

## File Structure

```
src/
├── api/
│   ├── auth.ts                      # Auth0 token fetch + cache + refresh
│   ├── discover-client.ts           # Authenticated HTTP for Discover API
│   └── yotpo-client.ts              # (unchanged)
├── capabilities/
│   ├── discover/
│   │   ├── get-brand-identity.ts
│   │   ├── list-prompts.ts
│   │   ├── get-prompt-analytics.ts
│   │   └── index.ts                 # Exports array of discover capabilities
│   ├── index.ts                     # Updated to include discover tools
│   └── ...existing...
├── config/
│   └── env.ts                       # Extended with Auth0 + YOTPO_STORE_ID
└── server.ts                        # Updated instructions text
```

## Module Specifications

### 1. `src/config/env.ts` — Extended Environment

Add required fields:
```typescript
YOTPO_AUTH0_DOMAIN: z.string()        // e.g. "yotpo.auth0.com"
YOTPO_AUTH0_CLIENT_ID: z.string()
YOTPO_AUTH0_CLIENT_SECRET: z.string()
YOTPO_AUTH0_AUDIENCE: z.string()      // API audience identifier
YOTPO_STORE_ID: z.string()           // Store ID for all API calls
```

All new fields are required (no `.optional()`). The server should fail fast on startup if missing.

### 2. `src/api/auth.ts` — Auth0 Token Manager

Responsibilities:
- Fetch JWT via Auth0 Client Credentials grant
- Cache token in memory
- Auto-refresh when expired (check `exp` claim, refresh 60s before expiry)
- Expose `getToken(): Promise<string>`

Interface:
```typescript
export interface AuthConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
}

export function createAuthClient(config: AuthConfig): { getToken: () => Promise<string> }
```

Implementation details:
- Use native `fetch` (no extra deps)
- POST to `https://{domain}/oauth/token` with `grant_type: "client_credentials"`
- Parse JWT expiry from response `expires_in` field (don't decode JWT)
- Store `{ token, expiresAt }` in closure
- On `getToken()`: return cached if valid, else fetch new

### 3. `src/api/discover-client.ts` — Discover API Client

Responsibilities:
- Construct full URLs: `https://api.yotpo.com/discover/v3/stores/{storeId}/...`
- Attach `Authorization: Bearer <token>` header
- Handle HTTP errors consistently
- Expose typed methods for each endpoint

Interface:
```typescript
export interface DiscoverClientConfig {
  storeId: string;
  getToken: () => Promise<string>;
}

export interface DiscoverClient {
  getBrandIdentity(): Promise<unknown>;
  listPrompts(params?: ListPromptsParams): Promise<unknown>;
  getPromptAnalytics(params?: PromptAnalyticsParams): Promise<unknown>;
}

export interface ListPromptsParams {
  limit?: number;
  offset?: number;
  geoLocations?: string[];
  llmProviders?: string[];
}

export interface PromptAnalyticsParams {
  limit?: number;
  offset?: number;
  geoLocations?: string[];
  llmProviders?: string[];
  startDate?: string;
  endDate?: string;
  audienceIds?: number[];
  productCategoryIds?: number[];
  topicIds?: number[];
  journeyStages?: string[];
  scoreMin?: number;
  scoreMax?: number;
  searchQuery?: string;
  sort?: string;
  includeSummary?: boolean;
}

export function createDiscoverClient(config: DiscoverClientConfig): DiscoverClient
```

Implementation details:
- Base URL: `https://api.yotpo.com/discover/v3/stores/{storeId}`
- Query params: convert arrays to comma-separated, booleans to "true"/"false", omit undefined
- Throw descriptive errors on non-2xx responses (include status + body)

### 4. MCP Tools

Each tool follows the existing `Capability` pattern (function that takes `McpServer` and registers a tool).

#### `getBrandIdentity`
- No input parameters (store ID comes from config)
- Calls `discoverClient.getBrandIdentity()`
- Returns JSON response

#### `listPrompts`
- Optional params: `limit`, `offset`, `geoLocations`, `llmProviders`
- Calls `discoverClient.listPrompts(params)`
- Returns JSON with pagination

#### `getPromptAnalytics`
- Optional params: all fields from `PromptAnalyticsParams`
- Calls `discoverClient.getPromptAnalytics(params)`
- Returns JSON with analytics data + optional summary

Each tool:
- Defines a Zod schema for input validation
- Has a descriptive tool description with `<use_case>` and `<important_notes>` tags
- Returns `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }`
- On error returns `{ isError: true, content: [{ type: "text", text: errorMessage }] }`

### 5. Wiring

- `src/capabilities/discover/index.ts` exports an array of the 3 capabilities
- `src/capabilities/index.ts` imports and spreads the discover capabilities into the main array
- `src/server.ts` instructions updated to list new tools
- The discover client is instantiated once (using env config + auth client) and shared across all discover capabilities via closure or module-level singleton

### 6. Initialization Flow

```
loadEnv() → createAuthClient(env) → createDiscoverClient({ storeId, getToken })
                                            ↓
                              inject into discover capabilities
                                            ↓
                              register on McpServer
```

The discover client must be created before capabilities are registered. This means either:
- (A) Capabilities receive the client as a parameter: `(server, client) => void`
- (B) Module-level singleton initialized in `index.ts`

**Decision: (A)** — pass client to each capability factory. Extend the `Capability` type for discover tools:
```typescript
export type DiscoverCapability = (server: McpServer, client: DiscoverClient) => void;
```

The `src/capabilities/discover/index.ts` will export a function that takes `(server, client)` and registers all tools.

## Testing Strategy

- `src/api/auth.ts` — unit test with mocked fetch (verify token caching, refresh logic)
- `src/api/discover-client.ts` — unit test with mocked fetch (verify URL construction, param serialization, error handling)
- Tool files — unit test that tool registers correctly and handles success/error responses
- Integration: manual test with real credentials via `npm run dev`

## Verification

1. `npm run build` — compiles without errors
2. `npm test` — all tests pass
3. `npm run dev` with valid Auth0 credentials + store ID → server starts
4. Call `getBrandIdentity` via MCP client → returns brand data or clear auth error
5. Call `listPrompts` with pagination → returns paginated results
6. Call `getPromptAnalytics` with filters → returns analytics data
