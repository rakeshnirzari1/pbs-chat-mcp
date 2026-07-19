import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { pbsApiToolHandler } from "./tools/pbsApi.js";
import { pbsApiToolSchema } from "./schemas.js";

const server = new Server(
  {
    name: "pbs-chat-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "pbs_api",
        description: "Query the Australian Pharmaceutical Benefits Scheme (PBS) API for medicine information, pricing, prescribers, and more.",
        inputSchema: {
          type: "object",
          properties: {
            endpoint: {
              type: "string",
              description: "The PBS API endpoint to query (e.g., 'items', 'prescribers', 'item-overview', 'schedules', 'atc-codes', 'organisations', 'restrictions', 'parameters', 'criteria', 'copayments', 'fees', 'markup-bands', 'programs', 'summary-of-changes')",
              enum: [
                "items",
                "prescribers",
                "item-overview",
                "schedules",
                "atc-codes",
                "organisations",
                "restrictions",
                "parameters",
                "criteria",
                "copayments",
                "fees",
                "markup-bands",
                "programs",
                "summary-of-changes"
              ]
            },
            method: {
              type: "string",
              description: "HTTP method (GET or POST)",
              enum: ["GET", "POST"],
              default: "GET"
            },
            params: {
              type: "object",
              description: "Query parameters for the API call",
              additionalProperties: true
            },
            subscriptionKey: {
              type: "string",
              description: "Custom PBS API subscription key (optional - uses default if not provided)"
            },
            timeout: {
              type: "number",
              description: "Request timeout in milliseconds",
              default: 30000
            }
          },
        required: ["endpoint"]
      }
          ],
        };
      });

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "pbs_api") {
    try {
      const validated = pbsApiToolSchema.parse(args);
      const result = await pbsApiToolHandler(validated);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[PBS Chat MCP] Server started successfully");
}

main().catch((error) => {
  console.error("[PBS Chat MCP] Fatal error:", error);
  process.exit(1);
});