// Transcription provider abstraction (vendor-agnostic, client-safe types).
// Recordings stay in Telavox (links only); the provider fetches the audio
// transiently at transcribe time and returns text — we store text, not audio.

export interface TranscribeArgs {
  recordingUrl: string;
  language?: string | null;
  config?: Record<string, unknown>;
  /** Auth header to fetch a protected Telavox recording, if needed. */
  authHeader?: string | null;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  summary?: string | null;
  language?: string | null;
  segments?: TranscriptSegment[];
  raw?: unknown;
}

export interface TranscriptionProvider {
  readonly name: string; // 'stub' | 'whisper' | 'elevenlabs' | 'deepseek'
  transcribe(args: TranscribeArgs): Promise<TranscriptResult>;
}
