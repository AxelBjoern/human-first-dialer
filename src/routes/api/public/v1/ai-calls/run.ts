// AI call worker. Invoked by pg_cron (x-cron-token). Drains pending ai_call_jobs:
// dials via Telavox (trunk) + starts the voice-AI session, records a call_log,
// and finalizes. With Mock/Stub providers (no creds) it synthesizes completion so
// the full pipeline yields a call_log offline. Live Telavox calls are finalized
// later by the Telavox webhook.
import { createFileRoute } from "@tanstack/react-router";
import { getAdmin, jsonError, jsonOk } from "@/lib/api-auth.server";
import { fireOrgWebhooks } from "@/lib/webhooks.server";

const BATCH = 10;

export const Route = createFileRoute("/api/public/v1/ai-calls/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.CRON_TOKEN;
        if (!token || request.headers.get("x-cron-token") !== token) {
          return jsonError(401, "Unauthorized");
        }
        const admin = getAdmin();
        const { getTelephonyContext } = await import("@/lib/telephony/factory.server");
        const { getVoiceAgentProvider } = await import("@/lib/voice/factory.server");

        const nowIso = new Date().toISOString();
        const { data: candidates } = await admin
          .from("ai_call_jobs")
          .select("id")
          .eq("status", "pending")
          .lte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(BATCH);

        let processed = 0;
        let succeeded = 0;
        let failed = 0;

        for (const cand of candidates ?? []) {
          // Atomic claim: only one worker wins the pending -> in_progress transition.
          const { data: claimed } = await admin
            .from("ai_call_jobs")
            .update({ status: "in_progress", locked_at: new Date().toISOString() })
            .eq("id", cand.id)
            .eq("status", "pending")
            .select("*")
            .maybeSingle();
          if (!claimed) continue;
          processed++;

          try {
            const { provider, config, live } = await getTelephonyContext(claimed.organization_id);
            const voice = await getVoiceAgentProvider(claimed.organization_id);

            const { data: ownerRow } = await admin
              .from("org_members")
              .select("user_id")
              .eq("organization_id", claimed.organization_id)
              .eq("role", "owner")
              .limit(1)
              .maybeSingle();
            if (!ownerRow) throw new Error("No owner for organization");

            const { data: session } = await admin
              .from("call_sessions")
              .insert({
                organization_id: claimed.organization_id,
                caller_type: "ai",
                agent_id: null,
                client_id: claimed.client_id,
                phone_e164: claimed.phone_e164,
                state: "queued",
                provider: provider.name,
              })
              .select("id")
              .single();
            if (!session) throw new Error("Failed to create session");

            const call = await provider.dial({
              orgId: claimed.organization_id,
              toE164: claimed.phone_e164,
              clientId: claimed.client_id,
              callerIdE164: config?.caller_id_e164 ?? null,
              callerType: "ai",
            });
            await admin
              .from("call_sessions")
              .update({
                external_call_id: call.externalCallId,
                state: call.state,
                started_at: call.startedAt ?? new Date().toISOString(),
              })
              .eq("id", session.id);

            await voice.startSession({
              orgId: claimed.organization_id,
              sessionId: session.id,
              toE164: claimed.phone_e164,
              callerIdE164: config?.caller_id_e164 ?? null,
              prompt: claimed.prompt,
              voiceConfig: (claimed.voice_config ?? {}) as Record<string, unknown>,
              externalCallId: call.externalCallId,
            });

            // Create the AI call_log (attributed to org owner profile + caller_type 'ai').
            const startedAt = call.startedAt ?? new Date().toISOString();
            const { data: log } = await admin
              .from("call_logs")
              .insert({
                organization_id: claimed.organization_id,
                agent_id: ownerRow.user_id,
                client_id: claimed.client_id,
                direction: "outbound",
                caller_type: "ai",
                provider: provider.name,
                ai_job_id: claimed.id,
                external_call_id: call.externalCallId,
                phone_e164: claimed.phone_e164,
                started_at: startedAt,
                answered: false,
              } as never)
              .select("id")
              .single();

            await admin
              .from("call_sessions")
              .update({ call_log_id: log?.id ?? null })
              .eq("id", session.id);

            await fireOrgWebhooks(claimed.organization_id, "call.started", {
              session_id: session.id,
              job_id: claimed.id,
              external_call_id: call.externalCallId,
            });

            if (!live) {
              // Offline (Mock/Stub): synthesize completion so a finished call_log exists.
              const endedAt = new Date().toISOString();
              const talk = 30;
              await admin
                .from("call_logs")
                .update({
                  ended_at: endedAt,
                  duration_s: talk,
                  talk_time_s: talk,
                  answered: true,
                  outcome_code: "connected",
                } as never)
                .eq("id", log?.id ?? "");
              await admin
                .from("call_sessions")
                .update({ state: "completed", answered_at: startedAt, ended_at: endedAt })
                .eq("id", session.id);
              await voice.endSession(`voice_${session.id}`).catch(() => {});
              await fireOrgWebhooks(claimed.organization_id, "call.ended", {
                session_id: session.id,
                job_id: claimed.id,
              });
            }

            await admin
              .from("ai_call_jobs")
              .update({ status: "completed", session_id: session.id, call_log_id: log?.id ?? null })
              .eq("id", claimed.id);
            succeeded++;
          } catch (e) {
            failed++;
            const message = e instanceof Error ? e.message : String(e);
            const retry = (claimed.attempts ?? 0) + 1 < (claimed.max_attempts ?? 1);
            await admin
              .from("ai_call_jobs")
              .update({
                status: retry ? "pending" : "failed",
                attempts: (claimed.attempts ?? 0) + 1,
                last_error: message,
                locked_at: null,
              })
              .eq("id", claimed.id);
          }
        }

        return jsonOk({ processed, succeeded, failed });
      },
    },
  },
});
