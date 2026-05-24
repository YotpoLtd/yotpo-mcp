export interface DiscoverClientConfig {
  storeId: string;
  getToken: () => Promise<string>;
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
      searchParams.set(key, value as string);
    }
  }

  return searchParams;
}

export function createDiscoverClient(config: DiscoverClientConfig): DiscoverClient {
  const baseUrl = `https://api.yotpo.com/discover/v3/stores/${config.storeId}`;

  async function request(
    path: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const token = await config.getToken();
    const searchParams = serializeParams(params);
    const queryString = searchParams.toString();
    const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Discover API error: ${response.status} ${body}`
      );
    }

    return response.json();
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
