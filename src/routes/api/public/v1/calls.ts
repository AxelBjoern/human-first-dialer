// Public REST: place calls (human click-to-dial or AI job) and read call history.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiAuth, getAdmin, jsonError, jsonOk, rateLimit } from "@/lib/api-auth.server";
import { fireOrgWebhooks } from "@/lib/webhooks.server";

const PlaceInput = z.object({
  to_e164: z.string().min(3),
  client_id: z.string().uuid().optional().nullable(),
  caller_type: z.enum(["human", "ai"]).default("human"),
  from_extension: z.string().optional(),
  prompt: z.string().optional(),
  voice_config: z.record(z.unknown()).optional(),
  scheduled_at: z.string().datetime().optional(),
});

async function ownerOf(admin: ReturnType<typeof getAdmin>, orgId: string) {
  const { data: owner } = await admin
    .from("org_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  return owner?.user_id ?? null;
}

export const Route = createFileRoute("/api/public/v1/calls")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["calls:read"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const clientId = url.searchParams.get("client_id");
        const outcome = url.searchParams.get("outcome_code");
        const callerType = url.searchParams.get("caller_type");
        let q = getAdmin()
          .from("call_logs")
          .select("*")
          .eq("organization_id", auth.organization_id)
          .order("started_at", { ascending: false })
          .limit(limit);
        if (clientId) q = q.eq("client_id", clientId);
        if (outcome) q = q.eq("outcome_code", outcome);
        if (callerType === "human" || callerType === "ai") q = q.eq("caller_type", callerType);
        const { data, error } = await q;
        if (error) return jsonError(500, error.message);
        return jsonOk({ data });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["calls:initiate"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const parsed = PlaceInput.safeParse(body);
        if (!parsed.success) return jsonError(400, parsed.error.message);
        const input = parsed.data;
        const admin = getAdmin();

        if (input.caller_type === "ai") {
          const { data: job, error } = await admin
            .from("ai_call_jobs")
            .insert({
              organization_id: auth.organization_id,
              phone_e164: input.to_e164,
              client_id: input.client_id ?? null,
              prompt: input.prompt ?? null,
              voice_config: (input.voice_config ?? {}) as never,
              scheduled_at: input.scheduled_at ?? new Date().toISOString(),
              status: "pending",
            } as never)
            .select("id, status")
            .single();
          if (error) return jsonError(500, error.message);
          return jsonOk({ job_id: job.id, status: job.status }, 201);
        }

        // Human click-to-dial via the org owner (API has no end-user identity).
        const ownerId = await ownerOf(admin, auth.organization_id);
        if (!ownerId) return jsonError(500, "No owner for organization");
        const { getTelephonyContext, extensionForAgent } =
          await import("@/lib/telephony/factory.server");
        const { provider, config } = await getTelephonyContext(auth.organization_id);
        const fromExtension = input.from_extension ?? extensionForAgent(config, ownerId);

        const { data: session, error: sErr } = await admin
          .from("call_sessions")
          .insert({
            organization_id: auth.organization_id,
            caller_type: "human",
            agent_id: ownerId,
            client_id: input.client_id ?? null,
            phone_e164: input.to_e164,
            state: "queued",
            provider: provider.name,
            from_extension: fromExtension,
          })
          .select("id")
          .single();
        if (sErr) return jsonError(500, sErr.message);

        try {
          const call = await provider.dial({
            orgId: auth.organization_id,
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
          await fireOrgWebhooks(auth.organization_id, "call.started", {
            session_id: session.id,
            external_call_id: call.externalCallId,
            to_e164: input.to_e164,
          });
          return jsonOk(
            { session_id: session.id, external_call_id: call.externalCallId, state: call.state },
            201,
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await admin
            .from("call_sessions")
            .update({ state: "failed", error: message })
            .eq("id", session.id);
          return jsonError(502, `Dial failed: ${message}`);
        }
      },
    },
  },
});
