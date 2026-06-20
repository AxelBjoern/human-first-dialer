import { createFileRoute } from "@tanstack/react-router";
import { createMcpServer, withMcpAuth } from "mcp-tanstack-start";
import { dialerTools } from "@/lib/mcp/tools/dialer.server";
import { parseBearer, verifyApiKey } from "@/lib/api-auth.server";

const mcp = createMcpServer({
  name: "vdnx-dialer-mcp",
  version: "1.0.0",
  instructions:
    "Tools to list clients, place click-to-dial calls, log call outcomes, and manage reminders inside a VDNX Dialer workspace. Authenticate with a workspace API key as a Bearer token.",
  tools: dialerTools,
});

const methodNotAllowed = () =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" } },
  );

const authedHandler = withMcpAuth(
  async (request, auth) => mcp.handleRequest(request, { auth }),
  async (request) => {
    const token = parseBearer(request.headers.get("authorization"));
    if (!token) return null;
    const result = await verifyApiKey(token);
    if (!result) return null;
    return {
      token,
      scopes: result.scopes,
      claims: { organization_id: result.organization_id, key_id: result.key_id },
    };
  },
);

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => authedHandler(request),
      GET: async () => methodNotAllowed(),
      DELETE: async () => methodNotAllowed(),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "authorization, content-type",
          },
        }),
    },
  },
});
