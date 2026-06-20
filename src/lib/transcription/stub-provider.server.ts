// Stub transcription provider. Returns a synthetic transcript so the on-demand
// transcription flow runs offline. Real adapters (Whisper/ElevenLabs/DeepSeek)
// implement the same interface: fetch the recording and return text.
import type { TranscribeArgs, TranscriptResult, TranscriptionProvider } from "./types";

export class StubTranscriptionProvider implements TranscriptionProvider {
  readonly name: string;

  constructor(name = "stub") {
    this.name = name;
  }

  async transcribe(args: TranscribeArgs): Promise<TranscriptResult> {
    return {
      text: `[stub transcript] No transcription provider configured. Recording: ${args.recordingUrl}`,
      summary: "Stub transcript — configure a real transcription provider to enable this.",
      language: args.language ?? "en",
      segments: [],
      raw: { stub: true, provider: this.name },
    };
  }
}
