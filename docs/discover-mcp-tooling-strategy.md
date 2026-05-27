# Yotpo Discover - MCP Tooling Strategy

## Executive Summary

This document synthesizes research from two sources:
1. **Kong Gateway routes** — the public API surface exposed via `api.yotpo.com`
2. **Discover Everywhere API internals** — the NestJS service, data models, and response shapes

The goal: define which MCP tools to build, what they expose, and how to prioritize implementation.

---

## Scope Decision: What to Expose

### In Scope (Discover Everywhere API)
The main authenticated product surface at `/discover/v3/stores/{store_id}/...` — this is where all the business value lives.

### Out of Scope
| Service | Reason |
|---------|--------|
| Lead Generation (`/v1/brand-analyses`) | Public PoC, no auth, limited utility for authenticated MCP |
| Salesforce Integration | M2M internal, HMAC auth, not user-facing |
| Shopify Log Drain | Dead/no-op endpoint |
| Prompt Generation Poller (Lambda) | Internal polling mechanism, not useful as a tool |
| UGC Discovery (CDN) | Separate product domain, consider as a separate MCP capability later |

---

## Authentication Strategy

All Discover Everywhere routes require:
- `yotpo-auth-v2` with JWT or utoken
- `store_id` in the URL must match `store_id` in the JWT claim

**MCP Implementation**: The server needs a valid JWT/utoken for a specific store. This should be configured at connection time (env var or auth flow). Every tool call includes `storeId` as a required parameter.

---

## Tool Catalog

### Tier 1: High-Value Read Operations (Ship First)

These are safe, informative, and provide the most value to an AI agent working with brand visibility data.

| Tool Name | Endpoint | Description |
|-----------|----------|-------------|
| `getPromptAnalytics` | `GET /discover/v3/stores/{storeId}/prompt-analytics` | List prompts with visibility scores, rankings, and sentiment. Supports filtering by geo, provider, date range, journey stage, audience, product category, topic. Returns paginated results with optional summary stats. |
| `getPromptAnalyticsDetail` | `GET /discover/v3/stores/{storeId}/prompt-analytics/{id}` | Deep dive into a single prompt — monthly trends, per-platform visibility, citation breakdown, domain mentions, source details, product rankings with "why they win" reasons. |
| `getOpportunityAnalytics` | `GET /discover/v3/stores/{storeId}/opportunity-analytics` | List growth opportunities (paginated, filterable, sortable). |
| `getOpportunityAnalyticsOverview` | `GET /discover/v3/stores/{storeId}/opportunity-analytics/overview` | Summary stats for all opportunities. |
| `getBrandIdentity` | `GET /discover/v3/stores/{storeId}/brand-identity` | Brand name, URL, mission, values, keywords. Singleton per store. |
| `listPrompts` | `GET /discover/v3/stores/{storeId}/prompts` | List all monitoring prompts (paginated, filterable by geo/provider). |
| `listAudiences` | `GET /discover/v3/stores/{storeId}/audiences` | Target audience definitions (demographics, interests, budget, geo). |
| `listCompetitors` | `GET /discover/v3/stores/{storeId}/competitors` | Tracked competitor brands with URLs and category associations. |
| `listBrandTopics` | `GET /discover/v3/stores/{storeId}/brand-topics` | Topics the brand monitors for LLM visibility. |
| `listGeoLocations` | `GET /discover/v3/stores/{storeId}/geo-locations` | Active geographic targets. |
| `listProductCategories` | `GET /discover/v3/stores/{storeId}/product-categories` | Product organization/groupings. |
| `getWritingStyles` | `GET /discover/v3/stores/{storeId}/writing-styles` | Brand's tone of voice configuration. |
| `listWritingRules` | `GET /discover/v3/stores/{storeId}/writing-rules` | Content writing rules. |
| `getPlanEntitlements` | `GET /discover/v3/stores/{storeId}/plan-entitlements` | Current plan/feature entitlements. |
| `searchProducts` | `GET /discover/v3/stores/{storeId}/products-search` | Search store products. |
| `getGeoProviderSupport` | `GET /discover/v3/stores/{storeId}/geo-locations/provider-support` | Which geos are supported by which LLM providers. |

### Tier 2: Write Operations (Ship Second)

These modify brand configuration. Require more careful parameter design and validation.

| Tool Name | Endpoint | Description |
|-----------|----------|-------------|
| `createPrompts` | `POST /discover/v3/stores/{storeId}/prompts` | Create new monitoring prompts (batch). |
| `updateBrandIdentity` | `PATCH /discover/v3/stores/{storeId}/brand-identity` | Update brand profile (name, mission, values, keywords). |
| `createAudience` | `POST /discover/v3/stores/{storeId}/audiences` | Define a new target audience. |
| `updateAudience` | `PATCH /discover/v3/stores/{storeId}/audiences/{id}` | Update audience definition. |
| `createCompetitor` | `POST /discover/v3/stores/{storeId}/competitors` | Add a competitor to track. |
| `updateCompetitor` | `PATCH /discover/v3/stores/{storeId}/competitors/{id}` | Update competitor details. |
| `createBrandTopics` | `POST /discover/v3/stores/{storeId}/brand-topics` | Add topics to monitor. |
| `createBrandTopicsBatch` | `POST /discover/v3/stores/{storeId}/brand-topics/batch` | Batch create topics. |
| `updateBrandTopic` | `PATCH /discover/v3/stores/{storeId}/brand-topics/{id}` | Update a topic. |
| `createGeoLocations` | `POST /discover/v3/stores/{storeId}/geo-locations` | Add geographic targets. |
| `createProductCategory` | `POST /discover/v3/stores/{storeId}/product-categories` | Create product category. |
| `updateProductCategory` | `PATCH /discover/v3/stores/{storeId}/product-categories/{id}` | Update category. |
| `assignProductsToCategory` | `PUT /discover/v3/stores/{storeId}/product-categories/{id}/products` | Assign products to a category. |
| `updateWritingStyles` | `PATCH /discover/v3/stores/{storeId}/writing-styles` | Update brand tone of voice. |
| `createWritingRule` | `POST /discover/v3/stores/{storeId}/writing-rules` | Add a writing rule. |
| `triggerPromptGeneration` | `POST /discover/v3/stores/{storeId}/prompt-generation/trigger` | Trigger AI prompt generation based on brand profile. |

### Tier 3: Delete Operations (Ship Last / Gate Behind Confirmation)

| Tool Name | Endpoint | Description |
|-----------|----------|-------------|
| `deletePrompt` | `DELETE /discover/v3/stores/{storeId}/prompts/{id}` | Remove a monitoring prompt. |
| `deleteAudience` | `DELETE /discover/v3/stores/{storeId}/audiences/{id}` | Remove an audience. |
| `deleteCompetitor` | `DELETE /discover/v3/stores/{storeId}/competitors/{id}` | Remove a competitor. |
| `deleteBrandTopic` | `DELETE /discover/v3/stores/{storeId}/brand-topics/{id}` | Remove a topic. |
| `deleteGeoLocation` | `DELETE /discover/v3/stores/{storeId}/geo-locations/{id}` | Remove a geo target. |
| `deleteProductCategory` | `DELETE /discover/v3/stores/{storeId}/product-categories/{id}` | Remove a product category. |

---

## Tool Design Principles

### 1. Parameter Design
Every tool takes `storeId` as required first parameter. The Kong route validates this against the JWT, so passing a wrong storeId results in a 401/403 — no data leakage risk.

### 2. Rich Filtering on Analytics
`getPromptAnalytics` is the most valuable tool and should expose all available filters:

```typescript
{
  storeId: string,           // required
  geoLocations?: string[],   // ISO country codes
  llmProviders?: string[],   // "chatgpt", "gemini", etc.
  startDate?: string,        // ISO date
  endDate?: string,          // ISO date
  audienceIds?: number[],
  productCategoryIds?: number[],
  topicIds?: number[],
  journeyStages?: ("awareness" | "consideration" | "decision")[],
  scoreMin?: number,         // 0-100
  scoreMax?: number,
  searchQuery?: string,      // text search on prompt text
  sort?: string,             // "field:asc|desc"
  limit?: number,            // pagination
  offset?: number,
  includeSummary?: boolean,  // include aggregate stats
}
```

### 3. Response Shaping
Return the full API response — don't truncate. The AI agent benefits from having all data available (rankings, citations, sentiment). For list endpoints, always include pagination metadata.

### 4. Path Construction
Kong strips the `/discover` prefix before forwarding. The actual API paths that the backend service receives are:
- Kong path: `/discover/v3/stores/{storeId}/prompts` 
- Backend receives: `/v3/stores/{storeId}/prompts`

The MCP tool should call the Kong gateway URL (`api.yotpo.com`) with the full path including `/discover` prefix.

### 5. Content Endpoint Strategy
The wildcard `/discover/v3/stores/{storeId}/content/*` route suggests a content management subsystem. Rather than exposing one generic `content` tool, investigate what sub-paths exist and create specific tools once the content API is understood.

---

## Implementation Plan

### Phase 1: Analytics & Brand Profile (Read-Only)
**Goal**: Let an AI agent understand a brand's LLM visibility landscape.

1. `getPromptAnalytics` — the flagship tool
2. `getPromptAnalyticsDetail` — deep dive per prompt
3. `getBrandIdentity` — context about the brand
4. `listPrompts` — what's being monitored
5. `listCompetitors` — who's being tracked
6. `listBrandTopics` — what topics matter
7. `listAudiences` — who the brand targets
8. `getPlanEntitlements` — what the store can do

**Use case**: "How is my brand performing across AI platforms? Where am I losing to competitors? Which prompts have declining visibility?"

### Phase 2: Opportunity & Competitive Intelligence
**Goal**: Surface actionable insights.

9. `getOpportunityAnalytics` — growth opportunities
10. `getOpportunityAnalyticsOverview` — summary metrics
11. `searchProducts` — find products
12. `listProductCategories` — product organization
13. `listGeoLocations` — geo targeting
14. `getGeoProviderSupport` — provider coverage

**Use case**: "What opportunities am I missing? Which product categories are underperforming? What geos should I expand into?"

### Phase 3: Brand Configuration (Write)
**Goal**: Let an AI agent help set up and optimize a brand's Discover profile.

15. `updateBrandIdentity` — refine brand profile
16. `createAudience` / `updateAudience` — audience management
17. `createCompetitor` / `updateCompetitor` — competitor tracking
18. `createBrandTopics` — topic management
19. `triggerPromptGeneration` — generate new monitoring prompts
20. `updateWritingStyles` / `createWritingRule` — content tone

**Use case**: "Add these 3 competitors to my tracking. Update my brand keywords. Generate new prompts targeting the awareness stage."

### Phase 4: Lifecycle Management (Delete)
**Goal**: Clean up and manage resources. Gate behind confirmation prompts.

21-26. Delete operations for prompts, audiences, competitors, topics, geos, categories.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    MCP Client (AI Agent)             │
└──────────────────────────┬──────────────────────────┘
                           │ MCP Protocol
┌──────────────────────────▼──────────────────────────┐
│                  Yotpo MCP Server                    │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Auth Module  │  │ Tool Router │  │ Response   │ │
│  │ (JWT/utoken)│  │             │  │ Formatter  │ │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │               │         │
│         └────────────────┼───────────────┘         │
│                          │                          │
└──────────────────────────┼──────────────────────────┘
                           │ HTTPS + JWT
┌──────────────────────────▼──────────────────────────┐
│              api.yotpo.com (Kong Gateway)            │
│                                                     │
│  yotpo-auth-v2 → yotpo-strip-route → upstream      │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│         discover-everywhere-api (NestJS)             │
│                                                     │
│  OpenAPI controllers → Services → Prisma → Postgres │
└─────────────────────────────────────────────────────┘
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Start with read-only analytics | Highest value, zero risk, validates auth flow |
| Expose full filter set on analytics | AI agents excel at slicing data — give them the power |
| Skip lead generation service | Different auth model, PoC quality, limited value |
| Skip UGC Discovery for now | Separate domain — could be its own MCP capability later |
| Include `triggerPromptGeneration` in Tier 2 | High-value action that creates new monitoring coverage |
| Gate deletes behind confirmation | Destructive operations need human-in-the-loop |
| Call Kong gateway, not backend directly | Consistent auth, rate limiting, and path handling |

---

## Open Questions

1. **Auth token lifecycle**: How to obtain and refresh JWT/utoken for the MCP server? Is there a service account flow, or does it piggyback on a user session?
2. **Content API structure**: What sub-paths exist under `/content/*`? Need to investigate the API source to build specific tools.
3. **Rate limits**: The Kong config doesn't show explicit rate limits on the main Discover API routes (only lead gen and Salesforce have them). Are there implicit limits we should respect?
4. **Pagination defaults**: What are reasonable defaults for `limit`? The API likely has a max — need to confirm from OpenAPI specs.
5. **Opportunity Analytics maturity**: Research notes this is currently "mock-data based" — is it production-ready for MCP exposure?
