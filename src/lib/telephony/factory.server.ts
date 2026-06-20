// Per-org telephony provider selection. Single point that decides Mock vs
// Telavox: a telavox_configs row that is enabled AND has an api_token => Telavox,
// otherwise Mock. Server-only (reads the secret api_token via service role).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { TelephonyProvider } from "./types";
import { MockTelephonyProvider } from "./mock-provider.server";
import { TelavoxTelephonyProvider } from "./telavox-provider.server";

export type TelavoxConfigRow = Database["public"]["Tables"]["telavox_configs"]["Row"];

export interface TelephonyContext {
  provider: TelephonyProvider;
  config: TelavoxConfigRow | null;
  /** True when a real Telavox provider was selected. */
  live: boolean;
}

export async function getTelavoxConfig(orgId: string): Promise<TelavoxConfigRow | null> {
  const { data } = await supabaseAdmin
    .from("telavox_configs")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data ?? null;
}

export async function getTelephonyContext(orgId: string): Promise<TelephonyContext> {
  const config = await getTelavoxConfig(orgId);
  if (config?.enabled && config.api_token) {
    return {
      provider: new TelavoxTelephonyProvider({
        baseUrl: config.base_url,
        authKind: config.auth_kind,
        apiToken: config.api_token,
        callerIdE164: config.caller_id_e164,
      }),
      config,
      live: true,
    };
  }
  return { provider: new MockTelephonyProvider(), config, live: false };
}

export async function getTelephonyProvider(orgId: string): Promise<TelephonyProvider> {
  return (await getTelephonyContext(orgId)).provider;
}

/** Resolve the Telavox extension that should ring for a given agent profile. */
export function extensionForAgent(
  config: TelavoxConfigRow | null,
  agentId: string | null,
): string | null {
  if (!config) return null;
  if (agentId) {
    const map = (config.extension_map ?? {}) as Record<string, unknown>;
    const ext = map[agentId];
    if (typeof ext === "string" && ext) return ext;
  }
  return config.default_extension ?? null;
}
