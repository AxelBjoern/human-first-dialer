// Server-only helper backing the voice-cue / prompt server functions. Generates
// ElevenLabs audio (TTS or SFX), caches it in the private voice-cues bucket keyed
// by a text hash, and returns a short-lived signed URL. "Create if missing": a
// repeat request for the same (org, cue, text) reuses the stored object.
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTelavoxConfig } from "@/lib/telephony/factory.server";
import {
  ttsToBuffer,
  soundEffect,
  hasElevenLabsKey,
  DEFAULT_OUTPUT_FORMAT,
} from "@/lib/elevenlabs/client.server";

const BUCKET = "voice-cues";

export interface GetOrCreateAudioArgs {
  orgId: string;
  userId: string;
  cueKey: string;
  text: string;
  kind: "tts" | "sfx";
  durationSeconds?: number;
  ttlSeconds: number;
}

export interface VoiceAudioResult {
  url: string;
  /** Storage object path — persist this (signed URLs expire). */
  path: string;
  cached: boolean;
}

/** Re-sign a stored audio object. Caller must already be authorized for the org. */
export async function signStoredAudio(path: string, ttlSeconds = 3600): Promise<string | null> {
  return signUrl(path, ttlSeconds);
}

export async function getOrCreateAudio(args: GetOrCreateAudioArgs): Promise<VoiceAudioResult> {
  const { data: member } = await supabaseAdmin.rpc("is_org_member", {
    _uid: args.userId,
    _org: args.orgId,
  });
  if (!member) throw new Error("Forbidden");

  if (!hasElevenLabsKey()) {
    throw new Error("ElevenLabs is not configured (missing ELEVENLABS_API_KEY).");
  }

  const textHash = createHash("sha256")
    .update(`${args.kind}:${args.text}`)
    .digest("hex")
    .slice(0, 32);

  // Cache hit — reuse the stored object.
  const { data: cached } = await supabaseAdmin
    .from("voice_cue_cache")
    .select("storage_path")
    .eq("organization_id", args.orgId)
    .eq("cue_key", args.cueKey)
    .eq("text_hash", textHash)
    .maybeSingle();

  if (cached?.storage_path) {
    const signed = await signUrl(cached.storage_path, args.ttlSeconds);
    if (signed) return { url: signed, path: cached.storage_path, cached: true };
    // Stored row points at a missing object — fall through and regenerate.
  }

  // Generate fresh audio.
  const cfg = await getTelavoxConfig(args.orgId);
  const voiceConfig = (cfg?.voice_config ?? {}) as Record<string, unknown>;
  const audio =
    args.kind === "sfx"
      ? await soundEffect({ text: args.text, durationSeconds: args.durationSeconds })
      : await ttsToBuffer({
          text: args.text,
          voiceId: (voiceConfig.elevenlabs_voice_id as string) ?? null,
          modelId: (voiceConfig.elevenlabs_model_id as string) ?? null,
          outputFormat: (voiceConfig.output_format as string) ?? DEFAULT_OUTPUT_FORMAT,
        });

  const path = `${args.orgId}/${args.cueKey}_${textHash}.mp3`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (upErr) throw new Error(`Failed to store audio: ${upErr.message}`);

  // Upsert the cache index (unique on org+cue+hash).
  await supabaseAdmin.from("voice_cue_cache").upsert(
    {
      organization_id: args.orgId,
      cue_key: args.cueKey,
      storage_path: path,
      text_hash: textHash,
    },
    { onConflict: "organization_id,cue_key,text_hash" },
  );

  const signed = await signUrl(path, args.ttlSeconds);
  if (!signed) throw new Error("Failed to sign audio URL");
  return { url: signed, path, cached: false };
}

async function signUrl(path: string, ttlSeconds: number): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, ttlSeconds);
  return data?.signedUrl ?? null;
}
