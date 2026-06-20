import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { getAdmin } from "@/lib/api-auth.server";

type Ctx = { auth?: { claims?: Record<string, unknown>; scopes?: string[] } };
const orgFromAuth = (ctx: Ctx): string => {
  const org = ctx.auth?.claims?.organization_id;
  if (typeof org !== "string") throw new Error("Unauthorized");
  return org;
};
const requireScope = (ctx: Ctx, scope: string) => {
  const scopes = ctx.auth?.scopes ?? [];
  if (!scopes.includes(scope)) throw new Error(`Missing scope: ${scope}`);
};
const ok = (v: unknown) => JSON.stringify(v, null, 2);

async function ownerOf(org: string) {
  const { data } = await getAdmin()
    .from("org_members")
    .select("user_id")
    .eq("organization_id", org)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("No owner for organization");
  return data.user_id;
}

export const listClientsTool = defineTool({
  name: "list_clients",
  description: "List clients in the connected workspace. Optional search query.",
  parameters: z.object({
    query: z.string().optional().describe("Search by name, phone, or email"),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  execute: async ({ query, limit }, ctx) => {
    const org = orgFromAuth(ctx as Ctx);
    let q = getAdmin()
      .from("clients")
      .select("id,first_name,last_name,phone,email,city,investment_status")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (query)
      q = q.or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`,
      );
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const getClientTool = defineTool({
  name: "get_client",
  description: "Fetch one client by ID.",
  parameters: z.object({ id: z.string().uuid() }),
  execute: async ({ id }, ctx) => {
    const org = orgFromAuth(ctx as Ctx);
    const { data, error } = await getAdmin()
      .from("clients")
      .select("*")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Not found");
    return ok(data);
  },
});

export const createClientTool = defineTool({
  name: "create_client",
  description: "Create a client in the connected workspace.",
  parameters: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    investment_status: z.string().optional(),
    notes: z.string().optional(),
    external_id: z.string().optional().describe("ID in your source system"),
    source_app: z.enum(["vdnx", "energy", "executive"]).optional(),
  }),
  execute: async (input, ctx) => {
    const org = orgFromAuth(ctx as Ctx);
    const { data, error } = await getAdmin()
      .from("clients")
      .insert({ ...input, organization_id: org } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const logCallTool = defineTool({
  name: "log_call",
  description: "Record a completed call in the workspace's history.",
  parameters: z.object({
    client_id: z.string().uuid().optional(),
    phone_e164: z.string(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    duration_s: z.number().int().nonnegative().optional(),
    outcome_code: z.string().optional(),
    notes: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const org = orgFromAuth(ctx as Ctx);
    const agent_id = await ownerOf(org);
    const { data, error } = await getAdmin()
      .from("call_logs")
      .insert({
        ...input,
        organization_id: org,
        agent_id,
        direction: input.direction ?? "outbound",
        started_at: new Date().toISOString(),
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const createReminderTool = defineTool({
  name: "create_reminder",
  description: "Schedule a callback reminder.",
  parameters: z.object({
    client_id: z.string().uuid().optional(),
    call_time: z.string().datetime(),
    note: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const org = orgFromAuth(ctx as Ctx);
    const agent_id = await ownerOf(org);
    const { data, error } = await getAdmin()
      .from("call_reminders")
      .insert({
        ...input,
        organization_id: org,
        agent_id,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const listRemindersTool = defineTool({
  name: "list_reminders",
  description: "List pending reminders.",
  parameters: z.object({ done: z.boolean().optional() }),
  execute: async ({ done }, ctx) => {
    const org = orgFromAuth(ctx as Ctx);
    const { data, error } = await getAdmin()
      .from("call_reminders")
      .select("*")
      .eq("organization_id", org)
      .eq("done", done ?? false)
      .order("call_time", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

// --- Calling / AI / activity / transcription tools -----------------------

export const placeCallTool = defineTool({
  name: "place_call",
  description:
    "Initiate an outbound call. caller_type 'human' rings the org's Telavox extension then bridges to the destination; 'ai' enqueues an AI-agent call. Requires the 'calls:initiate' scope.",
  parameters: z.object({
    to_e164: z.string(),
    client_id: z.string().uuid().optional(),
    caller_type: z.enum(["human", "ai"]).default("human"),
    from_extension: z.string().optional(),
    prompt: z.string().optional(),
    voice_config: z.record(z.any()).optional(),
  }),
  execute: async (input, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:initiate");
    const org = orgFromAuth(c);
    const admin = getAdmin();
    if (input.caller_type === "ai") {
      const { data, error } = await admin
        .from("ai_call_jobs")
        .insert({
          organization_id: org,
          phone_e164: input.to_e164,
          client_id: input.client_id ?? null,
          prompt: input.prompt ?? null,
          voice_config: (input.voice_config ?? {}) as never,
          status: "pending",
        } as never)
        .select("id, status")
        .single();
      if (error) throw new Error(error.message);
      return ok({ job_id: data.id, status: data.status });
    }
    const agent_id = await ownerOf(org);
    const { getTelephonyContext, extensionForAgent } =
      await import("@/lib/telephony/factory.server");
    const { provider, config } = await getTelephonyContext(org);
    const fromExtension = input.from_extension ?? extensionForAgent(config, agent_id);
    const { data: session, error: sErr } = await admin
      .from("call_sessions")
      .insert({
        organization_id: org,
        caller_type: "human",
        agent_id,
        client_id: input.client_id ?? null,
        phone_e164: input.to_e164,
        state: "queued",
        provider: provider.name,
        from_extension: fromExtension,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);
    const call = await provider.dial({
      orgId: org,
      toE164: input.to_e164,
      clientId: input.client_id ?? null,
      fromExtension,
      callerType: "human",
    });
    await admin
      .from("call_sessions")
      .update({
        external_call_id: call.externalCallId,
        state: call.state,
        started_at: call.startedAt ?? new Date().toISOString(),
      })
      .eq("id", session.id);
    return ok({ session_id: session.id, external_call_id: call.externalCallId, state: call.state });
  },
});

export const getCallTool = defineTool({
  name: "get_call",
  description: "Get the status of a call session or AI job by id. Requires 'calls:read'.",
  parameters: z.object({
    session_id: z.string().uuid().optional(),
    job_id: z.string().uuid().optional(),
  }),
  execute: async (input, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:read");
    const org = orgFromAuth(c);
    if (input.session_id) {
      const { data, error } = await getAdmin()
        .from("call_sessions")
        .select("*")
        .eq("organization_id", org)
        .eq("id", input.session_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return ok(data);
    }
    if (input.job_id) {
      const { data, error } = await getAdmin()
        .from("ai_call_jobs")
        .select("*")
        .eq("organization_id", org)
        .eq("id", input.job_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return ok(data);
    }
    throw new Error("Provide session_id or job_id");
  },
});

export const enqueueAiCallTool = defineTool({
  name: "enqueue_ai_call",
  description: "Queue an AI-agent outbound call. Requires 'calls:initiate'.",
  parameters: z.object({
    phone_e164: z.string(),
    client_id: z.string().uuid().optional(),
    prompt: z.string().optional(),
    voice_config: z.record(z.any()).optional(),
    scheduled_at: z.string().datetime().optional(),
  }),
  execute: async (input, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:initiate");
    const org = orgFromAuth(c);
    const { data, error } = await getAdmin()
      .from("ai_call_jobs")
      .insert({
        organization_id: org,
        phone_e164: input.phone_e164,
        client_id: input.client_id ?? null,
        prompt: input.prompt ?? null,
        voice_config: (input.voice_config ?? {}) as never,
        scheduled_at: input.scheduled_at ?? new Date().toISOString(),
        status: "pending",
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const listCallJobsTool = defineTool({
  name: "list_call_jobs",
  description: "List AI call jobs, optionally filtered by status. Requires 'calls:read'.",
  parameters: z.object({
    status: z
      .enum(["pending", "queued", "in_progress", "completed", "failed", "canceled"])
      .optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  execute: async ({ status, limit }, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:read");
    const org = orgFromAuth(c);
    let q = getAdmin()
      .from("ai_call_jobs")
      .select("*")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const cancelCallJobTool = defineTool({
  name: "cancel_call_job",
  description: "Cancel a pending/queued AI call job. Requires 'calls:initiate'.",
  parameters: z.object({ id: z.string().uuid() }),
  execute: async ({ id }, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:initiate");
    const org = orgFromAuth(c);
    const { data, error } = await getAdmin()
      .from("ai_call_jobs")
      .update({ status: "canceled" })
      .eq("organization_id", org)
      .eq("id", id)
      .in("status", ["pending", "queued"])
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Job not found or not cancelable");
    return ok(data);
  },
});

export const getAgentActivityTool = defineTool({
  name: "get_agent_activity",
  description:
    "Per-agent call activity (calls, answered, missed, talk time) for the workspace. Requires 'activity:read'.",
  parameters: z.object({
    from: z.string().optional().describe("YYYY-MM-DD"),
    to: z.string().optional().describe("YYYY-MM-DD"),
    agent_id: z.string().uuid().optional(),
    caller_type: z.enum(["human", "ai"]).optional(),
  }),
  execute: async (input, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "activity:read");
    const org = orgFromAuth(c);
    let q = getAdmin().from("agent_activity_view").select("*").eq("organization_id", org);
    if (input.from) q = q.gte("day", input.from);
    if (input.to) q = q.lte("day", input.to);
    if (input.agent_id) q = q.eq("agent_id", input.agent_id);
    if (input.caller_type) q = q.eq("caller_type", input.caller_type);
    const { data, error } = await q.order("day", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const startMonitorTool = defineTool({
  name: "start_monitor",
  description:
    "Start co-listen (listen/whisper/barge) on a live call session. Requires 'calls:initiate'.",
  parameters: z.object({
    session_id: z.string().uuid(),
    mode: z.enum(["listen", "whisper", "barge"]).default("listen"),
  }),
  execute: async (input, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:initiate");
    const org = orgFromAuth(c);
    const admin = getAdmin();
    const { data: session } = await admin
      .from("call_sessions")
      .select("id, organization_id, external_call_id")
      .eq("organization_id", org)
      .eq("id", input.session_id)
      .maybeSingle();
    if (!session) throw new Error("Session not found");
    const supervisor = await ownerOf(org);
    const { getTelephonyContext, extensionForAgent } =
      await import("@/lib/telephony/factory.server");
    const { provider, config } = await getTelephonyContext(org);
    let monitorRef = "";
    if (session.external_call_id) {
      const res = await provider.monitor({
        externalCallId: session.external_call_id,
        mode: input.mode,
        supervisorExtension: extensionForAgent(config, supervisor),
      });
      monitorRef = res.monitorRef;
    }
    const { data, error } = await admin
      .from("call_monitors")
      .insert({
        organization_id: org,
        session_id: session.id,
        supervisor_id: supervisor,
        mode: input.mode,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ok({ monitor_id: data.id, monitor_ref: monitorRef, mode: input.mode });
  },
});

export const transcribeCallTool = defineTool({
  name: "transcribe_call",
  description: "Transcribe a call's recording on demand (text only). Requires 'calls:read'.",
  parameters: z.object({ call_log_id: z.string().uuid(), language: z.string().optional() }),
  execute: async (input, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:read");
    const org = orgFromAuth(c);
    const admin = getAdmin();
    const { data: log } = await admin
      .from("call_logs")
      .select("id, recording_url")
      .eq("organization_id", org)
      .eq("id", input.call_log_id)
      .maybeSingle();
    if (!log) throw new Error("Call log not found");
    if (!log.recording_url) throw new Error("Call has no recording to transcribe");
    const { getTranscriptionProvider } = await import("@/lib/transcription/factory.server");
    const provider = await getTranscriptionProvider(org);
    const { data: row } = await admin
      .from("transcriptions")
      .insert({
        organization_id: org,
        call_log_id: log.id,
        status: "processing",
        provider: provider.name,
        language: input.language ?? null,
      })
      .select("id")
      .single();
    try {
      const result = await provider.transcribe({
        recordingUrl: log.recording_url,
        language: input.language ?? null,
      });
      const { data: done, error } = await admin
        .from("transcriptions")
        .update({
          status: "completed",
          text: result.text,
          summary: result.summary ?? null,
          language: result.language ?? null,
        })
        .eq("id", row!.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return ok(done);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin.from("transcriptions").update({ status: "failed" }).eq("id", row!.id);
      throw new Error(`Transcription failed: ${message}`);
    }
  },
});

export const getTranscriptTool = defineTool({
  name: "get_transcript",
  description: "Get the latest transcript for a call. Requires 'calls:read'.",
  parameters: z.object({ call_log_id: z.string().uuid() }),
  execute: async ({ call_log_id }, ctx) => {
    const c = ctx as Ctx;
    requireScope(c, "calls:read");
    const org = orgFromAuth(c);
    const { data, error } = await getAdmin()
      .from("transcriptions")
      .select("*")
      .eq("organization_id", org)
      .eq("call_log_id", call_log_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const dialerTools = [
  listClientsTool,
  getClientTool,
  createClientTool,
  logCallTool,
  createReminderTool,
  listRemindersTool,
  placeCallTool,
  getCallTool,
  enqueueAiCallTool,
  listCallJobsTool,
  cancelCallJobTool,
  getAgentActivityTool,
  startMonitorTool,
  transcribeCallTool,
  getTranscriptTool,
];
