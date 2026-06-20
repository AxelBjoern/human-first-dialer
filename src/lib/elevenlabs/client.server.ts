// Server-only ElevenLabs client. The single place ElevenLabs endpoints, headers,
// and payload shapes live — every voice/transcription/SFX feature funnels through
// here. The API key is read from process.env (never VITE_-prefixed, never shipped
// to the client). Filename ends with .server.ts so the bundler refuses to ship it.
//
// BUILD-TO-SPEC: endpoint paths + response shapes are isolated here; confirm
// against the ElevenLabs API docs before going live. Per-org overrides (voice id,
// model, output format) come from telavox_configs.voice_config / transcription_config.
import type { TranscriptSegment } from "@/lib/transcription/types";

const API_BASE = "https://api.elevenlabs.io";

// Sensible defaults; overridable per-org via the jsonb config columns.
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" (ElevenLabs preset)
export const DEFAULT_TTS_MODEL = "eleven_multilingual_v2";
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
export const DEFAULT_STT_MODEL = "scribe_v1";

export function elevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY. Set it in the server environment to enable ElevenLabs features.",
    );
  }
  return key;
}

/** True when a key is configured — lets callers fall back to the stub offline. */
export function hasElevenLabsKey(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export interface TtsArgs {
  text: string;
  voiceId?: string | null;
  modelId?: string | null;
  outputFormat?: string | null;
}

/** Text-to-speech → audio bytes. Used for voice alerts, prompts, voicemail. */
export async function ttsToBuffer(args: TtsArgs): Promise<Uint8Array> {
  const voiceId = args.voiceId || DEFAULT_VOICE_ID;
  const outputFormat = args.outputFormat || DEFAULT_OUTPUT_FORMAT;
  const res = await fetch(
    `${API_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: args.text,
        model_id: args.modelId || DEFAULT_TTS_MODEL,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${await safeText(res)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export interface SoundEffectArgs {
  text: string;
  durationSeconds?: number | null;
}

/** Generative sound effect → audio bytes. Used for non-spoken call tones. */
export async function soundEffect(args: SoundEffectArgs): Promise<Uint8Array> {
  const res = await fetch(`${API_BASE}/v1/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": elevenLabsApiKey(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: args.text,
      duration_seconds: args.durationSeconds ?? undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs sound-generation failed (${res.status}): ${await safeText(res)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export interface SttArgs {
  audio: Uint8Array | ArrayBuffer | Blob;
  modelId?: string | null;
  languageCode?: string | null;
  diarize?: boolean | null;
}

export interface SttWord {
  text: string;
  start?: number | null;
  end?: number | null;
  type?: string | null; // "word" | "spacing" | "audio_event"
  speaker_id?: string | null;
}

export interface SttResult {
  text: string;
  languageCode?: string | null;
  words: SttWord[];
  raw: unknown;
}

/** Speech-to-text (Scribe) with word-level timestamps + optional diarization. */
export async function speechToText(args: SttArgs): Promise<SttResult> {
  const blob =
    args.audio instanceof Blob
      ? args.audio
      : new Blob([args.audio as BlobPart], { type: "audio/mpeg" });
  const form = new FormData();
  form.append("model_id", args.modelId || DEFAULT_STT_MODEL);
  form.append("file", blob, "recording.mp3");
  if (args.languageCode) form.append("language_code", args.languageCode);
  if (args.diarize != null) form.append("diarize", String(args.diarize));

  const res = await fetch(`${API_BASE}/v1/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": elevenLabsApiKey() },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs STT failed (${res.status}): ${await safeText(res)}`);
  }
  const json = (await res.json()) as {
    text?: string;
    language_code?: string;
    words?: SttWord[];
  };
  return {
    text: json.text ?? "",
    languageCode: json.language_code ?? null,
    words: json.words ?? [],
    raw: json,
  };
}

/**
 * Group word-level STT output into transcript segments, breaking on speaker
 * change or sentence-ending punctuation. Spacing/non-word tokens are folded into
 * the current segment's text. Returns the {start,end,text} shape already declared
 * in transcription/types.ts.
 */
export function mapWordsToSegments(words: SttWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let cur: { start: number; end: number; text: string; speaker: string | null } | null = null;

  const flush = () => {
    if (cur && cur.text.trim()) {
      segments.push({ start: cur.start, end: cur.end, text: cur.text.trim() });
    }
    cur = null;
  };

  for (const w of words) {
    if (w.type && w.type !== "word") {
      // spacing / audio_event — append to current text but don't start a segment.
      if (cur) cur.text += w.text ?? "";
      continue;
    }
    const speaker = w.speaker_id ?? null;
    const start: number = w.start ?? cur?.end ?? 0;
    const end: number = w.end ?? start;
    if (cur && speaker !== cur.speaker) flush();
    if (!cur) cur = { start, end, text: "", speaker };
    cur.text += (cur.text ? " " : "") + (w.text ?? "");
    cur.end = end;
    if (/[.!?]$/.test((w.text ?? "").trim())) flush();
  }
  flush();
  return segments;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<no body>";
  }
}
