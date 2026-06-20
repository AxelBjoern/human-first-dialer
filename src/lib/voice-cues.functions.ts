// Server functions for ElevenLabs-generated call audio: notification cues for
// call lifecycle events (req 1) and arbitrary scripted prompts agents play before
// calls / during status updates (req 5). Audio is generated once and cached in the
// private voice-cues Storage bucket (create-if-missing, keyed by a text hash), then
// served to the browser as a short-lived signed URL.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Call-lifecycle cues. `kind` decides TTS (spoken alert) vs SFX (generated tone).
export const CUE_KEYS = ["call_start", "ringing", "answered", "hold", "hangup"] as const;
export type CueKey = (typeof CUE_KEYS)[number];

interface CueDef {
  kind: "tts" | "sfx";
  text: string;
  durationSeconds?: number;
}

export const CUE_CATALOG: Record<CueKey, CueDef> = {
  call_start: {
    kind: "sfx",
    text: "Short soft UI confirmation blip, single note",
    durationSeconds: 1,
  },
  ringing: {
    kind: "sfx",
    text: "Gentle telephone ringback tone, two short rings",
    durationSeconds: 3,
  },
  answered: { kind: "tts", text: "Connected." },
  hold: { kind: "tts", text: "The call is on hold." },
  hangup: {
    kind: "sfx",
    text: "Soft call-disconnect tone, descending two notes",
    durationSeconds: 1,
  },
};

const SIGNED_URL_TTL = 3600; // 1 hour

export const ensureVoiceCue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; cue: CueKey; text?: string }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        cue: z.enum(CUE_KEYS),
        text: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const def = CUE_CATALOG[data.cue];
    const text = data.text?.trim() || def.text;
    const { getOrCreateAudio } = await import("@/lib/voice-cues.server");
    return getOrCreateAudio({
      orgId: data.organization_id,
      userId: context.userId,
      cueKey: data.cue,
      text,
      kind: def.kind,
      durationSeconds: def.durationSeconds,
      ttlSeconds: SIGNED_URL_TTL,
    });
  });

export const synthPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; text: string }) =>
    z.object({ organization_id: z.string().uuid(), text: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getOrCreateAudio } = await import("@/lib/voice-cues.server");
    return getOrCreateAudio({
      orgId: data.organization_id,
      userId: context.userId,
      cueKey: "prompt",
      text: data.text,
      kind: "tts",
      ttlSeconds: SIGNED_URL_TTL,
    });
  });
