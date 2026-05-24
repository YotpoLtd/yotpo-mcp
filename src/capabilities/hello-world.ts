import { z } from "zod";
import type { Capability } from "./types.js";

export const helloWorld: Capability = (server) => {
  server.tool(
    "sayHello",
    `Greet a user by name on behalf of Yotpo.

<use_case>
Use this tool when the user wants to test the connection to the Yotpo MCP server,
verify the server is running, or simply wants a greeting.
Aliases: greet, hello, hi, ping
</use_case>

<important_notes>
This is a demo tool for verifying the MCP server is operational.
It will be replaced with real Yotpo API capabilities in future versions.
</important_notes>`,
    { name: z.string().describe("The name of the person to greet") },
    async ({ name }) => {
      return {
        content: [
          {
            type: "text" as const,
            text: `Hello, ${name}! Welcome to the Yotpo MCP Server. The server is operational and ready to assist you with Yotpo's platform capabilities.`,
          },
        ],
      };
    }
  );
};
