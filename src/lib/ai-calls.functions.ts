// Server functions for the AI-agent call queue.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const enqueueAiCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      phone_e164: string;
      client_id?: string;
      prompt?: string;
      voice_config?: Record<string, unknown>;
      scheduled_at?: string;
    }) =>
      z
        .object({
          organization_id: z.string().uuid(),
          phone_e164: z.string().min(3),
          client_id: z.string().uuid().optional(),
          prompt: z.string().optional(),
          voice_config: z.record(z.unknown()).optional(),
          scheduled_at: z.string().datetime().optional(),
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
    const { data: row, error } = await supabaseAdmin
      .from("ai_call_jobs")
      .insert({
        organization_id: data.organization_id,
        phone_e164: data.phone_e164,
        client_id: data.client_id ?? null,
        prompt: data.prompt ?? null,
        voice_config: (data.voice_config ?? {}) as never,
        scheduled_at: data.scheduled_at ?? new Date().toISOString(),
        status: "pending",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelAiCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job, error } = await supabaseAdmin
      .from("ai_call_jobs")
      .select("id, organization_id, status")
      .eq("id", data.id)
      .single();
    if (error || !job) throw new Error("Job not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: job.organization_id,
    });
    if (!member) throw new Error("Forbidden");
    if (job.status !== "pending" && job.status !== "queued") {
      throw new Error(`Cannot cancel a job in status '${job.status}'`);
    }
    const { data: row, error: uErr } = await supabaseAdmin
      .from("ai_call_jobs")
      .update({ status: "canceled" })
      .eq("id", job.id)
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);
    return row;
  });

export const listAiCallJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z
          .enum(["pending", "queued", "in_progress", "completed", "failed", "canceled"])
          .optional(),
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
    let q = supabaseAdmin
      .from("ai_call_jobs")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });
