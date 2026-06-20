// Server functions for agent + team activity analytics. Base reads are
// org-scoped; team leaders are additionally narrowed to their team's agents
// (admins/owners see the whole org).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

// Which agents may the caller see? Owners/admins: all. Team leads: their teams'
// members (plus self). Plain agents: only themselves.
async function supervisedScope(
  supabaseAdmin: Admin,
  orgId: string,
  userId: string,
): Promise<{ all: boolean; ids: string[] }> {
  const { data: me } = await supabaseAdmin
    .from("org_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = me?.role;
  if (role === "owner" || role === "admin") return { all: true, ids: [] };
  if (role === "team_lead") {
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("organization_id", orgId)
      .eq("lead_user_id", userId);
    const teamIds = (teams ?? []).map((t) => t.id);
    if (teamIds.length === 0) return { all: false, ids: [userId] };
    const { data: members } = await supabaseAdmin
      .from("org_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .in("team_id", teamIds);
    const ids = new Set<string>([userId, ...(members ?? []).map((m) => m.user_id)]);
    return { all: false, ids: [...ids] };
  }
  return { all: false, ids: [userId] };
}

export const getAgentActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      from?: string;
      to?: string;
      agent_id?: string;
      caller_type?: "human" | "ai";
    }) =>
      z
        .object({
          organization_id: z.string().uuid(),
          from: z.string().optional(),
          to: z.string().optional(),
          agent_id: z.string().uuid().optional(),
          caller_type: z.enum(["human", "ai"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: data.organization_id,
    });
    if (!member) throw new Error("Forbidden");

    const scope = await supervisedScope(supabaseAdmin, data.organization_id, context.userId);
    let q = supabaseAdmin
      .from("agent_activity_view")
      .select("*")
      .eq("organization_id", data.organization_id);
    if (data.from) q = q.gte("day", data.from);
    if (data.to) q = q.lte("day", data.to);
    if (data.caller_type) q = q.eq("caller_type", data.caller_type);
    if (!scope.all) q = q.in("agent_id", scope.ids);
    if (data.agent_id) q = q.eq("agent_id", data.agent_id);
    const { data: rows, error } = await q.order("day", { ascending: false }).limit(2000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getTeamActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; team_id: string; from?: string; to?: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        team_id: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team, error } = await supabaseAdmin
      .from("teams")
      .select("id, organization_id, name, lead_user_id")
      .eq("id", data.team_id)
      .single();
    if (error || !team || team.organization_id !== data.organization_id) {
      throw new Error("Team not found");
    }
    const { data: isAdmin } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: data.organization_id,
      _min: "admin",
    });
    if (!isAdmin && team.lead_user_id !== context.userId) throw new Error("Forbidden");

    const { data: members } = await supabaseAdmin
      .from("org_members")
      .select("user_id")
      .eq("organization_id", data.organization_id)
      .eq("team_id", data.team_id);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", ids)
      : { data: [] };

    let q = supabaseAdmin
      .from("agent_activity_view")
      .select("*")
      .eq("organization_id", data.organization_id);
    if (ids.length) q = q.in("agent_id", ids);
    else q = q.eq("agent_id", "00000000-0000-0000-0000-000000000000");
    if (data.from) q = q.gte("day", data.from);
    if (data.to) q = q.lte("day", data.to);
    const { data: activity } = await q.order("day", { ascending: false }).limit(2000);

    return { team, members: profiles ?? [], activity: activity ?? [] };
  });
