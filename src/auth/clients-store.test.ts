import { describe, it, expect } from 'vitest';
import { createClientsStore } from './clients-store';

describe('OAuthRegisteredClientsStore', () => {
  it('should register a client and generate a unique client ID', () => {
    const store = createClientsStore();
    const metadata = {
      name: 'Test Client',
      redirectUris: ['https://example.com/callback']
    };

    const registeredClient = store.registerClient(metadata);

    expect(registeredClient.clientId).toBeDefined();
    expect(registeredClient.name).toBe('Test Client');
    expect(registeredClient.redirectUris).toEqual(['https://example.com/callback']);
  });

  it('should generate different client IDs for multiple registrations', () => {
    const store = createClientsStore();
    const metadata1 = {
      name: 'Client 1',
      redirectUris: ['https://example1.com/callback']
    };
    const metadata2 = {
      name: 'Client 2',
      redirectUris: ['https://example2.com/callback']
    };

    const client1 = store.registerClient(metadata1);
    const client2 = store.registerClient(metadata2);

    expect(client1.clientId).not.toEqual(client2.clientId);
  });

  it('should throw error for invalid metadata', () => {
    const store = createClientsStore();

    expect(() =>
      store.registerClient({
        name: '',
        redirectUris: []
      })
    ).toThrow('Client name is required');

    expect(() =>
      store.registerClient({
        name: 'Test Client',
        redirectUris: []
      })
    ).toThrow('At least one redirect URI is required');
  });

  it('should retrieve a registered client by ID', () => {
    const store = createClientsStore();
    const metadata = {
      name: 'Retrieve Client',
      redirectUris: ['https://example.com/callback']
    };

    const registeredClient = store.registerClient(metadata);
    const retrievedClient = store.getClient(registeredClient.clientId);

    expect(retrievedClient).toEqual(registeredClient);
  });

  it('should throw error when retrieving non-existent client', () => {
    const store = createClientsStore();

    expect(() =>
      store.getClient('non-existent-client-id')
    ).toThrow('Client non-existent-client-id not found');
  });

  it('should generate unique client IDs', () => {
    const store = createClientsStore();
    const clientIds = new Set();

    for (let i = 0; i < 100; i++) {
      const client = store.registerClient({
        name: `Client ${i}`,
        redirectUris: [`https://example${i}.com/callback`]
      });
      clientIds.add(client.clientId);
    }

    expect(clientIds.size).toBe(100);
  });

  it('should return all registered clients', () => {
    const store = createClientsStore();
    const clientData = [
      { name: 'Client 1', redirectUris: ['https://1.com/callback'] },
      { name: 'Client 2', redirectUris: ['https://2.com/callback'] }
    ];

    const registeredClients = clientData.map(data => store.registerClient(data));
    const allClients = store.getAllClients();

    expect(allClients).toHaveLength(2);
    expect(allClients).toEqual(expect.arrayContaining(registeredClients));
  });
});