# OAuth Pivot — Design Spec

## Context

The Yotpo MCP server currently uses M2M Client Credentials (env vars) for authentication. This works for internal/dev use but doesn't serve the target use case: merchants installing the MCP server in Claude and authenticating with their Yotpo account.

This spec pivots the auth layer to OAuth Authorization Code + PKCE, where:
- The MCP server is deployed as an HTTP service behind Kong
- Merchants add it by URL in Claude
- Claude handles the OAuth browser flow (login → consent → token)
- Kong validates the JWT and injects trusted identity headers
- The MCP server reads identity from Kong's `X-Introspection-*` headers
- Internal VPC calls to Discover API require no additional auth

The discover-client interface and MCP tools remain unchanged in contract — only how they receive auth context changes.

## Architecture

```
┌─────────────────────────────────────┐
│          Claude (MCP Client)        │
│  - Initiates OAuth flow             │
│  - Stores tokens                    │
│  - Attaches Bearer token to calls   │
│  - Handles refresh automatically    │
└──────────────────┬──────────────────┘
                   │ HTTPS + Bearer JWT
┌──────────────────▼──────────────────┐
│    Kong API Gateway (public-facing) │
│                                     │
│  kong-v3-yotpo-auth-v2 plugin:      │
│  1. Validate JWT signature (JWKS)   │
│  2. Check exp/nbf claims            │
│  3. Extract store_id from           │
│     https://yotpo.com/store_id      │
│  4. Verify store_id matches URL     │
│  5. Strip Authorization header      │
│  6. Inject X-Introspection-* hdrs   │
│                                     │
│  OAuth endpoints (proxied to Auth0):│
│  /authorize → Auth0 login           │
│  /token     → Auth0 token exchange  │
│  /register  → dynamic client reg    │
└──────────────────┬──────────────────┘
                   │ X-Introspection-Store-Id
                   │ X-Introspection-User-Email
                   │ X-Introspection-External-User-Id
┌──────────────────▼──────────────────┐
│     Yotpo MCP Server (VPC)          │
│                                     │
│  - Reads X-Introspection-Store-Id   │
│  - No JWT validation (Kong did it)  │
│  - Creates per-request MCP context  │
│  - Calls Discover API directly      │
└──────────────────┬──────────────────┘
                   │ Direct VPC call (no auth needed)
┌──────────────────▼──────────────────┐
│    discover-everywhere-api (NestJS) │
└─────────────────────────────────────┘
```

## Token Flow

1. Claude discovers the MCP server supports OAuth (via `/.well-known/oauth-protected-resource` served by Kong)
2. Claude registers as a client via `/register` (dynamic client registration, proxied by Kong to Auth0)
3. Claude opens browser → Kong's `/authorize` → redirects to Auth0 login
4. Merchant logs in → Auth0 redirects back with authorization code
5. Claude calls `/token` with code + PKCE verifier → Kong proxies to Auth0 → returns access + refresh tokens
6. Claude stores tokens, attaches access token as `Authorization: Bearer <jwt>` on all `/mcp` requests
7. Kong validates JWT, strips it, injects `X-Introspection-*` headers, forwards to MCP server
8. On expiry, Claude calls `/token` with `grant_type=refresh_token` → Kong proxies refresh to Auth0

## File Structure

```
src/
├── auth/
│   ├── oauth-provider.ts       # OAuthServerProvider (proxies to Auth0)
│   └── clients-store.ts        # In-memory dynamic client registration store
├── middleware/
│   └── kong-auth.ts            # Extract X-Introspection-* headers, build AuthContext
├── api/
│   ├── discover-client.ts      # Unchanged interface (now without getToken)
│   └── yotpo-client.ts         # Existing (badges, public)
├── capabilities/
│   ├── discover/
│   │   ├── get-brand-identity.ts
│   │   ├── list-prompts.ts
│   │   ├── get-prompt-analytics.ts
│   │   └── index.ts
│   ├── badges.ts
│   ├── hello-world.ts
│   ├── index.ts
│   └── types.ts
├── config/
│   └── env.ts
├── server.ts                   # Express app + OAuth router + MCP transport
└── index.ts                    # Entry point (starts HTTP server)
```

Removed:
- `src/api/auth.ts` (M2M client credentials module — no longer needed)
- `src/auth/jwt-verify.ts` (not needed — Kong handles JWT validation)

## Module Specifications

### 1. `src/config/env.ts`

Replace M2M credentials with OAuth proxy config:

```typescript
const envSchema = z.object({
  YOTPO_AUTH0_DOMAIN: z.string(),          // "yotpo.us.auth0.com"
  YOTPO_AUTH0_CLIENT_ID: z.string(),       // SPA/Native app client ID
  YOTPO_AUTH0_AUDIENCE: z.string(),        // API audience identifier
  DISCOVER_API_BASE_URL: z.string(),       // Internal VPC URL for Discover API
  MCP_PORT: z.coerce.number().default(3000),
  MCP_BASE_URL: z.string(),               // Public URL (Kong-facing)
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
```

Removed fields: `YOTPO_AUTH0_CLIENT_SECRET`, `YOTPO_STORE_ID`, `YOTPO_APP_KEY`, `YOTPO_SECRET_KEY`, `MCP_TRANSPORT`.

### 2. `src/middleware/kong-auth.ts`

Extracts trusted identity from Kong's injected headers:

```typescript
export interface AuthContext {
  storeId: string;
  userEmail?: string;
  externalUserId?: string;
  agencyId?: string;
  organizationKey?: string;
}

export function extractAuthContext(req: Request): AuthContext {
  const storeId = req.headers["x-introspection-store-id"];
  if (!storeId || typeof storeId !== "string") {
    throw new HttpError(401, "Missing store identity");
  }

  return {
    storeId,
    userEmail: req.headers["x-introspection-user-email"] as string | undefined,
    externalUserId: req.headers["x-introspection-external-user-id"] as string | undefined,
    agencyId: req.headers["x-introspection-agency-id"] as string | undefined,
    organizationKey: req.headers["x-introspection-organization-key"] as string | undefined,
  };
}
```

Note: These headers are trusted because Kong sanitizes them (clears any client-injected values) before setting them from the validated JWT. The MCP server MUST only be reachable via Kong, never directly from the internet.

### 3. `src/auth/clients-store.ts`

In-memory store for MCP dynamic client registration:

```typescript
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/index.js";

export function createClientsStore(): OAuthRegisteredClientsStore;
```

Implementation:
- `Map<string, OAuthClientInformation>` in memory
- `getClient(clientId)` — lookup by ID
- `registerClient(metadata)` — generate client_id, store metadata, return info
- No persistence needed (clients re-register on server restart — the MCP SDK handles this gracefully)

### 4. `src/auth/oauth-provider.ts`

Implements `OAuthServerProvider` by proxying all auth operations to Auth0:

```typescript
import type { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/index.js";

export interface OAuthProviderConfig {
  auth0Domain: string;
  auth0ClientId: string;
  auth0Audience: string;
  baseUrl: string;          // This server's public URL
}

export function createOAuthProvider(config: OAuthProviderConfig): OAuthServerProvider;
```

Method implementations:

**`authorize(params)`**:
- Build Auth0 authorize URL: `https://{domain}/authorize`
- Pass through: `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`, `code_challenge_method`
- Add: `audience={auth0Audience}`
- Redirect the response to the Auth0 URL

**`exchangeAuthorizationCode(params)`**:
- POST to `https://{domain}/oauth/token`
- Body: `{ grant_type: "authorization_code", code, redirect_uri, client_id: auth0ClientId, code_verifier }`
- Return: `{ access_token, refresh_token, expires_in, token_type }`

**`exchangeRefreshToken(params)`**:
- POST to `https://{domain}/oauth/token`
- Body: `{ grant_type: "refresh_token", refresh_token, client_id: auth0ClientId }`
- Return new tokens

**`verifyAccessToken(token)`**:
- NOT used for JWT validation (Kong does this)
- This method is only called by the MCP SDK's `requireBearerAuth` middleware
- Since Kong already validated the token, this is a no-op passthrough that returns a minimal `AuthInfo`
- In practice, this endpoint is unreachable because Kong strips the Authorization header

**`revokeToken(token)`** (optional):
- POST to `https://{domain}/oauth/revoke`

**`clientsStore`**:
- Returns the `clients-store.ts` instance

### 5. `src/server.ts`

Express app with OAuth + MCP:

```typescript
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/index.js";

export function createApp(env: Env) {
  const app = express();

  const provider = createOAuthProvider({ ... });

  // OAuth endpoints (for Claude's OAuth dance — proxied through Kong)
  app.use(mcpAuthRouter({
    provider,
    issuerUrl: new URL(`https://${env.YOTPO_AUTH0_DOMAIN}/`),
    scopesSupported: ["openid", "offline_access"],
  }));

  // MCP endpoint — auth already handled by Kong
  app.post("/mcp", async (req, res) => {
    const authContext = extractAuthContext(req);
    const transport = new StreamableHTTPServerTransport({ ... });
    const server = createMcpServer(authContext);
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  return app;
}
```

### 6. MCP Server Factory

The `McpServer` is created per-request with the authenticated merchant's context:

```typescript
function createMcpServer(auth: AuthContext): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  const discoverClient = createDiscoverClient({
    baseUrl: env.DISCOVER_API_BASE_URL,
    storeId: auth.storeId,
  });

  // Register public tools (no auth needed)
  for (const capability of capabilities) {
    capability(server);
  }

  // Register discover tools with authenticated client
  registerDiscoverCapabilities(server, discoverClient);

  return server;
}
```

### 7. `src/api/discover-client.ts` — Simplified

Since Discover API is in the same VPC, no Bearer token needed:

```typescript
export interface DiscoverClientConfig {
  baseUrl: string;    // Internal VPC URL
  storeId: string;    // From Kong's X-Introspection-Store-Id
}

export function createDiscoverClient(config: DiscoverClientConfig) {
  const { baseUrl, storeId } = config;

  return {
    getBrandIdentity: () =>
      fetch(`${baseUrl}/v3/stores/${storeId}/brand-identity`).then(handleResponse),

    listPrompts: (params: PromptFilters) =>
      fetch(`${baseUrl}/v3/stores/${storeId}/prompts?${toQuery(params)}`).then(handleResponse),

    getPromptAnalytics: (params: AnalyticsParams) =>
      fetch(`${baseUrl}/v3/stores/${storeId}/prompt-analytics?${toQuery(params)}`).then(handleResponse),
  };
}
```

### 8. `src/index.ts`

Entry point — loads env, creates app, starts listening:

```typescript
const env = loadEnv();
const app = createApp(env);
app.listen(env.MCP_PORT, () => {
  console.log(`Yotpo MCP server listening on port ${env.MCP_PORT}`);
});
```

### 9. Discover Tools — No Changes

The tool files (`get-brand-identity.ts`, etc.) stay exactly the same. They already receive the `DiscoverClient` via `registerDiscoverCapabilities(server, client)`. The only difference is that the client is now created per-request with the merchant's store_id from Kong headers.

## Dependencies

New production dependencies:
- `express` — HTTP server framework (required by MCP SDK's auth middleware)
- `@types/express` (dev)

NOT needed (removed from original spec):
- `jose` — JWT validation is handled by Kong, not the MCP server

## What Gets Removed

- `src/api/auth.ts` — M2M client credentials (replaced by Kong headers)
- `src/api/auth.test.ts` — corresponding tests
- Env vars: `YOTPO_AUTH0_CLIENT_SECRET`, `YOTPO_STORE_ID`, `YOTPO_APP_KEY`, `YOTPO_SECRET_KEY`

## Security Model

### Trust Boundary

The MCP server trusts `X-Introspection-*` headers unconditionally. This is safe because:

1. **Kong sanitizes headers** — The `kong-v3-yotpo-auth-v2` plugin clears all `X-Introspection-*` headers from incoming requests before processing (prevents client injection)
2. **Kong sets headers only after validation** — Headers are set only after JWT signature verification, expiry check, and store_id claim extraction
3. **Network isolation** — The MCP server is only reachable within the VPC via Kong. Direct internet access is blocked by network policy.

### What Kong Validates (we don't need to)

| Check | Kong Plugin |
|-------|-------------|
| JWT signature (RS256/JWKS) | kong-v3-yotpo-auth-v2 |
| Token expiry (exp/nbf) | kong-v3-yotpo-auth-v2 |
| store_id claim exists | kong-v3-yotpo-auth-v2 |
| store_id matches URL path | kong-v3-yotpo-auth-v2 |
| Permissions array | kong-v3-yotpo-auth-v2 |
| Store allowlist (Redis) | kong-v3-yotpo-store-allowlist |

### What the MCP Server Must Still Do

- Validate `X-Introspection-Store-Id` header is present (defense against misconfigured routes)
- Scope Discover API calls to the authenticated store_id only
- Never accept store_id from request body/params (only from header)

## Testing Strategy

- `src/middleware/kong-auth.test.ts` — Extract headers, missing header → 401, malformed header handling
- `src/auth/oauth-provider.test.ts` — Mock Auth0 endpoints, test authorize redirect, code exchange, refresh
- `src/auth/clients-store.test.ts` — Register, get, not-found
- `src/server.test.ts` — Integration: inject X-Introspection headers, verify tool calls use correct store_id
- `src/api/discover-client.test.ts` — Verify correct URL construction with store_id
- Existing discover-tools tests — should still pass unchanged

## Verification

1. `npm run build` compiles
2. `npm test` passes all tests
3. Start server locally with mock headers: `MCP_PORT=3000 DISCOVER_API_BASE_URL=http://localhost:4000 npm start`
4. Simulate Kong by sending requests with `X-Introspection-Store-Id` header → tools work
5. Send request WITHOUT header → 401 response
6. Deploy behind Kong → full OAuth flow works end-to-end via Claude

## Kong Configuration Required

The following Kong route/service config is needed (handled by platform team):

- **Service**: points to MCP server's VPC address + port
- **Route**: public path (e.g., `/mcp/v1/*`)
- **Plugins**:
  - `kong-v3-yotpo-auth-v2` with `jwt_storeid_verify: true`, `jwt_storeid_enforce: true`
  - Store_id claim: `https://yotpo.com/store_id`

## Open Questions (resolved)

| Question | Resolution |
|----------|-----------|
| Token refresh | Claude handles it; Kong proxies refresh to Auth0 |
| Store ID | Extracted by Kong from JWT `https://yotpo.com/store_id` claim, injected as `X-Introspection-Store-Id` |
| Transport | HTTP only (deployed service behind Kong) |
| Client secret | Not needed (PKCE = public client) |
| Session state | Stateless — identity comes from Kong headers per-request |
| JWT validation | Kong only — MCP server trusts `X-Introspection-*` headers |
| Discover API auth | Not needed — same VPC, direct calls |
