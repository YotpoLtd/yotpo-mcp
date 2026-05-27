# Discover Everywhere API - Research Report

## Overview

The **discover-everywhere-api** is a NestJS service (`@discover/discover-everywhere-api`) that serves as the backend for Yotpo's "Discover Everywhere" product. It manages AI-generated prompts/questions that brands use to monitor their visibility across LLM platforms (ChatGPT, Gemini, Google AI Mode), along with the brand profile configuration that drives prompt generation.

**Stack**: NestJS 11, Prisma 7 (PostgreSQL), OpenAPI-generated controllers, Zod validation, esbuild bundling, Node 24, pnpm workspace.

## Architecture

### Code Generation Pattern
The API uses an **OpenAPI-first** approach:
- OpenAPI specs live in `openapi/` (split by domain)
- `openapi-generator-cli` generates abstract API interfaces, controllers, and models into `src/generated/`
- Implementation classes (`*ApiImpl`) extend the generated abstractions
- The `ApiModule.forRoot()` wires implementations to generated controllers via DI

### Key Directories
```
src/
├── generated/          # Auto-generated from OpenAPI (controllers, models, API interfaces)
├── brand-hub/          # Brand profile entities (identity, topics, audiences, competitors, etc.)
├── prompts/            # Prompt CRUD - the core entity
├── prompt-analytics/   # Visibility metrics & analytics for prompts
├── opportunity-analytics/ # Opportunity insights (currently mock-data based)
├── integrations/       # AWS Lambda/S3 clients, LLM executor, Products service
├── config/             # Environment-based config
├── prisma/             # Prisma service + CLS transactional setup
├── health/             # /status endpoint
├── metrics/            # OpenTelemetry Prometheus metrics
├── logger/             # Pino logger (YotpoLogger)
└── filters/            # Global exception filter
```

## Core Domain Models (Prisma)

| Model | Purpose |
|-------|---------|
| **Prompt** | AI-generated question text with metadata (length, scope, journey stage, product, audience, competitor, topics) |
| **BrandIdentity** | Brand name, URL, mission, values, keywords (1 per store) |
| **BrandTopic** | Topics the brand wants to be visible for |
| **Audience** | Target audience profiles (age, gender, budget, geo, interests) |
| **AudienceInterest** | Interests associated with audiences |
| **Competitor** | Competitor brands with URLs and geo/category associations |
| **GeoLocation** | Target geographic regions (ISO country codes) |
| **BrandWritingStyle** | Tone of voice + writing rules + writing examples (1 per store) |
| **ProductCategory** | Product groupings with associated products |
| **SyncedPromptMetricsDaily** | Daily visibility metrics per prompt/provider/geo (brand mentions, rank, sentiment, citations) |

## API Capabilities (by domain)

### 1. Prompts (`/v3/stores/{storeId}/prompts`)
- **CRUD**: Create batch, delete batch, list (paginated + filter by geo/provider), get by ID
- **Products**: List distinct products and product categories used in prompts
- Validates relations (audience, competitor, topics) on create
- Resolves product names from external Products Service

### 2. Prompt Analytics (`/v3/stores/{storeId}/prompt-analytics`)
- **List with metrics**: Aggregated visibility data (offset pagination)
- **Detail by ID**: Full breakdown with platform visibility, citation sources, domain mentions, product rankings, sentiment
- Joins prompts with `SyncedPromptMetricsDaily` for real metrics

### 3. Opportunity Analytics (`/v3/stores/{storeId}/opportunity-analytics`)
- **List opportunities**: Paginated, filterable, sortable
- **Overview**: Summary stats
- **Detail by ID**: Full opportunity details
- **Prompts per opportunity**: Affected prompts list
- **Status update**: Mark opportunity status
- *Currently mock-data based* - not yet backed by real DB queries

### 4. Brand Identity (`/v3/stores/{storeId}/brand-identity`)
- **CRUD**: Create, read, update, delete (singleton per store)
- Fields: name, URL, mission, brand values, keywords

### 5. Brand Topics (`/v3/stores/{storeId}/brand-topics`)
- **CRUD**: Create, list (paginated), get by ID, update, delete

### 6. Audiences (`/v3/stores/{storeId}/audiences`)
- **CRUD**: Create, list (paginated), get by ID, update, delete
- Complex entity with gender, age range, budget, geo locations, interests

### 7. Audience Interests (`/v3/stores/{storeId}/audience-interests`)
- **CRUD**: Create, list (paginated), get by ID, update, delete

### 8. Competitors (`/v3/stores/{storeId}/competitors`)
- **CRUD**: Create, list (paginated), get by ID, update, delete
- Includes geo-locations and product category associations

### 9. Geo Locations (`/v3/stores/{storeId}/geo-locations`)
- **CRUD**: Create, list, get by ID, delete
- **Provider support**: Check which geos are supported by LLM providers

### 10. Brand Writing Styles (`/v3/stores/{storeId}/brand-writing-styles`)
- **CRUD**: Create, read, update, delete (singleton per store)
- **Writing Rules**: Sub-resource CRUD
- **Writing Examples**: Sub-resource CRUD (file upload to S3)

### 11. Product Categories (`/v3/stores/{storeId}/product-categories`)
- **CRUD**: Create, list (paginated), get by ID, update, delete
- **Products per category**: Sub-resource CRUD

## Integrations

| Integration | Purpose |
|-------------|---------|
| **AWS Lambda** | Invokes `llm-prompt-executor` for prompt execution against LLMs |
| **AWS S3** | Stores batch input files for executor, writing example files |
| **Products Service** | External HTTP service for resolving product IDs → names |
| **PostgreSQL** | Primary datastore via Prisma |
| **OpenTelemetry/Prometheus** | Metrics export |

## Configuration

All config via environment variables. Key ones:
- `DATABASE_URL` or `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`
- `AWS_REGION`, `AWS_ENDPOINT` (for local dev)
- `LLM_PROMPT_EXECUTOR_FUNCTION_NAME`, `LLM_PROMPT_EXECUTOR_LLMS`
- `PRODUCTS_SERVICE_BASE_URL`
- `WRITING_EXAMPLES_BUCKET`

## Deep Dive: Prompt Analytics Data Model

The prompt-analytics module is the richest data source in the API — it aggregates daily visibility metrics across LLM platforms into actionable insights.

### Data Sources (3 synced tables)

These tables are populated externally (likely from a data pipeline) and consumed read-only by the API:

#### `synced_prompt_metrics_daily`
Daily aggregated metrics per prompt × provider × geolocation:
| Field | Type | Description |
|-------|------|-------------|
| prompt_id | BigInt | FK to prompts |
| provider_id | String | LLM provider identifier |
| provider_name | String | Human-readable (e.g., "chatgpt", "gemini") |
| geolocation | String | Country code |
| metric_date | Date | The day these metrics cover |
| brand_mention_count | BigInt | Times brand was mentioned |
| response_count | BigInt | Total LLM responses |
| sum_rank | Int | Sum of position ranks (for avg calc) |
| sum_sentiment | Float | Sum of sentiment scores |
| sentiment_count | BigInt | Number of sentiment observations |
| citation_count_ugc | BigInt | Citations from user-generated content |
| citation_count_publisher | BigInt | Citations from publishers |
| citation_count_brand | BigInt | Citations from brand's own content |
| citation_count_competitor | BigInt | Citations from competitor content |
| citation_count_knowledge_base | BigInt | Citations from knowledge bases |
| citation_count_video_platform | BigInt | Citations from video platforms |
| citation_count_retailer | BigInt | Citations from retailers |
| citation_count_total | BigInt | Total citations |
| avg_rank | Float | Pre-computed average rank |
| sentiment_score | Float | Pre-computed sentiment score |
| visibility_score | Float | **Key metric** — overall visibility score |

#### `synced_awareness_product_rankings`
Per-execution product ranking data (which products LLMs recommend for each prompt):
| Field | Type | Description |
|-------|------|-------------|
| prompt_id | BigInt | FK to prompts |
| product_name | String | Product name as returned by LLM |
| brand_name | String | Brand that owns this product |
| product_rank | Int | Position in LLM's recommendation list |
| is_store_product | Boolean | Whether this is the user's own product |
| win_reason | String | Why the LLM recommended this product |
| product_image_url | String | Product image |
| provider_id / provider_name | String | Which LLM platform |
| geolocation | String | Country |
| execution_timestamp | DateTime | When this was observed |

#### `synced_domain_citations`
Which domains LLMs cite when answering prompts:
| Field | Type | Description |
|-------|------|-------------|
| prompt_id | BigInt | FK to prompts |
| domain | String | e.g., "reddit.com", "nytimes.com" |
| classification | String | Type: "ugc", "publisher", "brand", etc. |
| citation_count | BigInt | How many times this domain was cited |
| execution_date | Date | When observed |

#### `synced_source_citations`
Individual URLs cited by LLMs:
| Field | Type | Description |
|-------|------|-------------|
| prompt_id | BigInt | FK to prompts |
| url | String | Full URL cited |
| title | String | Page title |
| domain | String | Domain of the URL |
| classification | String | Source type |
| brand_mentioned | Boolean | Whether brand was mentioned on this page |
| sentiment_score | Float | Sentiment of the citation toward brand |
| execution_date | Date | When observed |

### Computed Metrics & Aggregations

The service computes these from raw data:

1. **Visibility Score** (`AVG(visibility_score)`) — averaged across matching metrics rows
2. **Sentiment** (`SUM(sum_sentiment) / SUM(sentiment_count)`) — weighted average
3. **Rank** — brand's best product average rank from `synced_awareness_product_rankings`:
   - Aggregates `product_rank` per (brand, product) → `AVG(product_rank)`
   - Deduplicates ties (prefer store's product, then highest coverage)
   - Takes `MIN(avg_product_rank)` where `is_store_product = TRUE`
4. **Coverage %** — what % of ranking executions the product appeared in
5. **Citation Breakdown** — percentage split across 7 source types (UGC, publisher, brand, competitor, knowledge base, video platform, retailer)
6. **Platform Visibility** — per-LLM-provider visibility score breakdown
7. **Monthly Trend** — visibility score aggregated by month

### Query Filters (all optional)

| Filter | Description |
|--------|-------------|
| `geoLocations` | Array of country codes |
| `llmProviders` | Array of provider names |
| `startDate` / `endDate` | Date range (defaults to today) |
| `audienceIds` | Filter by audience |
| `productCategoryIds` | Filter by product category |
| `topicIds` | Filter by brand topic |
| `journeyStages` | "awareness", "consideration", "decision" |
| `scoreMin` / `scoreMax` | Visibility score range (0-100) |
| `sentimentMin` / `sentimentMax` | Sentiment range |
| `productIds` | Filter by specific products |
| `searchQuery` | Text search on prompt text (ILIKE) |
| `sort` | Multi-field sort (`field:direction`) |
| `include` | Optional sections (e.g., "summary") |

### API Response Shapes

#### List Response (`GET /v3/stores/{storeId}/prompt-analytics`)
```typescript
{
  promptAnalytics: PromptAnalyticListItem[],  // paginated results
  pagination: { limit, offset, totalCount },
  summary?: {                                  // optional, via include=summary
    ranked: number,      // count of prompts that have a rank
    score: number,       // avg visibility score across all filtered prompts
    sentiment: number,   // avg sentiment across all filtered prompts
  }
}
```

Each `PromptAnalyticListItem`:
```typescript
{
  id: string,
  text: string,              // the prompt/question text
  journeyStage: string,     // awareness | consideration | decision
  lengthCategory: string,
  questionScope: string,
  productName?: string,
  productCategory?: string,
  rank?: number,            // brand's best product rank (1 = top)
  score?: number,           // visibility score (0-100)
  sentiment?: number,       // sentiment score
  audience?: { id, title, description, minAge, maxAge, genders, geoLocations, interests, budget },
  competitor?: { id, name, url, geoLocations },
  topics?: { id, name }[],
}
```

#### Detail Response (`GET /v3/stores/{storeId}/prompt-analytics/{id}`)
Extends the list item with:
```typescript
{
  ...PromptAnalyticListItem,
  createdAt: string,
  visibilityScoreData: { month: string, score: number }[],        // monthly trend
  platformVisibilityData: { platform: string, score: number }[],  // per-LLM breakdown
  citationBreakdown: { type: string, percentage: number }[],      // source type %
  domainMentions: { domain: string, type: string, citationCount: number, share: number }[],
  sourceDetails: { url: string, title: string, type: string, brandMentioned: boolean, sentiment: number }[],
  competitors: {                                                   // product rankings
    rank: number,
    brand: string,
    product: string,
    image?: string,
    whyTheyWin?: string,
    isUserProduct: boolean,
    otherBrandsMentioned: string[]
  }[]
}
```

### Key Insights for MCP Design

1. **Most useful MCP tool**: `getPromptAnalytics` with filters — gives an AI agent full visibility into how a brand performs across LLM platforms
2. **The detail view is extremely rich** — a single prompt's performance across platforms, with citations, rankings, sentiment
3. **Filters are powerful** — an AI agent could slice data by geography, platform, journey stage, audience, etc.
4. **The "rank" concept is unique** — it's not search rank, it's "product recommendation position" in LLM responses
5. **Citations reveal HOW to improve** — which domains/sources are being cited gives actionable insights
6. **Product rankings show competitive landscape** — who's winning each prompt and why (`win_reason`)

## MCP Exposure Candidates

Based on the API capabilities, here's what makes sense to expose via MCP:

### High Value (Read operations - safe, informative)
1. **List prompts** - see what prompts exist for a store
2. **Get prompt analytics** - visibility metrics, rankings, sentiment
3. **Get opportunity analytics** - growth opportunities
4. **Get brand identity** - brand profile info
5. **List audiences** - target audience definitions
6. **List competitors** - tracked competitors
7. **List brand topics** - topics being monitored
8. **Get brand writing style** - tone/rules/examples
9. **List geo locations** - active geographic targets
10. **List product categories** - product organization

### Medium Value (Write operations - require care)
11. **Create/update brand identity** - set up brand profile
12. **Create/update audiences** - define target audiences
13. **Create/update competitors** - add competitors to track
14. **Create/update brand topics** - add topics
15. **Create prompts** - generate new monitoring prompts

### Lower Priority
16. **Delete operations** - destructive, may want human confirmation
17. **LLM executor trigger** - triggers Lambda execution (side effects)
