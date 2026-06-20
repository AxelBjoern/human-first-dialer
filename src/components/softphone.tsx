import { useEffect, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Delete,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCallEngine, useCallSnapshot, formatDuration } from "@/lib/call-engine";
import { useCallCues } from "@/lib/audio-cues";
import { OutcomeModal } from "@/components/outcome-modal";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function Softphone() {
  const engine = useCallEngine();
  const snap = useCallSnapshot();
  const cues = useCallCues(snap.state);
  const [number, setNumber] = useState("");
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [script, setScript] = useState("");
  const [scriptOpen, setScriptOpen] = useState(false);

  useEffect(() => {
    if (snap.state === "ended") setOutcomeOpen(true);
    if (snap.state === "idle" || snap.state === "ended") setOnHold(false);
  }, [snap.state]);

  const toggleHold = () => {
    const next = !onHold;
    setOnHold(next);
    if (next) void cues.play("hold");
  };

  const isLive = snap.state === "dialing" || snap.state === "ringing" || snap.state === "active";

  return (
    <aside className="hidden w-80 shrink-0 border-l border-border bg-card lg:flex lg:flex-col">
      <div className="flex items-start justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Softphone</h2>
          <p className="text-xs text-muted-foreground">
            {snap.state === "idle" && "Ready"}
            {snap.state === "dialing" && "Dialing..."}
            {snap.state === "ringing" && "Ringing"}
            {snap.state === "active" &&
              `On call · ${formatDuration(snap.durationS)}${onHold ? " · On hold" : ""}`}
            {snap.state === "ended" && "Call ended"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          title={cues.enabled ? "Mute call sounds" : "Unmute call sounds"}
          onClick={() => cues.setEnabled(!cues.enabled)}
        >
          {cues.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLive ? (
          <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">In call</p>
            <p className="mt-1 font-display text-xl">{snap.call?.phone}</p>
            <p className="mt-1 text-2xl font-mono tabular-nums text-primary">
              {formatDuration(snap.durationS)}
            </p>
          </div>
        ) : (
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+47 ..."
            className="text-center text-lg tracking-wider"
          />
        )}

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setNumber((n) => n + k)}
              disabled={isLive}
              className="h-12 rounded-md border border-border bg-background font-display text-lg hover:bg-accent/20 disabled:opacity-40"
            >
              {k}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setNumber((n) => n.slice(0, -1))}
            disabled={isLive}
          >
            <Delete className="h-4 w-4" />
          </Button>
          {isLive ? (
            <>
              <Button
                variant="outline"
                onClick={() => engine.setMuted(!snap.call?.muted)}
                className="flex-1"
                title={snap.call?.muted ? "Unmute" : "Mute"}
              >
                {snap.call?.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                variant={onHold ? "secondary" : "outline"}
                onClick={toggleHold}
                className="flex-1"
                title={onHold ? "Resume" : "Hold"}
              >
                {onHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button variant="destructive" onClick={() => engine.hangup()} className="flex-1">
                <PhoneOff className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (!number.trim()) return;
                engine.dial(number.trim());
              }}
            >
              <Phone className="h-4 w-4 mr-2" /> Call
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border p-3">
          <button
            type="button"
            onClick={() => setScriptOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-sm font-medium"
          >
            <Megaphone className="h-4 w-4" /> Scripted prompt
          </button>
          {scriptOpen && (
            <div className="mt-3 space-y-2">
              <Input
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="e.g. Remember to confirm the appointment date"
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={!script.trim()}
                onClick={() => cues.playPrompt(script)}
              >
                <Play className="h-4 w-4 mr-2" /> Play to me
              </Button>
              <p className="text-xs text-muted-foreground">
                Plays in your browser before/during a call — not heard by the contact.
              </p>
            </div>
          )}
        </div>
      </div>

      <OutcomeModal
        open={outcomeOpen}
        onOpenChange={(o) => {
          setOutcomeOpen(o);
          if (!o) {
            engine.reset();
            setNumber("");
          }
        }}
        call={snap.call}
        durationS={snap.durationS}
      />
    </aside>
  );
}
