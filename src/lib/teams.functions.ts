// Server functions for teams + team-leader assignment (admin-managed).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(orgId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
    _uid: userId,
    _org: orgId,
    _min: "admin",
  });
  if (!ok) throw new Error("Forbidden");
}

export const listTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: data.organization_id,
    });
    if (!member) throw new Error("Forbidden");
    const { data: rows, error } = await supabaseAdmin
      .from("teams")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; name: string; lead_user_id?: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        name: z.string().min(1),
        lead_user_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(data.organization_id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("teams")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        lead_user_id: data.lead_user_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (data.lead_user_id) await promoteToLead(data.organization_id, data.lead_user_id);
    return row;
  });

export const assignMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; user_id: string; team_id: string | null }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        user_id: z.string().uuid(),
        team_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(data.organization_id, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_members")
      .update({ team_id: data.team_id })
      .eq("organization_id", data.organization_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTeamLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { team_id: string; lead_user_id: string | null }) =>
    z.object({ team_id: z.string().uuid(), lead_user_id: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team, error } = await supabaseAdmin
      .from("teams")
      .select("id, organization_id")
      .eq("id", data.team_id)
      .single();
    if (error || !team) throw new Error("Team not found");
    await requireAdmin(team.organization_id, context.userId);
    const { data: row, error: uErr } = await supabaseAdmin
      .from("teams")
      .update({ lead_user_id: data.lead_user_id })
      .eq("id", team.id)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);
    if (data.lead_user_id) await promoteToLead(team.organization_id, data.lead_user_id);
    return row;
  });

// Promote a member to team_lead if they are currently a plain agent.
async function promoteToLead(orgId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: m } = await supabaseAdmin
    .from("org_members")
    .select("id, role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (m && m.role === "agent") {
    await supabaseAdmin.from("org_members").update({ role: "team_lead" }).eq("id", m.id);
  }
}
