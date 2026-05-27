export interface DiscoverClientConfig {
  baseUrl?: string;
  storeId: string;
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

export interface DiscoverClient {
  getBrandIdentity(): Promise<unknown>;
  listPrompts(params?: ListPromptsParams): Promise<unknown>;
  getPromptAnalytics(params?: PromptAnalyticsParams): Promise<unknown>;
}

function serializeParams(
  params: Record<string, unknown> | undefined
): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (!params) {
    return searchParams;
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (key === "includeSummary") {
      if (value === true) {
        searchParams.set("include", "summary");
      }
      continue;
    }

    if (Array.isArray(value)) {
      searchParams.set(key, value.join(","));
    } else if (typeof value === "boolean") {
      searchParams.set(key, String(value));
    } else if (typeof value === "number") {
      searchParams.set(key, String(value));
    } else {
      searchParams.set(key, String(value));
    }
  }

  return searchParams;
}

export function createDiscoverClient(config: DiscoverClientConfig): DiscoverClient {
  // Use environment or default base URL, with support for VPC-internal calls
  const baseUrl = config.baseUrl ||
    process.env.DISCOVER_API_BASE_URL ||
    'https://api.yotpo.com/discover/v3/stores';

  async function request(
    path: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    // Use provided or Kong-injected store ID
    const searchParams = serializeParams(params);
    const queryString = searchParams.toString();
    const url = queryString
      ? `${baseUrl}/${config.storeId}${path}?${queryString}`
      : `${baseUrl}/${config.storeId}${path}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          // Accept header for content negotiation
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Discover API error: ${response.status} ${body}`
        );
      }

      return response.json();
    } catch (error) {
      // Standardized error handling
      console.error('Discover API request failed:', error);
      throw error;
    }
  }

  return {
    getBrandIdentity() {
      return request("/brand-identity");
    },
    listPrompts(params?: ListPromptsParams) {
      return request("/prompts", params as Record<string, unknown>);
    },
    getPromptAnalytics(params?: PromptAnalyticsParams) {
      return request("/prompt-analytics", params as Record<string, unknown>);
    },
  };
}