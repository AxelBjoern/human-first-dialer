// ElevenLabs speech-to-text adapter. Fetches the Telavox recording transiently
// (using the org's Telavox auth header), runs ElevenLabs Scribe, and returns text
// + word-level timestamps mapped to segments. Implements TranscriptionProvider
// exactly — the factory is the only switch point. Recording audio is never stored;
// we keep text + segments only.
import {
  speechToText,
  mapWordsToSegments,
  DEFAULT_STT_MODEL,
} from "@/lib/elevenlabs/client.server";
import type { TranscribeArgs, TranscriptResult, TranscriptionProvider } from "./types";

export class ElevenLabsTranscriptionProvider implements TranscriptionProvider {
  readonly name: string;

  constructor(name = "elevenlabs") {
    this.name = name;
  }

  async transcribe(args: TranscribeArgs): Promise<TranscriptResult> {
    // Fetch the protected recording (Telavox auth header passed through by caller).
    const audioRes = await fetch(args.recordingUrl, {
      headers: args.authHeader ? { Authorization: args.authHeader } : undefined,
    });
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch recording (${audioRes.status}) for transcription`);
    }
    const audio = new Uint8Array(await audioRes.arrayBuffer());

    const cfg = args.config ?? {};
    const modelId = (cfg.elevenlabs_model_id as string) || DEFAULT_STT_MODEL;
    const diarize = cfg.diarize == null ? true : Boolean(cfg.diarize);

    const stt = await speechToText({
      audio,
      modelId,
      languageCode: args.language ?? null,
      diarize,
    });

    const segments = mapWordsToSegments(stt.words);
    return {
      text: stt.text,
      summary: null,
      language: stt.languageCode ?? args.language ?? null,
      segments,
      raw: stt.raw,
    };
  }
}
