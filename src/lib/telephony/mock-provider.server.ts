// Mock telephony provider. Selected whenever an org has no enabled Telavox
// config, so the entire pipeline (UI -> session -> log -> worker) runs offline.
// State is derived purely from a timestamp encoded in the externalCallId, so it
// is stateless and survives across serverless invocations.
import { randomBytes } from "node:crypto";
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

const DIAL_MS = 1_000;
const RING_MS = 3_000;
const MAX_ACTIVE_MS = 600_000;

function parseDialedAt(externalCallId: string): number | null {
  const m = externalCallId.match(/^mock_(\d+)_/);
  return m ? Number(m[1]) : null;
}

function stateFor(dialedAt: number, now: number): ProviderCallState {
  const elapsed = now - dialedAt;
  if (elapsed < DIAL_MS) return "dialing";
  if (elapsed < RING_MS) return "ringing";
  if (elapsed < MAX_ACTIVE_MS) return "active";
  return "completed";
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export class MockTelephonyProvider implements TelephonyProvider {
  readonly name = "mock" as const;

  async dial(args: DialArgs): Promise<ProviderCall> {
    const dialedAt = Date.now();
    const externalCallId = `mock_${dialedAt}_${randomBytes(4).toString("hex")}`;
    return {
      externalCallId,
      state: "dialing",
      toE164: args.toE164,
      fromExtension: args.fromExtension ?? null,
      startedAt: iso(dialedAt),
      raw: { mock: true, callerType: args.callerType },
    };
  }

  async hangup(_externalCallId: string): Promise<void> {
    // Stateless mock: the session row records the ended state in the DB.
  }

  async getCall(externalCallId: string): Promise<ProviderCall | null> {
    const dialedAt = parseDialedAt(externalCallId);
    if (dialedAt == null) return null;
    const now = Date.now();
    const state = stateFor(dialedAt, now);
    const answeredAt = now - dialedAt >= RING_MS ? dialedAt + RING_MS : undefined;
    const endedAt = state === "completed" ? dialedAt + MAX_ACTIVE_MS : undefined;
    return {
      externalCallId,
      state,
      toE164: "",
      startedAt: iso(dialedAt),
      answeredAt: answeredAt != null ? iso(answeredAt) : null,
      endedAt: endedAt != null ? iso(endedAt) : null,
      durationS:
        answeredAt != null ? Math.floor((Math.min(now, endedAt ?? now) - answeredAt) / 1000) : null,
      recordingUrl: null,
      recordingId: null,
    };
  }

  async listRecentCalls(_filter: RecentCallFilter): Promise<ProviderCall[]> {
    return [];
  }

  async monitor(args: MonitorArgs): Promise<MonitorResult> {
    return {
      monitorRef: `mockmon_${Date.now()}_${randomBytes(3).toString("hex")}`,
      mode: args.mode,
      active: true,
      raw: { mock: true, externalCallId: args.externalCallId },
    };
  }

  async getRecording(_externalCallId: string): Promise<RecordingRef> {
    return { recordingUrl: null, recordingId: null };
  }
}
