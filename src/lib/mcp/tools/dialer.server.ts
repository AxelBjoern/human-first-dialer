import { defineTool } from "mcp-tanstack-start";
import { z } from "zod";
import { getAdmin } from "@/lib/api-auth.server";

type Ctx = { auth?: { claims?: Record<string, unknown> } };
const orgFromAuth = (ctx: Ctx): string => {
  const org = ctx.auth?.claims?.organization_id;
  if (typeof org !== "string") throw new Error("Unauthorized");
  return org;
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
    if (query) q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
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
      .from("clients").select("*").eq("organization_id", org).eq("id", id).maybeSingle();
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
      .from("clients").insert({ ...input, organization_id: org } as never).select().single();
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
    const { data, error } = await getAdmin().from("call_logs").insert({
      ...input,
      organization_id: org,
      agent_id,
      direction: input.direction ?? "outbound",
      started_at: new Date().toISOString(),
    } as never).select().single();
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
    const { data, error } = await getAdmin().from("call_reminders").insert({
      ...input,
      organization_id: org,
      agent_id,
    } as never).select().single();
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
      .from("call_reminders").select("*")
      .eq("organization_id", org).eq("done", done ?? false)
      .order("call_time", { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    return ok(data);
  },
});

export const dialerTools = [
  listClientsTool, getClientTool, createClientTool, logCallTool, createReminderTool, listRemindersTool,
];
