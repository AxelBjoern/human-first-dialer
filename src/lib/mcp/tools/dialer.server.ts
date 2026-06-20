import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { getAdmin, type ApiAuth } from "@/lib/api-auth.server";

const orgFromAuth = (auth: unknown): string => {
  const a = auth as ApiAuth | undefined;
  if (!a?.organization_id) throw new Error("Unauthorized");
  return a.organization_id;
};

export const listClientsTool = defineTool({
  name: "list_clients",
  description: "List clients in the connected workspace. Optional search query.",
  parameters: z.object({
    query: z.string().optional().describe("Search by name, phone, or email"),
    limit: z.number().int().min(1).max(200).optional().default(50),
  }),
  execute: async ({ query, limit }, { auth }) => {
    const org = orgFromAuth(auth);
    let q = getAdmin()
      .from("clients")
      .select("id,first_name,last_name,phone,email,city,investment_status")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (query) q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  },
});

export const getClientTool = defineTool({
  name: "get_client",
  description: "Fetch one client by ID.",
  parameters: z.object({ id: z.string().uuid() }),
  execute: async ({ id }, { auth }) => {
    const org = orgFromAuth(auth);
    const { data, error } = await getAdmin()
      .from("clients")
      .select("*")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Not found");
    return data;
  },
});

export const createClientTool = defineTool({
  name: "create_client",
  description: "Create or upsert a client in the connected workspace.",
  parameters: z.object({
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    investment_status: z.string().optional(),
    notes: z.string().optional(),
    external_id: z.string().optional().describe("ID in your source system for upsert"),
    source_app: z.enum(["vdnx", "energy", "executive"]).optional(),
  }),
  execute: async (input, { auth }) => {
    const org = orgFromAuth(auth);
    const { data, error } = await getAdmin()
      .from("clients")
      .insert({ ...input, organization_id: org } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

export const logCallTool = defineTool({
  name: "log_call",
  description: "Record a completed call in the workspace's history.",
  parameters: z.object({
    client_id: z.string().uuid().optional(),
    phone_e164: z.string(),
    direction: z.enum(["inbound", "outbound"]).default("outbound"),
    duration_s: z.number().int().nonnegative().optional(),
    outcome_code: z.string().optional(),
    notes: z.string().optional(),
  }),
  execute: async (input, { auth }) => {
    const org = orgFromAuth(auth);
    const admin = getAdmin();
    const { data: owner } = await admin
      .from("org_members")
      .select("user_id")
      .eq("organization_id", org)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!owner) throw new Error("No owner for organization");
    const { data, error } = await admin
      .from("call_logs")
      .insert({
        ...input,
        organization_id: org,
        agent_id: owner.user_id,
        started_at: new Date().toISOString(),
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
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
  execute: async (input, { auth }) => {
    const org = orgFromAuth(auth);
    const admin = getAdmin();
    const { data: owner } = await admin
      .from("org_members")
      .select("user_id")
      .eq("organization_id", org)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    if (!owner) throw new Error("No owner for organization");
    const { data, error } = await admin
      .from("call_reminders")
      .insert({
        ...input,
        organization_id: org,
        agent_id: owner.user_id,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
});

export const listRemindersTool = defineTool({
  name: "list_reminders",
  description: "List pending reminders.",
  parameters: z.object({ done: z.boolean().optional().default(false) }),
  execute: async ({ done }, { auth }) => {
    const org = orgFromAuth(auth);
    const { data, error } = await getAdmin()
      .from("call_reminders")
      .select("*")
      .eq("organization_id", org)
      .eq("done", done ?? false)
      .order("call_time", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  },
});

export const dialerTools = [
  listClientsTool,
  getClientTool,
  createClientTool,
  logCallTool,
  createReminderTool,
  listRemindersTool,
];
