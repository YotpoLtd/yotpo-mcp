import crypto from 'crypto';

export interface OAuthClientMetadata {
  name: string;
  redirectUris: string[];
  scopes: string[];
  // Optional additional metadata
  description?: string;
  logoUrl?: string;
}

export interface OAuthRegisteredClient extends OAuthClientMetadata {
  clientId: string;
  createdAt: Date;
}

export interface OAuthRegisteredClientsStore {
  registerClient(metadata: OAuthClientMetadata): OAuthRegisteredClient;
  getClient(clientId: string): OAuthRegisteredClient | undefined;
  getAllClients(): OAuthRegisteredClient[];
}

export function createClientsStore(): OAuthRegisteredClientsStore {
  const clients = new Map<string, OAuthRegisteredClient>();

  // Generate a secure, unique client ID
  function generateClientId(): string {
    const timestamp = Date.now();
    const randomPart = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${randomPart}`;
  }

  return {
    registerClient(metadata: OAuthClientMetadata): OAuthRegisteredClient {
      // Validate input
      if (!metadata.name || metadata.name.trim() === '') {
        throw new Error('Client name is required');
      }

      if (!metadata.redirectUris || metadata.redirectUris.length === 0) {
        throw new Error('At least one redirect URI is required');
      }

      // Optional: Validate redirect URIs
      metadata.redirectUris.forEach(uri => {
        try {
          new URL(uri);
        } catch {
          throw new Error(`Invalid redirect URI: ${uri}`);
        }
      });

      // Prevent duplicate client names
      const existingClient = Array.from(clients.values()).find(
        client => client.name === metadata.name
      );

      if (existingClient) {
        throw new Error(`Client with name '${metadata.name}' already exists`);
      }

      const clientId = generateClientId();
      const registeredClient: OAuthRegisteredClient = {
        ...metadata,
        clientId,
        createdAt: new Date()
      };

      // Thread-safe insertion using Map
      clients.set(clientId, registeredClient);

      return { ...registeredClient }; // Return a copy to prevent mutation
    },

    getClient(clientId: string): OAuthRegisteredClient {
      const client = clients.get(clientId);
      if (!client) {
        throw new Error(`Client ${clientId} not found`);
      }
      return { ...client }; // Return a copy
    },

    getAllClients(): OAuthRegisteredClient[] {
      return Array.from(clients.values()).map(client => ({ ...client }));
    }
  };
}