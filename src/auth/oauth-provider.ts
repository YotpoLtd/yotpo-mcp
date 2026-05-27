import { URL } from 'node:url';
import { createHash } from 'node:crypto';
import axios, { AxiosInstance } from 'axios';

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  issuerBaseUrl: string;
  baseUrl: string;
  audience?: string;
  scope?: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  idToken?: string;
}

export interface OAuthServerProvider {
  authorize(params?: Record<string, string>): Promise<string>;
  exchangeAuthorizationCode(code: string, codeVerifier?: string): Promise<OAuthTokens>;
  exchangeRefreshToken(refreshToken: string): Promise<OAuthTokens>;
  verifyAccessToken(token: string): Promise<boolean>;
  revokeToken?(token: string): Promise<boolean>;
}

export function createOAuthProvider(config: OAuthProviderConfig): OAuthServerProvider {
  const client: AxiosInstance = axios.create({
    baseURL: config.issuerBaseUrl,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  function generateCodeVerifier(): string {
    return Buffer.from(crypto.randomBytes(32)).toString('base64url');
  }

  function generateCodeChallenge(codeVerifier: string): string {
    return createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  return {
    async authorize(params: Record<string, string> = {}) {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);

      const authorizeParams = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.baseUrl,
        scope: (config.scope || ['openid', 'profile', 'email']).join(' '),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        ...params,
      });

      const authorizeUrl = new URL('/authorize', config.issuerBaseUrl);
      authorizeUrl.search = authorizeParams.toString();

      return authorizeUrl.toString();
    },

    async exchangeAuthorizationCode(code: string, codeVerifier?: string) {
      try {
        const tokenParams = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.baseUrl,
          ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
        });

        const response = await client.post('/oauth/token', tokenParams);
        const {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: expiresIn,
          id_token: idToken
        } = response.data;

        return {
          accessToken,
          refreshToken,
          expiresIn,
          idToken
        };
      } catch (error) {
        console.error('Authorization code exchange failed', error);
        throw new Error('Failed to exchange authorization code');
      }
    },

    async exchangeRefreshToken(refreshToken: string) {
      try {
        const tokenParams = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
        });

        const response = await client.post('/oauth/token', tokenParams);
        const {
          access_token: accessToken,
          refresh_token: newRefreshToken,
          expires_in: expiresIn,
          id_token: idToken
        } = response.data;

        return {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn,
          idToken
        };
      } catch (error) {
        console.error('Refresh token exchange failed', error);
        throw new Error('Failed to exchange refresh token');
      }
    },

    async verifyAccessToken(token: string): Promise<boolean> {
      try {
        // Note: Actual verification done by Kong, this is a lightweight check
        const response = await client.get('/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });

        return response.status === 200;
      } catch {
        return false;
      }
    },

    async revokeToken?(token: string): Promise<boolean> {
      try {
        const revokeParams = new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          token
        });

        const response = await client.post('/oauth/revoke', revokeParams);
        return response.status === 200;
      } catch (error) {
        console.error('Token revocation failed', error);
        return false;
      }
    }
  };
}

export default createOAuthProvider;