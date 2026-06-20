// Inbound webhook: VDNX / Energy / Executive push lead/client updates here.
// HMAC signed with each connection's webhook_secret.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getAdmin, jsonError, jsonOk } from "@/lib/api-auth.server";

const Payload = z.object({
  event: z.enum(["client.upserted", "client.deleted"]),
  client: z.object({
    external_id: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    investment_status: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

export const Route = createFileRoute("/api/public/v1/webhooks/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const connectionId = request.headers.get("x-vdnx-connection");
        const signature = request.headers.get("x-vdnx-signature");
        if (!connectionId || !signature) return jsonError(400, "Missing headers");
        const raw = await request.text();

        const admin = getAdmin();
        const { data: conn } = await admin
          .from("org_connections")
          .select("id, organization_id, webhook_secret, source_app, enabled")
          .eq("id", connectionId)
          .maybeSingle();
        if (!conn || !conn.enabled || !conn.webhook_secret) return jsonError(401, "Unknown connection");

        const expected = createHmac("sha256", conn.webhook_secret).update(raw).digest("hex");
        const got = Buffer.from(signature);
        const want = Buffer.from(expected);
        if (got.length !== want.length || !timingSafeEqual(got, want)) {
          return jsonError(401, "Invalid signature");
        }

        let body: unknown;
        try { body = JSON.parse(raw); } catch { return jsonError(400, "Invalid JSON"); }
        const parsed = Payload.safeParse(body);
        if (!parsed.success) return jsonError(400, parsed.error.message);

        if (parsed.data.event === "client.deleted") {
          await admin
            .from("clients")
            .delete()
            .eq("organization_id", conn.organization_id)
            .eq("source_app", conn.source_app)
            .eq("external_id", parsed.data.client.external_id);
          return jsonOk({ ok: true });
        }

        const c = parsed.data.client;
        // Upsert by (org, source_app, external_id) — emulated via select-then-update/insert
        const { data: existing } = await admin
          .from("clients")
          .select("id")
          .eq("organization_id", conn.organization_id)
          .eq("source_app", conn.source_app)
          .eq("external_id", c.external_id)
          .maybeSingle();
        if (existing) {
          await admin.from("clients").update(c as never).eq("id", existing.id);
        } else {
          await admin.from("clients").insert({
            ...c,
            organization_id: conn.organization_id,
            source_app: conn.source_app,
          } as never);
        }
        return jsonOk({ ok: true });
      },
    },
  },
});
