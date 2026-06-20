// Client-side CallEngine backed by Telavox click-to-dial. It calls the telephony
// server functions and drives the UI state machine by polling getCallStatus
// (webhooks are authoritative server-side; polling is the client fallback).
// Implements the SAME CallEngine interface as the mock, so the softphone is
// unchanged. Note: with click-to-dial Telavox rings the agent's own device, so
// there is no browser audio — mute is a visual no-op.
import { startCall, getCallStatus, endCall } from "@/lib/telephony.functions";
import type { ActiveCall, CallEngine, CallSnapshot, CallState } from "@/lib/call-engine";

const POLL_MS = 2000;

function mapState(provider: string): CallState {
  switch (provider) {
    case "queued":
    case "dialing":
      return "dialing";
    case "ringing":
      return "ringing";
    case "active":
      return "active";
    case "completed":
    case "failed":
    case "canceled":
      return "ended";
    default:
      return "dialing";
  }
}

export function createTelavoxClickToDialEngine(opts: { orgId: string }): CallEngine {
  let state: CallState = "idle";
  let call: ActiveCall | null = null;
  let sessionId: string | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(s: CallSnapshot) => void>();

  const snap = (): CallSnapshot => ({
    state,
    call,
    durationS:
      call && call.startedAt
        ? Math.max(0, Math.floor(((call.endedAt ?? Date.now()) - call.startedAt) / 1000))
        : 0,
  });
  const emit = () => listeners.forEach((cb) => cb(snap()));
  const stopPoll = () => {
    if (poll) {
      clearInterval(poll);
      poll = null;
    }
  };

  const startPolling = () => {
    stopPoll();
    poll = setInterval(async () => {
      const sid = sessionId;
      if (!sid) return;
      let s: Awaited<ReturnType<typeof getCallStatus>>;
      try {
        s = await getCallStatus({ data: { session_id: sid } });
      } catch {
        return; // transient errors are ignored; next tick retries
      }
      {
        const mapped = mapState(s.state);
        if (state === "ended" || state === "idle") return;
        if (mapped === "ended") {
          call = call ? { ...call, endedAt: Date.now() } : call;
          state = "ended";
          stopPoll();
          emit();
          return;
        }
        if (mapped === "active" && state !== "active" && call) {
          call = { ...call, startedAt: Date.now() };
        }
        if (mapped !== state) {
          state = mapped;
          emit();
        }
      }
    }, POLL_MS);
  };

  return {
    snapshot: snap,
    subscribe(cb) {
      listeners.add(cb);
      cb(snap());
      return () => listeners.delete(cb);
    },
    dial(phone, clientId) {
      if (state !== "idle" && state !== "ended") return;
      stopPoll();
      call = { phone, clientId, startedAt: Date.now(), muted: false };
      state = "dialing";
      sessionId = null;
      emit();
      startCall({
        data: { organization_id: opts.orgId, to_e164: phone, client_id: clientId },
      })
        .then((res) => {
          if (state === "idle" || state === "ended") return; // hung up while dialing
          sessionId = res.session_id;
          if (call)
            call = {
              ...call,
              sessionId: res.session_id,
              externalCallId: res.external_call_id,
              provider: "telavox",
            };
          const mapped = mapState(res.state);
          if (mapped === "active" && call) call = { ...call, startedAt: Date.now() };
          state = mapped;
          emit();
          if (state !== "ended") startPolling();
        })
        .catch((e) => {
          call = call ? { ...call, endedAt: Date.now() } : call;
          state = "ended";
          emit();
          console.error("startCall failed", e);
        });
    },
    hangup() {
      if (!call || state === "idle") return;
      stopPoll();
      call = { ...call, endedAt: Date.now() };
      state = "ended";
      emit();
      if (sessionId) endCall({ data: { session_id: sessionId } }).catch(() => {});
    },
    setMuted(m) {
      if (!call) return;
      call = { ...call, muted: m }; // visual only for click-to-dial
      emit();
    },
    reset() {
      stopPoll();
      call = null;
      state = "idle";
      sessionId = null;
      emit();
    },
  };
}
