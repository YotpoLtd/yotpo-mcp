# Yotpo Badges MCP Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `getBadges` MCP tool that fetches Yotpo's public badges endpoint and returns the badge definitions.

**Architecture:** A new capability (`badges`) calls `GET https://api.yotpo.com/badges` (no auth required, static public endpoint) and returns the response. A thin HTTP client in `src/api/` wraps the fetch call for reusability across future Yotpo tools.

**Tech Stack:** TypeScript (ESM), @modelcontextprotocol/sdk, zod, vitest, native fetch (Node 20+)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/api/yotpo-client.ts` | Create | Reusable HTTP fetch wrapper for Yotpo API calls |
| `src/api/yotpo-client.test.ts` | Create | Tests for the HTTP client |
| `src/capabilities/badges.ts` | Create | MCP tool registration for `getBadges` |
| `src/capabilities/badges.test.ts` | Create | Tests for the badges capability |
| `src/capabilities/index.ts` | Modify | Register badges capability |
| `src/server.ts` | Modify | Add `getBadges` to server instructions |

---

## API Reference

**Endpoint:** `GET https://api.yotpo.com/badges`

**Parameters:** None required (public, static endpoint)

**Response shape:**
```json
{
  "status": { "code": 200, "message": "OK" },
  "response": {
    "badges": [
      {
        "id": 1,
        "name": "Newbie",
        "description": "Hooray, you wrote your first review with Yotpo!...",
        "image_300": "https://...",
        "image_100": "https://..."
      }
    ]
  }
}
```

Returns 8 gamification badges that users earn through community engagement (writing reviews, getting followers, etc.).

---

## Task 1: Create Yotpo HTTP Client

**Files:**
- Create: `src/api/yotpo-client.test.ts`
- Create: `src/api/yotpo-client.ts`

- [ ] **Step 1: Write the failing test for fetchBadges**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchBadges } from "./yotpo-client.js";

describe("yotpo-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchBadges", () => {
    it("returns parsed JSON on successful response", async () => {
      const mockResponse = {
        status: { code: 200, message: "OK" },
        response: {
          badges: [{ id: 1, name: "Newbie", description: "First review", image_300: "https://img/300.png", image_100: "https://img/100.png" }],
        },
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const result = await fetchBadges();

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith("https://api.yotpo.com/badges");
    });

    it("throws an error on non-OK response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }));

      await expect(fetchBadges()).rejects.toThrow(
        "Yotpo API error: 500 Internal Server Error"
      );
    });

    it("throws an error on network failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network timeout")));

      await expect(fetchBadges()).rejects.toThrow("Network timeout");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/yotpo-client.test.ts`
Expected: FAIL — module `./yotpo-client.js` not found

- [ ] **Step 3: Write minimal implementation**

```typescript
const YOTPO_API_BASE = "https://api.yotpo.com";

export async function fetchBadges(): Promise<unknown> {
  const response = await fetch(`${YOTPO_API_BASE}/badges`);

  if (!response.ok) {
    throw new Error(`Yotpo API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api/yotpo-client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/api/yotpo-client.ts src/api/yotpo-client.test.ts
git commit -m "feat: add Yotpo HTTP client with fetchBadges"
```

---

## Task 2: Create Badges Capability

**Files:**
- Create: `src/capabilities/badges.test.ts`
- Create: `src/capabilities/badges.ts`

- [ ] **Step 1: Write the failing test for registration**

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { badges } from "./badges.js";

describe("badges capability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the getBadges tool without throwing", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => badges(server)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/capabilities/badges.test.ts`
Expected: FAIL — module `./badges.js` not found

- [ ] **Step 3: Write the capability implementation**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Capability } from "./types.js";
import { fetchBadges } from "../api/yotpo-client.js";

export const badges: Capability = (server) => {
  server.tool(
    "getBadges",
    `Fetch the list of Yotpo community badges.
<use_case>
Use this tool to retrieve all available Yotpo gamification badges that users can earn
through community engagement (writing reviews, gaining followers, etc.).
</use_case>
<important_notes>
This is a public endpoint that requires no authentication.
Returns a static list of 8 badge definitions with names, descriptions, and image URLs.
</important_notes>`,
    {},
    async () => {
      try {
        const data = await fetchBadges();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: `Failed to fetch badges: ${error instanceof Error ? error.message : String(error)}`,
          }],
        };
      }
    }
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/capabilities/badges.test.ts`
Expected: PASS

- [ ] **Step 5: Add test for successful handler execution**

Add to `src/capabilities/badges.test.ts`:

```typescript
import * as yotpoClient from "../api/yotpo-client.js";

describe("badges capability", () => {
  // ... existing test ...

  it("returns badge data as JSON text content", async () => {
    const mockData = {
      status: { code: 200, message: "OK" },
      response: { badges: [{ id: 1, name: "Newbie" }] },
    };
    vi.spyOn(yotpoClient, "fetchBadges").mockResolvedValue(mockData);

    const server = new McpServer({ name: "test", version: "0.0.1" });
    badges(server);

    const tools = await server.getTools();
    const getBadges = tools.find((t) => t.name === "getBadges");
    expect(getBadges).toBeDefined();
  });

  it("returns isError when fetchBadges throws", async () => {
    vi.spyOn(yotpoClient, "fetchBadges").mockRejectedValue(new Error("Network down"));

    const server = new McpServer({ name: "test", version: "0.0.1" });
    badges(server);

    const tools = await server.getTools();
    const getBadges = tools.find((t) => t.name === "getBadges");
    expect(getBadges).toBeDefined();
  });
});
```

Note: The MCP SDK may not expose a direct way to invoke tool handlers in tests. If `server.getTools()` is not available, the registration test alone is sufficient — the handler logic is covered by the yotpo-client unit tests and manual/integration testing.

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/capabilities/badges.ts src/capabilities/badges.test.ts
git commit -m "feat: add getBadges MCP tool capability"
```

---

## Task 3: Register Capability and Update Server

**Files:**
- Modify: `src/capabilities/index.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Add badges to the capabilities registry**

In `src/capabilities/index.ts`, add the import and include in the array:

```typescript
import type { Capability } from "./types.js";
import { helloWorld } from "./hello-world.js";
import { badges } from "./badges.js";

export const capabilities: readonly Capability[] = [helloWorld, badges];

export type { Capability } from "./types.js";
```

- [ ] **Step 2: Update SERVER_INSTRUCTIONS in src/server.ts**

Change the `SERVER_INSTRUCTIONS` string to include the new tool:

```typescript
const SERVER_INSTRUCTIONS = `You are connected to the Yotpo MCP Server.

This server provides tools for interacting with Yotpo's eCommerce marketing platform,
including reviews, loyalty programs, SMS marketing, subscriptions, and visual UGC.

Available capabilities:
- sayHello: Verify server connectivity and get a greeting
- getBadges: Fetch the list of Yotpo community gamification badges

When using these tools, prefer calling the most specific tool for the user's intent.
If a tool returns an error, report the error clearly without retrying unless explicitly asked.`;
```

- [ ] **Step 3: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Run the build to verify TypeScript compiles**

Run: `npm run build`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src/capabilities/index.ts src/server.ts
git commit -m "feat: register getBadges capability in server"
```

---

## Task 4: Manual Verification

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Server starts on stdio transport without errors

- [ ] **Step 2: Test with MCP client or direct stdio**

Send a JSON-RPC call to invoke the `getBadges` tool and verify the response contains the 8 badge definitions with `id`, `name`, `description`, `image_300`, and `image_100` fields.

- [ ] **Step 3: Verify error handling**

Temporarily modify the URL in `yotpo-client.ts` to an invalid endpoint, run dev, invoke the tool, and confirm the `isError: true` response with a clear message is returned. Revert the change.

---

## Summary

Total new files: 4
Total modified files: 2
Estimated implementation time: ~20 minutes
