// ElevenLabs voice-AI adapter for AI calls. Implements VoiceAgentProvider so the
// factory can select it via telavox_configs.voice_provider = 'elevenlabs'.
//
// Telavox supplies the PSTN leg; ElevenLabs drives the conversation. The media
// bridge (attaching ElevenLabs Conversational AI to the Telavox SIP leg) is
// environment-specific and BUILD-TO-SPEC — wire it where noted once the SIP/agent
// bridge is provisioned. Until then startSession validates credentials by
// pre-synthesizing the opening line (proving the key + voice config work) and
// returns an active session so the AI-call pipeline runs end-to-end.
import { randomBytes } from "node:crypto";
import {
  ttsToBuffer,
  hasElevenLabsKey,
  DEFAULT_OUTPUT_FORMAT,
} from "@/lib/elevenlabs/client.server";
import type { VoiceAgentProvider, VoiceSession, VoiceSessionArgs } from "./types";

export class ElevenLabsVoiceAgentProvider implements VoiceAgentProvider {
  readonly name: string;

  constructor(name = "elevenlabs") {
    this.name = name;
  }

  async startSession(args: VoiceSessionArgs): Promise<VoiceSession> {
    if (!hasElevenLabsKey()) {
      throw new Error("ElevenLabs is not configured (missing ELEVENLABS_API_KEY).");
    }
    const voiceConfig = args.voiceConfig ?? {};
    const opening = (args.prompt ?? "").trim() || "Hello, thank you for taking the call.";

    // Validate credentials + voice config by synthesizing the opening line.
    // BUILD-TO-SPEC: replace/augment with the Conversational AI agent + SIP bridge
    // attach (using args.externalCallId / args.sipTrunkRef) once provisioned.
    await ttsToBuffer({
      text: opening.slice(0, 500),
      voiceId: (voiceConfig.elevenlabs_voice_id as string) ?? null,
      modelId: (voiceConfig.elevenlabs_model_id as string) ?? null,
      outputFormat: (voiceConfig.output_format as string) ?? DEFAULT_OUTPUT_FORMAT,
    });

    return {
      voiceSessionId: `el_${args.sessionId}_${randomBytes(3).toString("hex")}`,
      status: "active",
      transcriptUrl: null,
      raw: { provider: this.name, externalCallId: args.externalCallId ?? null },
    };
  }

  async endSession(_voiceSessionId: string): Promise<void> {
    // BUILD-TO-SPEC: tear down the Conversational AI session / SIP bridge here.
  }

  async getSession(voiceSessionId: string): Promise<VoiceSession | null> {
    // Stateless until the conversation lifecycle is wired; report ended.
    return { voiceSessionId, status: "ended", transcriptUrl: null, raw: { provider: this.name } };
  }
}
