// Per-org transcription provider selection from telavox_configs.transcription_provider.
import { getTelavoxConfig } from "@/lib/telephony/factory.server";
import type { TranscriptionProvider } from "./types";
import { StubTranscriptionProvider } from "./stub-provider.server";

export async function getTranscriptionProvider(orgId: string): Promise<TranscriptionProvider> {
  const config = await getTelavoxConfig(orgId);
  const name = config?.transcription_provider ?? "stub";
  switch (name) {
    // TODO: replace with real adapters once credentials are available.
    case "whisper":
    case "elevenlabs":
    case "deepseek":
    case "stub":
    default:
      return new StubTranscriptionProvider(name);
  }
}
