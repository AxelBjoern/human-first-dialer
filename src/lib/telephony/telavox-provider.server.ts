// Telavox telephony provider (BUILD-TO-SPEC).
// Telavox has no built-in dialer; it exposes REST + webhooks. v1 base is
// https://api.telavox.se (deprecated 2026-12-31 -> migrate to CAPI). Dialing is
// click-to-call/callback: Telavox rings the agent's own device, then bridges.
//
// Endpoint shapes below are isolated in one place and TODO-marked: confirm the
// exact paths/payloads against Telavox docs + a sandbox before going live. With
// no enabled config this provider is never constructed (factory falls back to Mock).
import type {
  DialArgs,
  MonitorArgs,
  MonitorResult,
  ProviderCall,
  ProviderCallState,
  RecentCallFilter,
  RecordingRef,
  TelephonyProvider,
} from "./types";

export interface TelavoxProviderOpts {
  baseUrl: string;
  authKind: string; // 'bearer' | 'basic'
  apiToken: string; // bearer JWT, or "user:pass" for basic
  callerIdE164?: string | null;
}

// --- Telavox endpoint map (TODO: verify against official docs) -------------
const ENDPOINTS = {
  dial: "/dial", // POST: initiate click-to-call/callback
  hangup: "/hangup", // POST: end an active call
  calls: "/calls", // GET: CDR history (fromDate/toDate/withRecordings)
  recordings: "/recordings", // GET: recording metadata/links
  monitor: "/monitor", // POST: supervisor listen/whisper/barge (PBX feature)
};

interface TelavoxCdrEntry {
  id?: string;
  callId?: string;
  number?: string;
  to?: string;
  from?: string;
  datetime?: string;
  startTime?: string;
  answerTime?: string;
  endTime?: string;
  duration?: number;
  recordingId?: string;
  recordingUrl?: string;
  state?: string;
}

function mapState(raw: string | undefined): ProviderCallState {
  switch ((raw ?? "").toLowerCase()) {
    case "dialing":
    case "calling":
      return "dialing";
    case "ringing":
    case "alerting":
      return "ringing";
    case "active":
    case "answered":
    case "up":
      return "active";
    case "completed":
    case "ended":
    case "hangup":
      return "completed";
    case "failed":
    case "error":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "active";
  }
}

function mapCdr(e: TelavoxCdrEntry, fallbackId: string): ProviderCall {
  return {
    externalCallId: e.callId ?? e.id ?? fallbackId,
    state: mapState(e.state),
    toE164: e.to ?? e.number ?? "",
    fromExtension: e.from ?? null,
    startedAt: e.startTime ?? e.datetime ?? null,
    answeredAt: e.answerTime ?? null,
    endedAt: e.endTime ?? null,
    durationS: typeof e.duration === "number" ? e.duration : null,
    recordingUrl: e.recordingUrl ?? null,
    recordingId: e.recordingId ?? null,
    raw: e,
  };
}

export class TelavoxTelephonyProvider implements TelephonyProvider {
  readonly name = "telavox" as const;
  private readonly base: string;
  private readonly opts: TelavoxProviderOpts;

  constructor(opts: TelavoxProviderOpts) {
    this.opts = opts;
    this.base = opts.baseUrl.replace(/\/+$/, "");
  }

  private authHeader(): string {
    if (this.opts.authKind === "basic") {
      return `Basic ${Buffer.from(this.opts.apiToken).toString("base64")}`;
    }
    return `Bearer ${this.opts.apiToken}`;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        Authorization: this.authHeader(),
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Telavox ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    }
    return (await res.json().catch(() => ({}))) as T;
  }

  async dial(args: DialArgs): Promise<ProviderCall> {
    const payload = {
      to: args.toE164,
      from: args.fromExtension ?? undefined,
      callerId: args.callerIdE164 ?? this.opts.callerIdE164 ?? undefined,
      callerType: args.callerType,
    };
    const data = await this.req<TelavoxCdrEntry>("POST", ENDPOINTS.dial, payload);
    return mapCdr(data, `telavox_${Date.now()}`);
  }

  async hangup(externalCallId: string): Promise<void> {
    await this.req<unknown>("POST", ENDPOINTS.hangup, { callId: externalCallId });
  }

  async getCall(externalCallId: string): Promise<ProviderCall | null> {
    // No per-call GET in v1; scan recent CDR for the matching id.
    const recent = await this.listRecentCalls({ withRecordings: true });
    return recent.find((c) => c.externalCallId === externalCallId) ?? null;
  }

  async listRecentCalls(filter: RecentCallFilter): Promise<ProviderCall[]> {
    const qs = new URLSearchParams();
    if (filter.fromDate) qs.set("fromDate", filter.fromDate);
    if (filter.toDate) qs.set("toDate", filter.toDate);
    if (filter.withRecordings) qs.set("withRecordings", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await this.req<
      | { incoming?: TelavoxCdrEntry[]; outgoing?: TelavoxCdrEntry[]; missed?: TelavoxCdrEntry[] }
      | TelavoxCdrEntry[]
    >("GET", ENDPOINTS.calls + suffix);
    const entries = Array.isArray(data)
      ? data
      : [...(data.outgoing ?? []), ...(data.incoming ?? []), ...(data.missed ?? [])];
    const mapped = entries.map((e) => mapCdr(e, `telavox_${Date.now()}`));
    return typeof filter.limit === "number" ? mapped.slice(0, filter.limit) : mapped;
  }

  async monitor(args: MonitorArgs): Promise<MonitorResult> {
    const data = await this.req<{ monitorId?: string; id?: string }>("POST", ENDPOINTS.monitor, {
      callId: args.externalCallId,
      mode: args.mode,
      extension: args.supervisorExtension ?? undefined,
    });
    return {
      monitorRef: data.monitorId ?? data.id ?? `telavoxmon_${Date.now()}`,
      mode: args.mode,
      active: true,
      raw: data,
    };
  }

  async getRecording(externalCallId: string): Promise<RecordingRef> {
    const call = await this.getCall(externalCallId);
    return { recordingUrl: call?.recordingUrl ?? null, recordingId: call?.recordingId ?? null };
  }
}
