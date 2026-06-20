// Inbound Telavox webhook — the event backbone (Telavox has no built-in dialer;
// it notifies us of call lifecycle + recordings). HMAC-signed with the org's
// telavox_configs.webhook_secret. The org is identified by ?org=<uuid> (or the
// x-vdnx-org header) since Telavox events don't carry our org id.
//
// BUILD-TO-SPEC: the signature header name and event payload shape are isolated
// here; confirm against Telavox docs before going live.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getAdmin, jsonError, jsonOk } from "@/lib/api-auth.server";
import { fireOrgWebhooks } from "@/lib/webhooks.server";

const SIGNATURE_HEADER = "x-telavox-signature";

const Payload = z.object({
  event: z.enum([
    "call.started",
    "call.ringing",
    "call.answered",
    "call.ended",
    "call.missed",
    "recording.ready",
  ]),
  callId: z.string(),
  answeredAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  durationS: z.number().optional().nullable(),
  recordingUrl: z.string().optional().nullable(),
  recordingId: z.string().optional().nullable(),
});

const STATE_BY_EVENT: Record<string, string> = {
  "call.started": "dialing",
  "call.ringing": "ringing",
  "call.answered": "active",
  "call.ended": "completed",
  "call.missed": "failed",
};

export const Route = createFileRoute("/api/public/v1/webhooks/telavox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const orgId = url.searchParams.get("org") ?? request.headers.get("x-vdnx-org");
        const signature = request.headers.get(SIGNATURE_HEADER);
        if (!orgId || !signature) return jsonError(400, "Missing org or signature");
        const raw = await request.text();

        const admin = getAdmin();
        const { data: cfg } = await admin
          .from("telavox_configs")
          .select("organization_id, webhook_secret, enabled")
          .eq("organization_id", orgId)
          .maybeSingle();
        if (!cfg || !cfg.enabled || !cfg.webhook_secret) {
          return jsonError(401, "Unknown or disabled Telavox config");
        }

        const expected = createHmac("sha256", cfg.webhook_secret).update(raw).digest("hex");
        const got = Buffer.from(signature);
        const want = Buffer.from(expected);
        if (got.length !== want.length || !timingSafeEqual(got, want)) {
          return jsonError(401, "Invalid signature");
        }

        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return jsonError(400, "Invalid JSON");
        }
        const parsed = Payload.safeParse(body);
        if (!parsed.success) return jsonError(400, parsed.error.message);
        const ev = parsed.data;

        const { data: session } = await admin
          .from("call_sessions")
          .select("*")
          .eq("organization_id", orgId)
          .eq("external_call_id", ev.callId)
          .maybeSingle();
        if (!session) return jsonOk({ ok: true, note: "no matching session" });

        const nextState = STATE_BY_EVENT[ev.event] ?? session.state;
        const answeredAt = ev.answeredAt ?? session.answered_at;
        const endedAt = ev.endedAt ?? session.ended_at;
        await admin
          .from("call_sessions")
          .update({
            state: nextState as never,
            answered_at: answeredAt,
            ended_at: endedAt,
            recording_url: ev.recordingUrl ?? session.recording_url,
            recording_id: ev.recordingId ?? session.recording_id,
          })
          .eq("id", session.id);

        // Resolve the call_log: AI calls link it on the session; human calls
        // create it via the outcome modal (carrying external_call_id) without
        // linking the session, so fall back to matching by external_call_id.
        let callLogId = session.call_log_id as string | null;
        if (!callLogId) {
          const { data: matched } = await admin
            .from("call_logs")
            .select("id")
            .eq("organization_id", orgId)
            .eq("external_call_id", ev.callId)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          callLogId = matched?.id ?? null;
        }

        // Update the linked call_log (created by the outcome modal / AI worker).
        if (
          callLogId &&
          (ev.event === "call.ended" ||
            ev.event === "recording.ready" ||
            ev.event === "call.missed")
        ) {
          const answered = ev.event !== "call.missed" && !!answeredAt;
          const talk =
            answered && answeredAt && endedAt
              ? Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(answeredAt)) / 1000))
              : 0;
          await admin
            .from("call_logs")
            .update({
              ended_at: endedAt,
              duration_s: ev.durationS ?? null,
              talk_time_s: talk,
              answered,
              recording_url: ev.recordingUrl ?? undefined,
              recording_id: ev.recordingId ?? undefined,
            } as never)
            .eq("id", callLogId);
        }

        // Automatic transcription: once a recording is available, transcribe it
        // (timestamps + text) so each completed call gets a transcript in history
        // without any manual step. Skipped if one already exists for this log.
        const recordingUrl = ev.recordingUrl ?? session.recording_url;
        if (ev.event === "recording.ready" && callLogId && recordingUrl) {
          const { data: existing } = await admin
            .from("transcriptions")
            .select("id")
            .eq("call_log_id", callLogId)
            .in("status", ["processing", "completed"])
            .limit(1)
            .maybeSingle();
          if (!existing) {
            try {
              const { runTranscription } = await import("@/lib/transcription/run.server");
              await runTranscription({
                admin,
                callLogId,
                sessionId: session.id,
              });
            } catch (e) {
              // Don't fail the webhook on transcription errors — log and move on.
              console.error("[telavox webhook] auto-transcription failed:", e);
            }
          }
        }

        await fireOrgWebhooks(orgId, ev.event, {
          session_id: session.id,
          external_call_id: ev.callId,
          state: nextState,
        });
        return jsonOk({ ok: true });
      },
    },
  },
});
