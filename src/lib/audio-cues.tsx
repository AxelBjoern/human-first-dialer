// Client hook for playing ElevenLabs call-audio in the browser. Resolves cue
// audio to signed URLs on demand (cached per session), plays them via an <audio>
// element, and honours a persisted sound-enabled preference. Browser playback only
// — this never enters the PSTN call (click-to-dial audio lives on the agent's phone).
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/current-org";
import { ensureVoiceCue, synthPrompt, type CueKey } from "@/lib/voice-cues.functions";
import type { CallState } from "@/lib/call-engine";

const PREF_KEY = "vdnx.callSounds";

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(PREF_KEY) !== "off";
}

export function useCallAudioCues() {
  const { currentOrgId } = useCurrentOrg();
  const ensure = useServerFn(ensureVoiceCue);
  const synth = useServerFn(synthPrompt);
  const [enabled, setEnabledState] = useState<boolean>(readPref);
  const urlCache = useRef<Map<string, string>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREF_KEY, v ? "on" : "off");
    }
  }, []);

  const playUrl = useCallback((url: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    // Autoplay can be blocked until the user interacts — ignore that rejection.
    void audioRef.current.play().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Play a lifecycle cue. Respects the sound-enabled preference.
  const play = useCallback(
    async (cue: CueKey) => {
      if (!enabled || !currentOrgId) return;
      try {
        let url = urlCache.current.get(cue);
        if (!url) {
          const res = await ensure({ data: { organization_id: currentOrgId, cue } });
          url = res.url;
          urlCache.current.set(cue, url);
        }
        playUrl(url);
      } catch {
        // ElevenLabs not configured / network error — stay silent.
      }
    },
    [enabled, currentOrgId, ensure, playUrl],
  );

  // Play an arbitrary scripted prompt (explicit user action — always plays).
  const playPrompt = useCallback(
    async (text: string) => {
      if (!currentOrgId || !text.trim()) return;
      const res = await synth({ data: { organization_id: currentOrgId, text } });
      playUrl(res.url);
    },
    [currentOrgId, synth, playUrl],
  );

  return { enabled, setEnabled, play, playPrompt, stop };
}

const CUE_BY_STATE: Partial<Record<CallState, CueKey>> = {
  dialing: "call_start",
  ringing: "ringing",
  active: "answered",
  ended: "hangup",
};

/**
 * Fires the matching audio cue on each call-state transition. Mount once where
 * the call snapshot is available (the softphone). Returns the underlying cue API
 * so the same component can drive the mute toggle, hold cue, and scripted prompts.
 */
export function useCallCues(state: CallState) {
  const cues = useCallAudioCues();
  const prev = useRef<CallState>(state);
  const { play } = cues;
  useEffect(() => {
    const from = prev.current;
    prev.current = state;
    if (from === state) return;
    const cue = CUE_BY_STATE[state];
    if (cue) void play(cue);
  }, [state, play]);
  return cues;
}
