import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pbsApiToolHandler } from "./tools/pbsApi.js";
import { pbsApiToolSchema } from "./schemas.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const server = new Server(
  { name: "pbs-chat-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const PBS_ENDPOINTS = [
  "items", "prescribers", "item-overview", "schedules", "atc-codes",
  "organisations", "restrictions", "parameters", "criteria",
  "copayments", "fees", "markup-bands", "programs", "summary-of-changes",
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "pbs_api",
    description: "Query the Australian Pharmaceutical Benefits Scheme (PBS) API for medicine information, pricing, prescribers, and more.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: { type: "string", enum: PBS_ENDPOINTS },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        params: { type: "object", additionalProperties: true },
        subscriptionKey: { type: "string" },
        timeout: { type: "number", default: 30000 },
      },
      required: ["endpoint"],
    },
  }],
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

// Streamable HTTP Transport - handles both GET (SSE) and POST at root "/"
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

server.connect(transport).catch((err) => {
  console.error("[PBS Chat MCP] Failed to connect transport:", err);
  process.exit(1);
});

// Let the transport handle body parsing - only add express.json for health
app.use((req, res, next) => {
  if (req.path === "/health") {
    express.json()(req, res, next);
  } else {
    next();
  }
});

// MCP endpoint at root - handles both GET and POST
app.all("/", (req, res) => transport.handleRequest(req, res));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", service: "pbs-chat-mcp" }));

// Error handlers
process.on("uncaughtException", (err) => {
  console.error("[PBS Chat MCP] Uncaught:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[PBS Chat MCP] Unhandled:", reason);
  process.exit(1);
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.error(`[PBS Chat MCP] HTTP server on port ${PORT}`);
  console.error(`[PBS Chat MCP] MCP endpoint: http://localhost:${PORT}/`);
  console.error(`[PBS Chat MCP] Health: http://localhost:${PORT}/health`);
  console.error(`[PBS Chat MCP] Ready`);
});