// Per-org voice-AI provider selection from telavox_configs.voice_provider.
// No real adapters exist yet, so every provider resolves to the Stub (which
// reports the configured name). Swap in real classes here when creds are wired.
import { getTelavoxConfig } from "@/lib/telephony/factory.server";
import type { VoiceAgentProvider } from "./types";
import { StubVoiceAgentProvider } from "./stub-provider.server";

export async function getVoiceAgentProvider(orgId: string): Promise<VoiceAgentProvider> {
  const config = await getTelavoxConfig(orgId);
  const name = config?.voice_provider ?? "stub";
  switch (name) {
    // TODO: replace with real adapters once credentials/SIP bridge are available.
    case "elevenlabs":
    case "deepseek":
    case "stub":
    default:
      return new StubVoiceAgentProvider(name);
  }
}
