import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type CallState = "idle" | "dialing" | "ringing" | "active" | "ended";

export interface ActiveCall {
  phone: string;
  clientId?: string;
  startedAt: number;
  endedAt?: number;
  muted: boolean;
}

export interface CallSnapshot {
  state: CallState;
  call: ActiveCall | null;
  durationS: number;
}

export interface CallEngine {
  snapshot(): CallSnapshot;
  dial(phoneE164: string, clientId?: string): void;
  hangup(): void;
  setMuted(m: boolean): void;
  reset(): void;
  subscribe(cb: (s: CallSnapshot) => void): () => void;
}

function createMockEngine(): CallEngine {
  let state: CallState = "idle";
  let call: ActiveCall | null = null;
  const listeners = new Set<(s: CallSnapshot) => void>();
  let timers: ReturnType<typeof setTimeout>[] = [];

  const snap = (): CallSnapshot => ({
    state,
    call,
    durationS:
      call && call.startedAt && (call.endedAt ?? Date.now())
        ? Math.max(0, Math.floor(((call.endedAt ?? Date.now()) - call.startedAt) / 1000))
        : 0,
  });

  const emit = () => listeners.forEach((cb) => cb(snap()));

  return {
    snapshot: snap,
    subscribe(cb) {
      listeners.add(cb);
      cb(snap());
      return () => listeners.delete(cb);
    },
    dial(phone, clientId) {
      if (state !== "idle" && state !== "ended") return;
      timers.forEach(clearTimeout);
      timers = [];
      call = { phone, clientId, startedAt: Date.now(), muted: false };
      state = "dialing";
      emit();
      timers.push(
        setTimeout(() => {
          if (state !== "dialing") return;
          state = "ringing";
          emit();
        }, 700),
      );
      timers.push(
        setTimeout(() => {
          if (state !== "ringing") return;
          state = "active";
          call = call ? { ...call, startedAt: Date.now() } : null;
          emit();
        }, 1800),
      );
    },
    hangup() {
      if (!call || state === "idle") return;
      timers.forEach(clearTimeout);
      timers = [];
      call = { ...call, endedAt: Date.now() };
      state = "ended";
      emit();
    },
    setMuted(m) {
      if (!call) return;
      call = { ...call, muted: m };
      emit();
    },
    reset() {
      timers.forEach(clearTimeout);
      timers = [];
      call = null;
      state = "idle";
      emit();
    },
  };
}

const CallEngineContext = createContext<CallEngine | null>(null);

export function CallEngineProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => createMockEngine(), []);
  return <CallEngineContext.Provider value={engine}>{children}</CallEngineContext.Provider>;
}

export function useCallEngine() {
  const engine = useContext(CallEngineContext);
  if (!engine) throw new Error("useCallEngine must be used inside CallEngineProvider");
  return engine;
}

export function useCallSnapshot() {
  const engine = useCallEngine();
  const [snap, setSnap] = useState<CallSnapshot>(() => engine.snapshot());
  useEffect(() => engine.subscribe(setSnap), [engine]);
  // tick once a second while active
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (snap.state === "active") {
      tickRef.current = setInterval(() => setSnap(engine.snapshot()), 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [snap.state, engine]);
  return snap;
}

export function formatDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
