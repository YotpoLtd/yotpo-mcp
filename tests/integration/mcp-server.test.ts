import { vi, describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/server';
import { loadEnv } from '../../src/config/env';

const MCP_HTTP_HEADERS = {
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
};

function initializeBody(requestId: number | string = 1) {
  return {
    jsonrpc: '2.0',
    id: requestId,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'integration-test', version: '1.0.0' },
    },
  };
}

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
    process.env.NODE_ENV = 'test';
    const env = loadEnv();
    app = createApp(env);
  });

  describe('Authenticated Requests', () => {
    it('should handle authenticated MCP initialize with valid store ID', async () => {
      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .set('x-introspection-store-id', 'test-store-123')
        .set('x-introspection-user-email', 'test-user@yotpo.com')
        .set('x-introspection-external-user-id', 'external-user-456')
        .send(initializeBody())
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.text).toContain('"jsonrpc":"2.0"');
      expect(response.text).toContain('capabilities');
    });

    it('should reject request without store ID header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .send(initializeBody())
        .expect(401);

      expect(response.body.error).toEqual('Unauthorized');
      expect(['Missing store identity', 'Invalid store identity format']).toContain(response.body.message);
    });

    it('should extract store ID from Kong headers correctly', async () => {
      const testStoreId = 'unique-store-789';

      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .set('x-introspection-store-id', testStoreId)
        .send(initializeBody())
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should handle requests with partial optional headers', async () => {
      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .set('x-introspection-store-id', 'test-store-partial')
        .set('x-introspection-user-email', 'partial-user@yotpo.com')
        .send(initializeBody())
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/event-stream/);
    });

    it('should handle invalid header values gracefully', async () => {
      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .set('x-introspection-store-id', '')
        .send(initializeBody())
        .expect(401);

      expect(response.body.error).toEqual('Unauthorized');
      expect(['Invalid store identity format', 'Missing store identity']).toContain(response.body.message);
    });
  });

  describe('Authentication Context', () => {
    it('should complete MCP initialization when full Kong headers are provided', async () => {
      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .set('x-introspection-store-id', 'context-test-store')
        .set('x-introspection-user-email', 'context-user@yotpo.com')
        .set('x-introspection-external-user-id', 'context-external-123')
        .set('x-introspection-agency-id', 'agency-456')
        .set('x-introspection-organization-key', 'org-789')
        .send(initializeBody())
        .expect(200);

      expect(response.text).toContain('"serverInfo"');
      expect(response.text).toContain('"name":"yotpo-mcp"');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed headers', async () => {
      const response = await request(app)
        .post('/mcp')
        .set(MCP_HTTP_HEADERS)
        .set('x-introspection-store-id', 'invalid store id with spaces')
        .send(initializeBody())
        .expect(401);

      expect(response.body).toEqual({
        error: 'Unauthorized',
        message: 'Invalid store identity format'
      });
    });
  });
});
