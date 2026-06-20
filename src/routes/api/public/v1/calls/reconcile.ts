// Reconcile worker. Invoked by pg_cron (x-cron-token). For each org with a live
// Telavox config, pulls recent CDR (with recordings) and backfills session +
// linked call_log fields that a missed webhook would otherwise leave stale.
// With no live config, this is a no-op.
import { createFileRoute } from "@tanstack/react-router";
import { getAdmin, jsonError, jsonOk } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/calls/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.CRON_TOKEN;
        if (!token || request.headers.get("x-cron-token") !== token) {
          return jsonError(401, "Unauthorized");
        }
        const admin = getAdmin();
        const { getTelephonyContext } = await import("@/lib/telephony/factory.server");

        const { data: configs } = await admin
          .from("telavox_configs")
          .select("organization_id")
          .eq("enabled", true);

        let orgs = 0;
        let updated = 0;
        for (const cfg of configs ?? []) {
          const { provider, live } = await getTelephonyContext(cfg.organization_id);
          if (!live) continue;
          orgs++;
          let recent;
          try {
            recent = await provider.listRecentCalls({ withRecordings: true });
          } catch {
            continue;
          }
          for (const call of recent) {
            if (!call.externalCallId) continue;
            const { data: session } = await admin
              .from("call_sessions")
              .select("id, call_log_id, state")
              .eq("organization_id", cfg.organization_id)
              .eq("external_call_id", call.externalCallId)
              .maybeSingle();
            if (!session) continue;
            await admin
              .from("call_sessions")
              .update({
                state: call.state as never,
                answered_at: call.answeredAt ?? undefined,
                ended_at: call.endedAt ?? undefined,
                recording_url: call.recordingUrl ?? undefined,
                recording_id: call.recordingId ?? undefined,
                last_polled_at: new Date().toISOString(),
              })
              .eq("id", session.id);
            if (session.call_log_id) {
              await admin
                .from("call_logs")
                .update({
                  duration_s: call.durationS ?? undefined,
                  recording_url: call.recordingUrl ?? undefined,
                  recording_id: call.recordingId ?? undefined,
                } as never)
                .eq("id", session.call_log_id);
            }
            updated++;
          }
        }
        return jsonOk({ orgs, updated });
      },
    },
  },
});
