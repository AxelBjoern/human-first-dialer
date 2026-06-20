import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings/api-docs")({
  head: () => ({ meta: [{ title: "API & MCP docs · VDNX Dialer" }] }),
  component: ApiDocsPage,
});

function Code({ children }: { children: string }) {
  return (
    <div className="relative rounded-lg border bg-muted/50 p-3">
      <pre className="text-xs overflow-x-auto whitespace-pre">
        <code>{children}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-1 right-1 h-7"
        onClick={() => {
          navigator.clipboard.writeText(children);
          toast.success("Copied");
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ApiDocsPage() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-dialer.lovable.app";
  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">API & MCP docs</h1>
        <p className="text-sm text-muted-foreground">
          Connect VDNX, Energy system, and VDNX Executive Command to this dialer via REST API or
          MCP. Generate an API key in{" "}
          <a className="underline" href="/settings/api-keys">
            API keys
          </a>{" "}
          first.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Authentication</h2>
        <p className="text-sm">
          All requests use a Bearer token. One workspace = one or more API keys.
        </p>
        <Code>{`Authorization: Bearer vdnx_<prefix>_<secret>`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">REST · base URL</h2>
        <Code>{`${origin}/api/public/v1`}</Code>

        <h3 className="text-sm font-medium pt-2">Who am I</h3>
        <Code>{`curl ${origin}/api/public/v1/me \\
  -H "Authorization: Bearer YOUR_KEY"`}</Code>

        <h3 className="text-sm font-medium pt-2">List clients</h3>
        <Code>{`curl "${origin}/api/public/v1/clients?limit=50&q=nguyen" \\
  -H "Authorization: Bearer YOUR_KEY"`}</Code>

        <h3 className="text-sm font-medium pt-2">
          Upsert a client (push lead from VDNX / Energy / Executive)
        </h3>
        <Code>{`curl -X POST ${origin}/api/public/v1/clients \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_id": "lead_12345",
    "source_app": "vdnx",
    "first_name": "Ada",
    "last_name": "Lovelace",
    "phone": "+4799999999",
    "email": "ada@example.com",
    "investment_status": "qualified"
  }'`}</Code>

        <h3 className="text-sm font-medium pt-2">Log a call</h3>
        <Code>{`curl -X POST ${origin}/api/public/v1/call-logs \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_e164": "+4799999999",
    "direction": "outbound",
    "duration_s": 124,
    "outcome_code": "connected",
    "notes": "Interested, follow up next week"
  }'`}</Code>

        <h3 className="text-sm font-medium pt-2">Create a reminder</h3>
        <Code>{`curl -X POST ${origin}/api/public/v1/reminders \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "call_time": "2026-07-01T10:00:00Z", "note": "Follow up" }'`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Inbound webhook (real-time push)</h2>
        <p className="text-sm">
          Configure your source app to POST to this URL whenever a lead is created or updated. Sign
          each request body with HMAC-SHA256 using the webhook secret you set on the connection.
        </p>
        <Code>{`POST ${origin}/api/public/v1/webhooks/inbound
x-vdnx-connection: <connection_id from Connections page>
x-vdnx-signature: <hex HMAC-SHA256 of raw body using webhook_secret>
Content-Type: application/json

{
  "event": "client.upserted",
  "client": {
    "external_id": "lead_12345",
    "first_name": "Ada",
    "phone": "+4799999999"
  }
}`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">MCP server</h2>
        <p className="text-sm">
          Streamable HTTP MCP endpoint. Your AI agent connects here with the same Bearer token.
        </p>
        <Code>{`POST ${origin}/api/mcp
Authorization: Bearer YOUR_KEY
Accept: application/json, text/event-stream
Content-Type: application/json`}</Code>
        <p className="text-sm">
          Tools exposed: <code>list_clients</code>, <code>get_client</code>,{" "}
          <code>create_client</code>, <code>log_call</code>, <code>create_reminder</code>,{" "}
          <code>list_reminders</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Per-tenant setup</h2>
        <p className="text-sm">
          Each of your apps (VDNX, Energy system, VDNX Executive Command) should be its own
          workspace here. Create the workspace, generate a separate API key per app, and use them in
          that app's settings.
        </p>
      </section>
    </div>
  );
}
