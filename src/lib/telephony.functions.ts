// Server functions for telephony: per-org Telavox config, human click-to-dial,
// call-status polling, and co-listen. Provider/secret access is via dynamic
// imports inside handlers (this file ships to the client bundle).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ConfigInput = z.object({
  organization_id: z.string().uuid(),
  enabled: z.boolean().optional(),
  base_url: z.string().url().optional(),
  auth_kind: z.enum(["bearer", "basic"]).optional(),
  api_token: z.string().optional(),
  caller_id_e164: z.string().optional().nullable(),
  default_extension: z.string().optional().nullable(),
  extension_map: z.record(z.string()).optional(),
  voice_provider: z.string().optional(),
  voice_config: z.record(z.unknown()).optional(),
  transcription_provider: z.string().optional(),
  transcription_config: z.record(z.unknown()).optional(),
  webhook_secret: z.string().optional().nullable(),
});

export const saveTelavoxConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof ConfigInput>) => ConfigInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: data.organization_id,
      _min: "admin",
    });
    if (!ok) throw new Error("Forbidden");

    const { data: existing } = await supabaseAdmin
      .from("telavox_configs")
      .select("id, api_token")
      .eq("organization_id", data.organization_id)
      .maybeSingle();

    // Only overwrite api_token when a non-empty value was supplied.
    const tokenPatch =
      data.api_token && data.api_token.length > 0 ? { api_token: data.api_token } : {};
    const patch = {
      organization_id: data.organization_id,
      enabled: data.enabled ?? false,
      base_url: data.base_url ?? "https://api.telavox.se",
      auth_kind: data.auth_kind ?? "bearer",
      caller_id_e164: data.caller_id_e164 ?? null,
      default_extension: data.default_extension ?? null,
      extension_map: data.extension_map ?? {},
      voice_provider: data.voice_provider ?? "stub",
      voice_config: data.voice_config ?? {},
      transcription_provider: data.transcription_provider ?? "stub",
      transcription_config: data.transcription_config ?? {},
      webhook_secret: data.webhook_secret ?? null,
      ...tokenPatch,
    };

    const writer = existing
      ? supabaseAdmin
          .from("telavox_configs")
          .update(patch as never)
          .eq("id", existing.id)
      : supabaseAdmin.from("telavox_configs").insert(patch as never);
    const { data: row, error } = await writer
      .select(
        "id, organization_id, enabled, base_url, auth_kind, caller_id_e164, default_extension, extension_map, voice_provider, voice_config, transcription_provider, transcription_config, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return {
      ...row,
      has_token: !!(existing?.api_token || tokenPatch.api_token),
      has_webhook_secret: !!data.webhook_secret,
    };
  });

export const getTelephonyMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("get_telephony_mode", {
      _org: data.organization_id,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    const live = !!row?.enabled;
    return { enabled: live, provider: live ? ("telavox" as const) : ("mock" as const) };
  });

export const startCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      organization_id: string;
      to_e164: string;
      client_id?: string;
      from_extension?: string;
    }) =>
      z
        .object({
          organization_id: z.string().uuid(),
          to_e164: z.string().min(3),
          client_id: z.string().uuid().optional(),
          from_extension: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTelephonyContext, extensionForAgent } =
      await import("@/lib/telephony/factory.server");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: data.organization_id,
    });
    if (!member) throw new Error("Forbidden");

    const { provider, config } = await getTelephonyContext(data.organization_id);
    const fromExtension = data.from_extension ?? extensionForAgent(config, context.userId);

    const { data: session, error: sErr } = await supabaseAdmin
      .from("call_sessions")
      .insert({
        organization_id: data.organization_id,
        caller_type: "human",
        agent_id: context.userId,
        client_id: data.client_id ?? null,
        phone_e164: data.to_e164,
        state: "queued",
        provider: provider.name,
        from_extension: fromExtension,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);

    try {
      const call = await provider.dial({
        orgId: data.organization_id,
        toE164: data.to_e164,
        clientId: data.client_id ?? null,
        fromExtension,
        callerType: "human",
      });
      await supabaseAdmin
        .from("call_sessions")
        .update({
          external_call_id: call.externalCallId,
          state: call.state,
          started_at: call.startedAt ?? new Date().toISOString(),
        })
        .eq("id", session.id);
      return { session_id: session.id, external_call_id: call.externalCallId, state: call.state };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("call_sessions")
        .update({ state: "failed", error: message })
        .eq("id", session.id);
      throw new Error(`Dial failed: ${message}`);
    }
  });

export const getCallStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTelephonyProvider } = await import("@/lib/telephony/factory.server");
    const { data: session, error } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .eq("id", data.session_id)
      .single();
    if (error || !session) throw new Error("Session not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: session.organization_id,
    });
    if (!member) throw new Error("Forbidden");

    const terminal = ["completed", "failed", "canceled"];
    if (session.external_call_id && !terminal.includes(session.state)) {
      const provider = await getTelephonyProvider(session.organization_id);
      const call = await provider.getCall(session.external_call_id).catch(() => null);
      if (call) {
        await supabaseAdmin
          .from("call_sessions")
          .update({
            state: call.state,
            answered_at: call.answeredAt ?? session.answered_at,
            ended_at: call.endedAt ?? session.ended_at,
            recording_url: call.recordingUrl ?? session.recording_url,
            recording_id: call.recordingId ?? session.recording_id,
            last_polled_at: new Date().toISOString(),
          })
          .eq("id", session.id);
        return {
          session_id: session.id,
          state: call.state,
          external_call_id: session.external_call_id,
          started_at: session.started_at,
          answered_at: call.answeredAt ?? session.answered_at,
          ended_at: call.endedAt ?? session.ended_at,
          duration_s: call.durationS ?? null,
          recording_url: call.recordingUrl ?? session.recording_url,
        };
      }
    }
    return {
      session_id: session.id,
      state: session.state,
      external_call_id: session.external_call_id,
      started_at: session.started_at,
      answered_at: session.answered_at,
      ended_at: session.ended_at,
      duration_s: null,
      recording_url: session.recording_url,
    };
  });

export const endCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTelephonyProvider } = await import("@/lib/telephony/factory.server");
    const { data: session, error } = await supabaseAdmin
      .from("call_sessions")
      .select("id, organization_id, external_call_id, state")
      .eq("id", data.session_id)
      .single();
    if (error || !session) throw new Error("Session not found");
    const { data: member } = await supabaseAdmin.rpc("is_org_member", {
      _uid: context.userId,
      _org: session.organization_id,
    });
    if (!member) throw new Error("Forbidden");

    if (session.external_call_id) {
      const provider = await getTelephonyProvider(session.organization_id);
      await provider.hangup(session.external_call_id).catch(() => {});
    }
    await supabaseAdmin
      .from("call_sessions")
      .update({ state: "completed", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    return { ok: true };
  });

export const startMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: string; mode?: "listen" | "whisper" | "barge" }) =>
    z
      .object({
        session_id: z.string().uuid(),
        mode: z.enum(["listen", "whisper", "barge"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTelephonyContext, extensionForAgent } =
      await import("@/lib/telephony/factory.server");
    const { data: session, error } = await supabaseAdmin
      .from("call_sessions")
      .select("id, organization_id, agent_id, external_call_id, state")
      .eq("id", data.session_id)
      .single();
    if (error || !session) throw new Error("Session not found");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: session.organization_id,
      _min: "admin",
    });
    let allowed = !!isAdmin;
    if (!allowed && session.agent_id) {
      const { data: sup } = await supabaseAdmin.rpc("can_supervise", {
        _uid: context.userId,
        _target: session.agent_id,
        _org: session.organization_id,
      });
      allowed = !!sup;
    }
    if (!allowed) throw new Error("Forbidden: not a supervisor of this agent");

    const mode = data.mode ?? "listen";
    const { provider, config } = await getTelephonyContext(session.organization_id);
    let monitorRef = "";
    if (session.external_call_id) {
      const res = await provider
        .monitor({
          externalCallId: session.external_call_id,
          mode,
          supervisorExtension: extensionForAgent(config, context.userId),
        })
        .catch((e) => {
          throw new Error(`Monitor failed: ${e instanceof Error ? e.message : String(e)}`);
        });
      monitorRef = res.monitorRef;
    }
    const { data: row, error: mErr } = await supabaseAdmin
      .from("call_monitors")
      .insert({
        organization_id: session.organization_id,
        session_id: session.id,
        supervisor_id: context.userId,
        mode,
      })
      .select("id")
      .single();
    if (mErr) throw new Error(mErr.message);
    return { monitor_id: row.id, monitor_ref: monitorRef, mode, active: true };
  });

export const endMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { monitor_id: string }) =>
    z.object({ monitor_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mon, error } = await supabaseAdmin
      .from("call_monitors")
      .select("id, organization_id, supervisor_id")
      .eq("id", data.monitor_id)
      .single();
    if (error || !mon) throw new Error("Monitor not found");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: mon.organization_id,
      _min: "admin",
    });
    if (mon.supervisor_id !== context.userId && !isAdmin) throw new Error("Forbidden");
    await supabaseAdmin
      .from("call_monitors")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", mon.id);
    return { ok: true };
  });

export const testTelavoxConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getTelephonyContext } = await import("@/lib/telephony/factory.server");
    const { data: ok } = await supabaseAdmin.rpc("has_org_role", {
      _uid: context.userId,
      _org: data.organization_id,
      _min: "admin",
    });
    if (!ok) throw new Error("Forbidden");
    const { provider, live } = await getTelephonyContext(data.organization_id);
    if (!live) {
      return {
        ok: false,
        live: false,
        message: "No enabled Telavox config (using Mock provider).",
      };
    }
    try {
      await provider.listRecentCalls({ limit: 1 });
      return { ok: true, live: true, message: "Telavox responded successfully." };
    } catch (e) {
      return { ok: false, live: true, message: e instanceof Error ? e.message : String(e) };
    }
  });
