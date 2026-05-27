# Yotpo Discover - Kong Gateway Routes Research

## Overview

Yotpo Discover is exposed through **5 Kong services** across 4 terraform files, serving AI-powered content discovery, lead generation, prompt generation, Salesforce integration, and UGC discovery features. All routes are hosted on `api.yotpo.com` (except UGC Discovery which uses `api-cdn.yotpo.com`).

---

## Service 1: Discover Everywhere API (Main Service)

**File:** `discover-everywhere-api.tf`  
**Backend:** `discover-everywhere-api-service-default.yotpo.xyz:443`  
**Base path prefix:** `/discover/v3/stores/{store_id}/...`  
**Auth:** `yotpo-auth-v2` (JWT + utoken, store_id verified)  
**Plugins:** CORS (global config), `yotpo-strip-route` (strips `/discover` prefix before forwarding)

### Routes

| Route | Path Pattern | Methods | Description |
|-------|-------------|---------|-------------|
| Prompts Collection | `/discover/v3/stores/{store_id}/prompts` | GET, POST, PUT | List/create/update prompts |
| Prompts Detail | `/discover/v3/stores/{store_id}/prompts/{id}` | GET, DELETE | Get/delete a specific prompt |
| Prompt Analytics | `/discover/v3/stores/{store_id}/prompt-analytics` | GET | Prompt analytics overview |
| Prompt Analytics Detail | `/discover/v3/stores/{store_id}/prompt-analytics/{id}` | GET | Analytics for specific prompt |
| Prompt Analytics Products | `/discover/v3/stores/{store_id}/prompt-analytics/products` | GET | Product-level analytics |
| Prompt Analytics Opportunities | `/discover/v3/stores/{store_id}/prompt-analytics/{id}/opportunities` | GET | Opportunities for a prompt |
| Prompts Products | `/discover/v3/stores/{store_id}/prompts-products` | GET | Products associated with prompts |
| Prompts Product Categories | `/discover/v3/stores/{store_id}/prompts-product-categories` | GET | Product categories for prompts |
| Audiences Count | `/discover/v3/stores/{store_id}/audiences/count` | GET | Count of audiences |
| Audiences Collection | `/discover/v3/stores/{store_id}/audiences` | GET, POST | List/create audiences |
| Audiences Detail | `/discover/v3/stores/{store_id}/audiences/{id}` | GET, PATCH, DELETE | Manage specific audience |
| Audience Interests Collection | `/discover/v3/stores/{store_id}/audience-interests` | GET, POST | List/create audience interests |
| Audience Interests Detail | `/discover/v3/stores/{store_id}/audience-interests/{id}` | GET, DELETE | Get/delete interest |
| Brand Topics Collection | `/discover/v3/stores/{store_id}/brand-topics` | GET, POST, PUT | Manage brand topics |
| Brand Topics Batch | `/discover/v3/stores/{store_id}/brand-topics/batch` | POST | Batch create brand topics |
| Brand Topics Detail | `/discover/v3/stores/{store_id}/brand-topics/{id}` | GET, PATCH, DELETE | Manage specific topic |
| Competitors Count | `/discover/v3/stores/{store_id}/competitors/count` | GET | Count of competitors |
| Competitors Collection | `/discover/v3/stores/{store_id}/competitors` | GET, POST | List/create competitors |
| Competitors Detail | `/discover/v3/stores/{store_id}/competitors/{id}` | GET, PATCH, DELETE | Manage specific competitor |
| Product Categories Collection | `/discover/v3/stores/{store_id}/product-categories` | GET, POST | List/create product categories |
| Product Categories Detail | `/discover/v3/stores/{store_id}/product-categories/{id}` | GET, PATCH, DELETE | Manage specific category |
| Product Category Products | `/discover/v3/stores/{store_id}/product-categories/{id}/products` | PUT, DELETE | Assign/remove products from category |
| Product Category Products Lookup | `/discover/v3/stores/{store_id}/product-category-products` | GET | Lookup products by category |
| Products Search | `/discover/v3/stores/{store_id}/products-search` | GET | Search products |
| Geo Locations Collection | `/discover/v3/stores/{store_id}/geo-locations` | GET, POST, PUT | Manage geo locations |
| Geo Locations Detail | `/discover/v3/stores/{store_id}/geo-locations/{id}` | GET, DELETE | Specific geo location |
| Geo Locations Provider Support | `/discover/v3/stores/{store_id}/geo-locations/provider-support` | GET | Provider support info |
| Brand Identity | `/discover/v3/stores/{store_id}/brand-identity` | GET, PATCH, DELETE | Singleton brand identity |
| Writing Styles | `/discover/v3/stores/{store_id}/writing-styles` | GET, PATCH, DELETE | Singleton writing style config |
| Writing Rules Collection | `/discover/v3/stores/{store_id}/writing-rules` | GET, POST, PUT | Manage writing rules |
| Writing Rules Detail | `/discover/v3/stores/{store_id}/writing-rules/{id}` | PATCH, DELETE | Update/delete rule |
| Writing Examples Collection | `/discover/v3/stores/{store_id}/writing-examples` | GET, POST | Manage writing examples |
| Writing Examples Detail | `/discover/v3/stores/{store_id}/writing-examples/{id}` | DELETE | Delete example |
| Opportunity Analytics Collection | `/discover/v3/stores/{store_id}/opportunity-analytics` | GET | List opportunity analytics |
| Opportunity Analytics Overview | `/discover/v3/stores/{store_id}/opportunity-analytics/overview` | GET | Analytics overview |
| Opportunity Analytics Detail | `/discover/v3/stores/{store_id}/opportunity-analytics/{uuid}` | GET | Specific opportunity |
| Opportunity Analytics Prompts | `/discover/v3/stores/{store_id}/opportunity-analytics/{uuid}/prompts` | GET | Prompts for opportunity |
| Smart Audience | `/discover/v3/stores/{store_id}/opportunities/{uuid}/audience` | GET | Smart audience for opportunity |
| Billing Checkout | `/discover/v3/stores/{store_id}/billing/checkout` | POST | Billing checkout |
| Plan Entitlements | `/discover/v3/stores/{store_id}/plan-entitlements` | GET | Get plan entitlements |
| Prompt Generation Trigger | `/discover/v3/stores/{store_id}/prompt-generation/trigger` | POST | Trigger prompt generation |
| Content (wildcard) | `/discover/v3/stores/{store_id}/content/*` | GET, POST, PUT, DELETE | All content endpoints |

### Auth Notes
- Service-level auth plugin applies to all routes by default
- Opportunity analytics routes have **additional route-level auth plugins** (double auth enforcement)

---

## Service 2: Discover Lead Generation

**File:** `discover-lead-generation.tf`  
**Backend:** `discover-lead-generation-poc-api-default.yotpo.xyz:443`  
**Base path prefix:** `/v1/brand-analyses/...`  
**Auth:** None (commented out) - this is a **public/unauthenticated** service  
**Plugins:** CORS (permissive `*` origins), rate limiting (50/min on create)

### Routes

| Route | Path Pattern | Methods | Description |
|-------|-------------|---------|-------------|
| Brand Analyses Create | `/v1/brand-analyses` | POST | Create brand analysis workflow |
| Brand Analyses Get | `/v1/brand-analyses/{analysis_id}` | GET | Get analysis status |
| Brand Analyses Delete | `/v1/brand-analyses/{analysis_id}` | DELETE | Delete analysis |
| Final Runs Create | `/v1/brand-analyses/{analysis_id}/final-runs` | POST | Create final run |
| Final Runs Get | `/v1/brand-analyses/{analysis_id}/final-runs/{run_id}` | GET | Get final run status |
| Email Update | `/v1/brand-analyses/email-updates` | POST | Update email |
| Initial Callback | `/v1/brand-analyses/{analysis_id}/initial-callback` | POST | N8N workflow callback (internal) |
| Final Callback | `/v1/brand-analyses/{analysis_id}/final-callback` | POST | N8N workflow callback (internal) |

**Hosts:** Both `api.yotpo.com` and `api-write.yotpo.com`

---

## Service 3: Discover Prompt Generation Lambda Proxy

**File:** `discover-prompt-generation-lambda-proxy.tf`  
**Backend:** Lambda function `discover-prompt-generation-result-poller` (us-east-1)  
**Auth:** `yotpo-auth-v2` (JWT + utoken, store_id verified)  
**Plugins:** CORS, AWS Lambda (proxy integration)

### Routes

| Route | Path Pattern | Methods | Description |
|-------|-------------|---------|-------------|
| Prompt Generation Poller | `/discover/v3/stores/{store_id}/prompt-generation/poller` | POST | Poll for prompt generation results |

**Note:** The Kong service host is `host.invalid` — the `aws-lambda` plugin intercepts and proxies to Lambda directly.

---

## Service 4: Discover Salesforce Integration

**File:** `discover-salesforce-integration.tf`  
**Backend:** `discover-everywhere-api-service-default.yotpo.xyz:443` (same as main API)  
**Auth:** None at Kong level — app-level HMAC-SHA256 via `x-api-key` header  
**Plugins:** `yotpo-strip-route` (strips `/discover`), rate limiting (60/min)

### Routes

| Route | Path Pattern | Methods | Description |
|-------|-------------|---------|-------------|
| Set Inactive | `/discover/billing/sf-integration/owners_packages/owner/Organization/{org_id}` | POST | Set Discover packages inactive |

---

## Service 5: Discover Shopify Log Drain

**File:** `discover-shopify-log-drain.tf`  
**Backend:** `discover.shopify.log.drain:80` (internal)  
**Auth:** `key-auth` via `x-yotpo-drain-key` header  
**Plugins:** `request-termination` (always returns 200 OK — this is a sink/no-op route)

### Routes

| Route | Path Pattern | Methods | Description |
|-------|-------------|---------|-------------|
| Log Drain | `/discover/stores/{store_id}/shopify/log-drain` | POST | Receive Shopify log drain events |

**Note:** This route terminates immediately with 200 — no traffic forwarded to backend. It's essentially a dead endpoint.

---

## Service 6: UGC Discovery (Related)

**File:** `ugc-discovery.tf`  
**Backend:** `ugc-discovery-api-default.yotpo.xyz:443`  
**Host:** `api-cdn.yotpo.com` (CDN-fronted)  
**Auth:** `yotpo-auth-v2` (utoken NOT enforced, store_id verified via introspection/JWT)

### Routes

| Route | Path Pattern | Methods | Description |
|-------|-------------|---------|-------------|
| LLM Schema | `/v1/stores/{store_id}/products/{product_id}/llm-schema` | GET, HEAD | Product LLM schema (for AI consumption) |
| Assets | `/v1/stores/{store_id}/products/{product_id}/assets/{asset_id}` | GET, HEAD | Product assets |
| Template Config | `/v1/stores/{store_id}/templateConfig` | GET, HEAD | Get template configuration |
| Template Config History | `/v1/stores/{store_id}/templateConfig/history` | GET, HEAD | Template config history |
| Template Config Activate | `/v1/stores/{store_id}/templateConfig/active` | POST | Activate template config |
| Template Config Render | `/v1/templateConfig/render` | POST | Render template config |

**Rate Limit:** LLM Schema route is rate limited at 29,900 requests/minute (per path+appkey).

---

## Architecture Summary

```
                                    ┌─────────────────────────────────────────┐
                                    │         api.yotpo.com (Kong)            │
                                    └────────────────┬────────────────────────┘
                                                     │
         ┌───────────────┬───────────────┬──────────┼──────────┬────────────────┐
         │               │               │          │          │                │
    /discover/v3/    /v1/brand-     /discover/v3/  /discover/  /discover/     api-cdn
    stores/...       analyses/...   .../poller     billing/    stores/.../    .yotpo.com
         │               │               │        sf-...      shopify/...        │
         ▼               ▼               ▼          │          │                ▼
  ┌──────────────┐ ┌────────────┐ ┌──────────┐     │          │    ┌──────────────┐
  │  discover-   │ │  discover- │ │  AWS     │     │          │    │ ugc-discovery │
  │  everywhere- │ │  lead-gen- │ │  Lambda  │     │          │    │ -api          │
  │  api         │ │  poc-api   │ │  (poller)│     │          │    └──────────────┘
  └──────────────┘ └────────────┘ └──────────┘     │          │
                                                    ▼          ▼
                                            ┌──────────┐  ┌─────────┐
                                            │ discover-│  │ request │
                                            │ everywhere│  │ termin- │
                                            │ -api     │  │ ation   │
                                            └──────────┘  └─────────┘
```

## Key Observations

1. **Main product surface** is `discover-everywhere-api` with ~40 routes covering prompts, audiences, brand topics, competitors, product categories, geo-locations, writing configuration, opportunity analytics, billing, and content management.

2. **Lead Generation** is a separate unauthenticated service (likely a public-facing PoC/demo tool) with rate limiting.

3. **Prompt Generation** spans two services: the trigger endpoint is on the main API, while the poller goes through an AWS Lambda proxy.

4. **The Salesforce integration** is M2M (machine-to-machine) with no Kong auth — it uses app-level HMAC validation.

5. **Shopify Log Drain** is a no-op sink (request-termination plugin returns 200 immediately).

6. **UGC Discovery** is a CDN-fronted service for serving product schemas and template configs, with a notable `llm-schema` endpoint designed for AI/LLM consumption.

7. **All authenticated routes** use `yotpo-auth-v2` with store_id verification in the URL path matched against JWT claims — ensuring tenant isolation.
