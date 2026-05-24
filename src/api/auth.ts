export interface AuthConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

export function createAuthClient(config: AuthConfig): {
  getToken: () => Promise<string>;
} {
  let cache: TokenCache | null = null;
  let inflight: Promise<TokenCache> | null = null;

  async function fetchToken(): Promise<TokenCache> {
    const url = `https://${config.domain}/oauth/token`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        audience: config.audience,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Auth0 token request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    const expiresIn = data.expires_in ?? 3600;

    return {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };
  }

  async function getToken(): Promise<string> {
    if (cache && Date.now() < cache.expiresAt) {
      return cache.token;
    }

    if (!inflight) {
      inflight = fetchToken().finally(() => {
        inflight = null;
      });
    }

    cache = await inflight;
    return cache.token;
  }

  return { getToken };
}
