import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiAuth, getAdmin, jsonError, jsonOk, rateLimit } from "@/lib/api-auth.server";

const CallInput = z.object({
  client_id: z.string().uuid().optional().nullable(),
  phone_e164: z.string(),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
  duration_s: z.number().int().nonnegative().optional(),
  outcome_code: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  external_call_id: z.string().optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/call-logs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["calls:write"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const parsed = CallInput.safeParse(body);
        if (!parsed.success) return jsonError(400, parsed.error.message);
        // agent_id is required but not known for API callers; use a system row for the org's owner.
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
          .from("call_logs")
          .insert({
            ...parsed.data,
            organization_id: auth.organization_id,
            agent_id: owner.user_id,
            started_at: parsed.data.started_at ?? new Date().toISOString(),
          } as never)
          .select()
          .single();
        if (error) return jsonError(500, error.message);
        return jsonOk({ data }, 201);
      },
    },
  },
});
