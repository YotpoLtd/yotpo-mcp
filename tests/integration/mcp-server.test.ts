import { vi, describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/server';
import { loadEnv } from '../../src/config/env';
import { capabilities } from '../../src/capabilities/index';

// Mock the capabilities to prevent actual tool registrations
vi.mock('../../src/capabilities/index', () => ({
  capabilities: []
}));

// Mock the discover client to prevent actual API calls
vi.mock('../../src/api/discover-client', () => ({
  createDiscoverClient: vi.fn().mockReturnValue({
    getBrandIdentity: vi.fn().mockResolvedValue({
      name: 'Test Store',
      id: 'test-store-id'
    }),
    listPrompts: vi.fn().mockResolvedValue({
      prompts: []
    }),
    getPromptAnalytics: vi.fn().mockResolvedValue({
      analytics: {}
    })
  })
}));

// Mock the server capabilities registration to prevent actual tool registrations
vi.mock('../../src/capabilities/discover/index', () => ({
  registerDiscoverCapabilities: vi.fn()
}));

describe('MCP Server Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    // Load environment configuration in test mode
    process.env.NODE_ENV = 'test';
    const env = loadEnv();
    app = createApp(env);
  });

  describe('Authenticated Requests', () => {
    it('should handle authenticated request with valid store ID', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('x-introspection-store-id', 'test-store-123')
        .set('x-introspection-user-email', 'test-user@yotpo.com')
        .set('x-introspection-external-user-id', 'external-user-456')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.context).toEqual(
        expect.objectContaining({
          storeId: 'test-store-123'
        })
      );
    });

    it('should reject request without store ID header', async () => {
      const response = await request(app)
        .post('/mcp')
        .expect(401);

      expect(response.body.error).toEqual('Unauthorized');
      expect(['Missing store identity', 'Invalid store identity format']).toContain(response.body.message);
    });

    it('should extract store ID from Kong headers correctly', async () => {
      const testStoreId = 'unique-store-789';

      const response = await request(app)
        .post('/mcp')
        .set('x-introspection-store-id', testStoreId)
        .expect(200);

      expect(response.body.context).toEqual(
        expect.objectContaining({
          storeId: testStoreId
        })
      );
    });

    it('should handle requests with partial optional headers', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('x-introspection-store-id', 'test-store-partial')
        .set('x-introspection-user-email', 'partial-user@yotpo.com')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.context).toEqual(
        expect.objectContaining({
          storeId: 'test-store-partial',
          authContext: expect.objectContaining({
            storeId: 'test-store-partial'
          })
        })
      );
    });

    it('should handle invalid header values gracefully', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('x-introspection-store-id', '')
        .expect(401);

      expect(response.body.error).toEqual('Unauthorized');
      expect(['Invalid store identity format', 'Missing store identity']).toContain(response.body.message);
    });
  });

  describe('Authentication Context', () => {
    it('should populate full authentication context', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('x-introspection-store-id', 'context-test-store')
        .set('x-introspection-user-email', 'context-user@yotpo.com')
        .set('x-introspection-external-user-id', 'context-external-123')
        .set('x-introspection-agency-id', 'agency-456')
        .set('x-introspection-organization-key', 'org-789')
        .expect(200);

      expect(response.body.context.authContext).toEqual({
        storeId: 'context-test-store',
        userEmail: 'context-user@yotpo.com',
        externalUserId: 'context-external-123',
        agencyId: 'agency-456',
        organizationKey: 'org-789'
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed headers', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('x-introspection-store-id', 'invalid store id with spaces')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Invalid store identity format'
      });
    });
  });
});