// Per-org transcription provider selection from telavox_configs.transcription_provider.
import { getTelavoxConfig } from "@/lib/telephony/factory.server";
import { hasElevenLabsKey } from "@/lib/elevenlabs/client.server";
import type { TranscriptionProvider } from "./types";
import { StubTranscriptionProvider } from "./stub-provider.server";
import { ElevenLabsTranscriptionProvider } from "./elevenlabs-provider.server";

export async function getTranscriptionProvider(orgId: string): Promise<TranscriptionProvider> {
  const config = await getTelavoxConfig(orgId);
  const name = config?.transcription_provider ?? "stub";
  switch (name) {
    case "elevenlabs":
      // Fall back to the stub when no key is configured so offline runs don't crash.
      return hasElevenLabsKey()
        ? new ElevenLabsTranscriptionProvider(name)
        : new StubTranscriptionProvider(name);
    // TODO: replace with real adapters once credentials are available.
    case "whisper":
    case "deepseek":
    case "stub":
    default:
      return new StubTranscriptionProvider(name);
  }
}
