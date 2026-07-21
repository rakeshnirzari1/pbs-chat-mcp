import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import { pbsApiToolHandler } from "./tools/pbsApi.js";
import { pbsApiToolSchema } from "./schemas.js";

dotenv.config();

const server = new Server(
  { name: "pbs-chat-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const PBS_ENDPOINTS = [
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
  "summary-of-changes",
] as const;

const toolSchema = {
  type: "object" as const,
  properties: {
    endpoint: {
      type: "string",
      description: "The PBS API endpoint to query",
      enum: PBS_ENDPOINTS,
    },
    method: { type: "string", enum: ["GET", "POST"], default: "GET" },
    params: { type: "object", additionalProperties: true },
    subscriptionKey: { type: "string" },
    timeout: { type: "number", default: 30000 },
  },
  required: ["endpoint"],
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "pbs_api",
      description: "Query the Australian Pharmaceutical Benefits Scheme (PBS) API for medicine information, pricing, prescribers, and more.",
      inputSchema: toolSchema,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "pbs_api") throw new Error(`Unknown tool: ${name}`);
  try {
    const validated = pbsApiToolSchema.parse(args);
    const result = await pbsApiToolHandler(validated);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
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