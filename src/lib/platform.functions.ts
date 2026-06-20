import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PlatformRole = "superadmin" | "staff" | "billing" | "support";

async function assertStaff(ctx: { userId: string; supabase: unknown }, min: PlatformRole = "support") {
  const sb = ctx.supabase as { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
  const { data, error } = await sb.rpc("has_platform_role", { _uid: ctx.userId, _min: min });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ---------- Me ----------
export const getPlatformMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("platform_staff")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { isStaff: !!data, role: data?.role ?? null };
  });

// ---------- Customers ----------
export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string } | undefined) =>
    z.object({ q: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, "support");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("organizations")
      .select("id, name, slug, source_app, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: orgs, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (orgs ?? []).map((o) => o.id);
    const [subs, usage, members] = await Promise.all([
      supabaseAdmin
        .from("org_subscriptions")
        .select("organization_id, plan_id, status, current_period_start, current_period_end")
        .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("org_usage_current_period")
        .select("organization_id, calls_count, ai_minutes")
        .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin
        .from("org_members")
        .select("organization_id")
        .in("organization_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const plans = await supabaseAdmin.from("billing_plans").select("id, code, name, price_cents, currency");

    const subMap = new Map((subs.data ?? []).map((s) => [s.organization_id, s]));
    const usageMap = new Map((usage.data ?? []).map((u) => [u.organization_id, u]));
    const planMap = new Map((plans.data ?? []).map((p) => [p.id, p]));
    const seatMap = new Map<string, number>();
    (members.data ?? []).forEach((m) => seatMap.set(m.organization_id, (seatMap.get(m.organization_id) ?? 0) + 1));

    return (orgs ?? []).map((o) => {
      const sub = subMap.get(o.id);
      const u = usageMap.get(o.id);
      const plan = sub?.plan_id ? planMap.get(sub.plan_id) : null;
      return {
        ...o,
        subscription: sub ?? null,
        plan: plan ?? null,
        usage: u ?? null,
        seats: seatMap.get(o.id) ?? 0,
      };
    });
  });

export const getCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, "support");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const org = await supabaseAdmin.from("organizations").select("*").eq("id", data.organization_id).single();
    if (org.error) throw new Error(org.error.message);
    const [sub, usage, members, keys, last30] = await Promise.all([
      supabaseAdmin.from("org_subscriptions").select("*").eq("organization_id", data.organization_id).maybeSingle(),
      supabaseAdmin.from("org_usage_current_period").select("*").eq("organization_id", data.organization_id).maybeSingle(),
      supabaseAdmin
        .from("org_members")
        .select("id, role, user_id, created_at, profile:profiles(email, first_name, last_name)")
        .eq("organization_id", data.organization_id),
      supabaseAdmin
        .from("org_api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
        .eq("organization_id", data.organization_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("org_usage_daily")
        .select("day, calls_count, ai_minutes, transcription_minutes")
        .eq("organization_id", data.organization_id)
        .gte("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
        .order("day", { ascending: true }),
    ]);
    return {
      org: org.data,
      subscription: sub.data,
      usage: usage.data,
      members: members.data ?? [],
      api_keys: keys.data ?? [],
      usage_trend: last30.data ?? [],
    };
  });

export const setCustomerPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    plan_id: string | null;
    status?: "trialing" | "active" | "past_due" | "canceled" | "suspended";
    period_start?: string;
    period_end?: string;
  }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        plan_id: z.string().uuid().nullable(),
        status: z.enum(["trialing", "active", "past_due", "canceled", "suspended"]).optional(),
        period_start: z.string().optional(),
        period_end: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, "billing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = {
      organization_id: data.organization_id,
      plan_id: data.plan_id,
    };
    if (data.status) payload.status = data.status;
    if (data.period_start) payload.current_period_start = data.period_start;
    if (data.period_end) payload.current_period_end = data.period_end;
    const { error } = await supabaseAdmin
      .from("org_subscriptions")
      .upsert(payload as never, { onConflict: "organization_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCustomerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status: string; notes?: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["trialing", "active", "past_due", "canceled", "suspended"]),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, "billing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_subscriptions")
      .upsert(
        {
          organization_id: data.organization_id,
          status: data.status,
          notes: data.notes,
        } as never,
        { onConflict: "organization_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Plans ----------
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context, "support");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("billing_plans")
      .select("*")
      .order("price_cents", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    code: string;
    name: string;
    price_cents: number;
    currency?: string;
    monthly_call_quota: number | null;
    monthly_ai_minute_quota: number | null;
    seat_quota: number | null;
    active?: boolean;
  }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(1).max(40),
        name: z.string().min(1).max(80),
        price_cents: z.number().int().min(0),
        currency: z.string().length(3).default("EUR"),
        monthly_call_quota: z.number().int().min(0).nullable(),
        monthly_ai_minute_quota: z.number().int().min(0).nullable(),
        seat_quota: z.number().int().min(0).nullable(),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, "billing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = data.id
      ? await supabaseAdmin.from("billing_plans").update(data as never).eq("id", data.id)
      : await supabaseAdmin.from("billing_plans").insert(data as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context, "billing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("billing_plans").update({ active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Staff ----------
export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context, "superadmin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_staff")
      .select("user_id, role, created_at, profile:profiles(email, first_name, last_name)")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  });

export const grantStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "superadmin" | "staff" | "billing" | "support" }) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(["superadmin", "staff", "billing", "support"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, "superadmin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (!prof) throw new Error("No user with that email has signed in yet.");
    const { error } = await supabaseAdmin
      .from("platform_staff")
      .upsert({ user_id: prof.id, role: data.role, created_by: context.userId } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context, "superadmin");
    if (data.user_id === context.userId) throw new Error("Cannot revoke yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_staff").delete().eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Overview ----------
export const platformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context, "support");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [orgs, subs, plans, usage30] = await Promise.all([
      supabaseAdmin.from("organizations").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("org_subscriptions").select("status, plan_id"),
      supabaseAdmin.from("billing_plans").select("id, price_cents"),
      supabaseAdmin
        .from("org_usage_daily")
        .select("day, calls_count, ai_minutes")
        .gte("day", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    ]);
    const priceById = new Map((plans.data ?? []).map((p) => [p.id, p.price_cents]));
    const active = (subs.data ?? []).filter((s) => s.status === "active" || s.status === "trialing");
    const mrrCents = active.reduce((sum, s) => sum + (s.plan_id ? priceById.get(s.plan_id) ?? 0 : 0), 0);
    const byStatus: Record<string, number> = {};
    (subs.data ?? []).forEach((s) => (byStatus[s.status] = (byStatus[s.status] ?? 0) + 1));
    const trendMap = new Map<string, { calls: number; ai: number }>();
    (usage30.data ?? []).forEach((u) => {
      const cur = trendMap.get(u.day) ?? { calls: 0, ai: 0 };
      cur.calls += u.calls_count;
      cur.ai += Number(u.ai_minutes);
      trendMap.set(u.day, cur);
    });
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, ...v }));
    return {
      total_orgs: orgs.count ?? 0,
      by_status: byStatus,
      mrr_cents: mrrCents,
      trend,
    };
  });
