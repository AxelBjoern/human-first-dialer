// Shared server-only transcription runner. Used by the on-demand transcribeCall
// server function AND the Telavox recording.ready webhook (automatic transcripts).
// Inserts a transcriptions row, runs the org's provider against the recording,
// and persists text + segments (timestamps). Service-role client passed in.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getTelavoxConfig } from "@/lib/telephony/factory.server";
import { getTranscriptionProvider } from "./factory.server";

type Admin = SupabaseClient<Database>;

export interface RunTranscriptionArgs {
  admin: Admin;
  callLogId: string;
  /** call_sessions.id, when triggered from a session/webhook context. */
  sessionId?: string | null;
  language?: string | null;
}

export interface RunTranscriptionResult {
  transcriptionId: string;
  status: "completed" | "failed";
  error?: string;
}

/** Build the Authorization header used to fetch a protected Telavox recording. */
function telavoxAuthHeader(
  apiToken: string | null | undefined,
  authKind: string | null | undefined,
): string | null {
  if (!apiToken) return null;
  return authKind === "basic"
    ? `Basic ${Buffer.from(apiToken).toString("base64")}`
    : `Bearer ${apiToken}`;
}

export async function runTranscription(
  args: RunTranscriptionArgs,
): Promise<RunTranscriptionResult> {
  const { admin, callLogId } = args;

  const { data: log, error } = await admin
    .from("call_logs")
    .select("id, organization_id, recording_url")
    .eq("id", callLogId)
    .single();
  if (error || !log) throw new Error("Call log not found");
  if (!log.recording_url) throw new Error("Call has no recording to transcribe");

  const cfg = await getTelavoxConfig(log.organization_id);
  const provider = await getTranscriptionProvider(log.organization_id);

  const { data: row, error: iErr } = await admin
    .from("transcriptions")
    .insert({
      organization_id: log.organization_id,
      call_log_id: log.id,
      session_id: args.sessionId ?? null,
      status: "processing",
      provider: provider.name,
      language: args.language ?? null,
    })
    .select("id")
    .single();
  if (iErr || !row) throw new Error(iErr?.message ?? "Failed to create transcription row");

  const authHeader = telavoxAuthHeader(cfg?.api_token, cfg?.auth_kind);

  try {
    const result = await provider.transcribe({
      recordingUrl: log.recording_url,
      language: args.language ?? null,
      config: (cfg?.transcription_config ?? {}) as Record<string, unknown>,
      authHeader,
    });
    const { error: uErr } = await admin
      .from("transcriptions")
      .update({
        status: "completed",
        text: result.text,
        summary: result.summary ?? null,
        language: result.language ?? args.language ?? null,
        segments: (result.segments ?? null) as never,
      })
      .eq("id", row.id);
    if (uErr) throw new Error(uErr.message);
    return { transcriptionId: row.id, status: "completed" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("transcriptions")
      .update({ status: "failed", summary: message })
      .eq("id", row.id);
    return { transcriptionId: row.id, status: "failed", error: message };
  }
}
