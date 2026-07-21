import express from "express";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { pbsApiToolHandler } from "./tools/pbsApi.js";
import { pbsApiToolSchema } from "./schemas.js";
import dotenv from "dotenv";

dotenv.config();

function createServer() {
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

  return server;
}

const app = express();
app.use((req, res, next) => {
  // Legacy SSE transport parses JSON-RPC payloads from raw stream.
  // If express.json() runs first, the stream is consumed and becomes unreadable.
  if (req.path === "/messages") {
    return next();
  }
  return express.json()(req, res, next);
});

const transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport> = {};

app.all("/mcp", async (req, res) => {
  try {
    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId] instanceof StreamableHTTPServerTransport) {
      transport = transports[sessionId] as StreamableHTTPServerTransport;
    } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          console.error(`[PBS Chat MCP] Streamable HTTP session initialized: ${sid}`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
          console.error(`[PBS Chat MCP] Streamable HTTP session closed: ${sid}`);
        }
      };

      const server = createServer();
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[PBS Chat MCP] Streamable HTTP error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/sse", async (req, res) => {
  try {
    console.error("[PBS Chat MCP] New SSE connection requested");
    const server = createServer();
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;

    res.on("close", () => {
      console.error(`[PBS Chat MCP] SSE connection closed: ${transport.sessionId}`);
      // Don't delete immediately - keep for a grace period
      setTimeout(() => {
        delete transports[transport.sessionId];
      }, 60000); // 60 second grace period
    });

    await server.connect(transport);
    console.error(`[PBS Chat MCP] SSE transport connected: ${transport.sessionId} (total: ${Object.keys(transports).length})`);
  } catch (error) {
    console.error("[PBS Chat MCP] SSE connection error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  console.error(`[PBS Chat MCP] POST /messages for session: ${sessionId}`);
  const transport = transports[sessionId];
  if (transport instanceof SSEServerTransport) {
    await transport.handlePostMessage(req, res);
  } else {
    console.error(`[PBS Chat MCP] No transport found for session: ${sessionId}`);
    console.error(`[PBS Chat MCP] Available sessions: ${Object.keys(transports).join(", ")}`);
    res.status(400).send("No transport found for sessionId");
  }
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", service: "pbs-chat-mcp" }));

// Root info
app.get("/", (req, res) => {
  res.json({
    name: "pbs-chat-mcp",
    version: "1.0.0",
    transports: { mcp: "/mcp", sse: "/sse", messages: "/messages" }
  });
});

process.on("uncaughtException", (err) => {
  console.error("[PBS Chat MCP] Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[PBS Chat MCP] Unhandled Rejection:", reason);
  process.exit(1);
});

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.error(`[PBS Chat MCP] HTTP server running on port ${PORT}`);
  console.error(`[PBS Chat MCP] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.error(`[PBS Chat MCP] SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`[PBS Chat MCP] Messages endpoint: http://localhost:${PORT}/messages`);
  console.error(`[PBS Chat MCP] Health: http://localhost:${PORT}/health`);
  console.error(`[PBS Chat MCP] Ready for connections`);
});