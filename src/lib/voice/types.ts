// Voice-AI provider abstraction (vendor-agnostic, client-safe types).
// For AI calls Telavox supplies the PSTN leg (trunk/number); an external voice
// service (ElevenLabs / DeepSeek / etc.) drives the conversation media. VDNX only
// orchestrates the session and logs the outcome.

export interface VoiceSessionArgs {
  orgId: string;
  sessionId: string; // our call_sessions.id
  toE164: string;
  callerIdE164?: string | null;
  prompt?: string | null;
  voiceConfig?: Record<string, unknown>;
  /** How the voice service attaches to the Telavox leg (SIP ref / call id). */
  sipTrunkRef?: string | null;
  externalCallId?: string | null;
}

export interface VoiceSession {
  voiceSessionId: string;
  status: "starting" | "active" | "ended" | "failed";
  transcriptUrl?: string | null;
  raw?: unknown;
}

export interface VoiceAgentProvider {
  readonly name: string; // 'stub' | 'elevenlabs' | 'deepseek'
  startSession(args: VoiceSessionArgs): Promise<VoiceSession>;
  endSession(voiceSessionId: string): Promise<void>;
  getSession(voiceSessionId: string): Promise<VoiceSession | null>;
}
