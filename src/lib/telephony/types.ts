// Telephony provider abstraction (client-safe types — no node/server imports).
// Both the Mock and Telavox providers implement TelephonyProvider; the client
// click-to-dial engine maps ProviderCallState onto the UI CallState.

export type ProviderCallState =
  | "queued"
  | "dialing"
  | "ringing"
  | "active"
  | "completed"
  | "failed"
  | "canceled";

export type CallerType = "human" | "ai";
export type MonitorMode = "listen" | "whisper" | "barge";

export interface DialArgs {
  orgId: string;
  toE164: string;
  clientId?: string | null;
  /** Human click-to-dial: which Telavox extension rings first. */
  fromExtension?: string | null;
  /** AI / trunk: the presented caller-id number. */
  callerIdE164?: string | null;
  callerType: CallerType;
}

export interface ProviderCall {
  externalCallId: string;
  state: ProviderCallState;
  toE164: string;
  fromExtension?: string | null;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationS?: number | null;
  recordingUrl?: string | null;
  recordingId?: string | null;
  raw?: unknown;
}

export interface RecentCallFilter {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  limit?: number;
  withRecordings?: boolean;
}

export interface MonitorArgs {
  externalCallId: string;
  mode: MonitorMode;
  /** The supervisor's own Telavox extension that will hear the call. */
  supervisorExtension?: string | null;
}

export interface MonitorResult {
  monitorRef: string;
  mode: MonitorMode;
  active: boolean;
  raw?: unknown;
}

export interface RecordingRef {
  recordingUrl: string | null;
  recordingId: string | null;
}

export interface TelephonyProvider {
  readonly name: "telavox" | "mock";
  dial(args: DialArgs): Promise<ProviderCall>;
  hangup(externalCallId: string): Promise<void>;
  getCall(externalCallId: string): Promise<ProviderCall | null>;
  listRecentCalls(filter: RecentCallFilter): Promise<ProviderCall[]>;
  monitor(args: MonitorArgs): Promise<MonitorResult>;
  getRecording(externalCallId: string): Promise<RecordingRef>;
}

/** Map a provider state onto the high-level lifecycle used by sessions/logs. */
export function isTerminalState(s: ProviderCallState): boolean {
  return s === "completed" || s === "failed" || s === "canceled";
}
