import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; name: string }) =>
    z.object({ organization_id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateApiKey } = await import("@/lib/api-auth.server");

    const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: data.organization_id,
      _min: "admin",
    });
    if (!ok) throw new Error("Forbidden");

    const { plain, key_prefix, key_hash } = generateApiKey();
    const { data: row, error } = await supabaseAdmin
      .from("org_api_keys")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        key_prefix,
        key_hash,
        created_by: context.userId,
      })
      .select("id, name, key_prefix, scopes, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { key: row, plain };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: key } = await supabaseAdmin
      .from("org_api_keys")
      .select("organization_id")
      .eq("id", data.id)
      .single();
    if (!key) throw new Error("Not found");
    const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: key.organization_id,
      _min: "admin",
    });
    if (!ok) throw new Error("Forbidden");
    await supabaseAdmin
      .from("org_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organization_id: string; email?: string; role: "owner" | "admin" | "agent" }) =>
      z
        .object({
          organization_id: z.string().uuid(),
          email: z.string().email().optional(),
          role: z.enum(["owner", "admin", "agent"]),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("node:crypto");
    const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: data.organization_id,
      _min: "admin",
    });
    if (!ok) throw new Error("Forbidden");
    const code = randomBytes(12).toString("base64url");
    const { data: row, error } = await supabaseAdmin
      .from("org_invites")
      .insert({
        organization_id: data.organization_id,
        email: data.email ?? null,
        role: data.role,
        code,
        invited_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
