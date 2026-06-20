// Outbound sync server fn: pulls clients from a registered org_connection.
// Called from UI ("Sync now") and from a scheduled task.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExternalClient = z.object({
  id: z.string(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  investment_status: z.string().optional().nullable(),
});

export const syncConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { connection_id: string }) => z.object({ connection_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn, error } = await supabaseAdmin
      .from("org_connections")
      .select("*")
      .eq("id", data.connection_id)
      .single();
    if (error || !conn) throw new Error("Connection not found");

    // Check caller has admin on this org
    const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: conn.organization_id,
      _min: "admin",
    });
    if (!ok) throw new Error("Forbidden");

    const startedAt = new Date().toISOString();
    let imported = 0;
    let lastError: string | null = null;

    try {
      const url = conn.base_url.replace(/\/+$/, "") + "/api/clients?limit=500";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Remote responded ${res.status}`);
      const payload = (await res.json()) as { data?: unknown[] } | unknown[];
      const list = Array.isArray(payload) ? payload : (payload.data ?? []);

      for (const raw of list) {
        const parsed = ExternalClient.safeParse(raw);
        if (!parsed.success) continue;
        const c = parsed.data;
        const { data: existing } = await supabaseAdmin
          .from("clients")
          .select("id")
          .eq("organization_id", conn.organization_id)
          .eq("source_app", conn.source_app)
          .eq("external_id", c.id)
          .maybeSingle();
        const patch = {
          first_name: c.first_name ?? null,
          last_name: c.last_name ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          city: c.city ?? null,
          country: c.country ?? null,
          investment_status: c.investment_status ?? null,
        };
        if (existing) {
          await supabaseAdmin.from("clients").update(patch).eq("id", existing.id);
        } else {
          await supabaseAdmin.from("clients").insert({
            ...patch,
            organization_id: conn.organization_id,
            source_app: conn.source_app,
            external_id: c.id,
            owner_id: null,
          });
        }
        imported++;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    await supabaseAdmin
      .from("org_connections")
      .update({
        last_sync_at: startedAt,
        last_sync_status: lastError ? "error" : "ok",
        last_sync_error: lastError,
      })
      .eq("id", conn.id);

    return { imported, error: lastError };
  });
