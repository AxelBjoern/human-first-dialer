// Server functions for on-demand transcription. Recording stays in Telavox
// (link only); the provider fetches audio transiently and we persist text only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const transcribeCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { call_log_id: string; language?: string }) =>
    z.object({ call_log_id: z.string().uuid(), language: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runTranscription } = await import("@/lib/transcription/run.server");

    const { data: log, error } = await supabaseAdmin
      .from("call_logs")
      .select("id, organization_id")
      .eq("id", data.call_log_id)
      .single();
    if (error || !log) throw new Error("Call log not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: log.organization_id,
    });
    if (!member) throw new Error("Forbidden");

    const result = await runTranscription({
      admin: supabaseAdmin,
      callLogId: data.call_log_id,
      language: data.language ?? null,
    });
    if (result.status === "failed") {
      throw new Error(`Transcription failed: ${result.error ?? "unknown error"}`);
    }
    const { data: done } = await supabaseAdmin
      .from("transcriptions")
      .select("*")
      .eq("id", result.transcriptionId)
      .single();
    return done;
  });

export const getTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { call_log_id: string }) =>
    z.object({ call_log_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log } = await supabaseAdmin
      .from("call_logs")
      .select("organization_id")
      .eq("id", data.call_log_id)
      .single();
    if (!log) throw new Error("Call log not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: log.organization_id,
    });
    if (!member) throw new Error("Forbidden");
    const { data: row } = await supabaseAdmin
      .from("transcriptions")
      .select("*")
      .eq("call_log_id", data.call_log_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? null;
  });
