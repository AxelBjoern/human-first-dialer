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
    const { getTelavoxConfig } = await import("@/lib/telephony/factory.server");
    const { getTranscriptionProvider } = await import("@/lib/transcription/factory.server");

    const { data: log, error } = await supabaseAdmin
      .from("call_logs")
      .select("id, organization_id, recording_url")
      .eq("id", data.call_log_id)
      .single();
    if (error || !log) throw new Error("Call log not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: log.organization_id,
    });
    if (!member) throw new Error("Forbidden");
    if (!log.recording_url) throw new Error("Call has no recording to transcribe");

    const cfg = await getTelavoxConfig(log.organization_id);
    const provider = await getTranscriptionProvider(log.organization_id);

    const { data: row, error: iErr } = await supabaseAdmin
      .from("transcriptions")
      .insert({
        organization_id: log.organization_id,
        call_log_id: log.id,
        status: "processing",
        provider: provider.name,
        language: data.language ?? null,
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);

    const authHeader = cfg?.api_token
      ? cfg.auth_kind === "basic"
        ? `Basic ${Buffer.from(cfg.api_token).toString("base64")}`
        : `Bearer ${cfg.api_token}`
      : null;

    try {
      const result = await provider.transcribe({
        recordingUrl: log.recording_url,
        language: data.language ?? null,
        authHeader,
      });
      const { data: done, error: uErr } = await supabaseAdmin
        .from("transcriptions")
        .update({
          status: "completed",
          text: result.text,
          summary: result.summary ?? null,
          language: result.language ?? data.language ?? null,
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (uErr) throw new Error(uErr.message);
      return done;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("transcriptions")
        .update({ status: "failed", summary: message })
        .eq("id", row.id);
      throw new Error(`Transcription failed: ${message}`);
    }
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
