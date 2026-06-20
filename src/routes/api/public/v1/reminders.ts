import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiAuth, getAdmin, jsonError, jsonOk, rateLimit } from "@/lib/api-auth.server";

const ReminderInput = z.object({
  client_id: z.string().uuid().optional().nullable(),
  call_time: z.string().datetime(),
  note: z.string().optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["reminders:read"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        const { data, error } = await getAdmin()
          .from("call_reminders")
          .select("*")
          .eq("organization_id", auth.organization_id)
          .eq("done", false)
          .order("call_time", { ascending: true })
          .limit(200);
        if (error) return jsonError(500, error.message);
        return jsonOk({ data });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["reminders:write"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        let body: unknown;
        try { body = await request.json(); } catch { return jsonError(400, "Invalid JSON"); }
        const parsed = ReminderInput.safeParse(body);
        if (!parsed.success) return jsonError(400, parsed.error.message);
        const admin = getAdmin();
        const { data: owner } = await admin
          .from("org_members")
          .select("user_id")
          .eq("organization_id", auth.organization_id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();
        if (!owner) return jsonError(500, "No owner for organization");
        const { data, error } = await admin
          .from("call_reminders")
          .insert({
            ...parsed.data,
            organization_id: auth.organization_id,
            agent_id: owner.user_id,
          } as never)
          .select()
          .single();
        if (error) return jsonError(500, error.message);
        return jsonOk({ data }, 201);
      },
    },
  },
});
