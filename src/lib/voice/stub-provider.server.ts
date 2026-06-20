// Stub voice-AI provider. Lets the full AI-calling pipeline run and verify with
// zero media credentials. Real ElevenLabs/DeepSeek adapters implement the same
// interface (replace the bodies; keep startSession/endSession/getSession).
import { randomBytes } from "node:crypto";
import type { VoiceAgentProvider, VoiceSession, VoiceSessionArgs } from "./types";

export class StubVoiceAgentProvider implements VoiceAgentProvider {
  readonly name: string;

  constructor(name = "stub") {
    this.name = name;
  }

  async startSession(args: VoiceSessionArgs): Promise<VoiceSession> {
    return {
      voiceSessionId: `voice_${args.sessionId}_${randomBytes(3).toString("hex")}`,
      status: "active",
      transcriptUrl: null,
      raw: { stub: true, provider: this.name, prompt: args.prompt ?? null },
    };
  }

  async endSession(_voiceSessionId: string): Promise<void> {
    // no-op for the stub
  }

  async getSession(voiceSessionId: string): Promise<VoiceSession | null> {
    return { voiceSessionId, status: "ended", transcriptUrl: null, raw: { stub: true } };
  }
}
