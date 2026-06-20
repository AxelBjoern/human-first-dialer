// Server function: generate an ElevenLabs TTS voicemail narration from a call's
// outcome notes when the call was missed/declined (req 2). Honest framing: the
// browser can't inject audio into the already-missed PSTN leg — this produces an
// audio file the agent can review/download (and a future AI callback could play).
// The clip is stored in the voice-cues bucket and linked on call_logs.voicemail_url.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateVoicemail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; call_log_id: string; notes: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        call_log_id: z.string().uuid(),
        notes: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getOrCreateAudio } = await import("@/lib/voice-cues.server");

    // Verify the log belongs to the caller's org.
    const { data: log, error } = await supabaseAdmin
      .from("call_logs")
      .select("id, organization_id")
      .eq("id", data.call_log_id)
      .single();
    if (error || !log) throw new Error("Call log not found");
    if (log.organization_id !== data.organization_id) throw new Error("Forbidden");

    const audio = await getOrCreateAudio({
      orgId: data.organization_id,
      userId: context.userId,
      cueKey: `voicemail_${data.call_log_id}`,
      text: data.notes,
      kind: "tts",
      ttlSeconds: 3600,
    });

    // Persist the storage path (signed URLs expire); we re-sign on playback.
    await supabaseAdmin
      .from("call_logs")
      .update({ voicemail_url: audio.path } as never)
      .eq("id", data.call_log_id);

    return audio;
  });

// Re-sign a stored voicemail object for playback (signed URLs are short-lived).
export const getVoicemailUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { call_log_id: string }) =>
    z.object({ call_log_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signStoredAudio } = await import("@/lib/voice-cues.server");

    const { data: log, error } = await supabaseAdmin
      .from("call_logs")
      .select("organization_id, voicemail_url")
      .eq("id", data.call_log_id)
      .single();
    if (error || !log) throw new Error("Call log not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: log.organization_id,
    });
    if (!member) throw new Error("Forbidden");
    if (!log.voicemail_url) return null;

    const url = await signStoredAudio(log.voicemail_url);
    return url ? { url } : null;
  });
