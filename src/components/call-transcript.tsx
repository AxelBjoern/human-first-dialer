// Renders a call transcript with timestamps. Polls getTranscript while a
// transcription is still processing (the "Transcribing…" near-live state used
// right after hangup), then shows segments as `mm:ss — text` (falling back to the
// flat text). Shared by the softphone panel and the call-history detail dialog.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTranscript } from "@/lib/transcription.functions";
import { formatDuration } from "@/lib/call-engine";

interface Segment {
  start: number;
  end: number;
  text: string;
}

export function CallTranscript({
  callLogId,
  /** Poll while processing — enable right after a call ends. */
  poll = false,
}: {
  callLogId: string;
  poll?: boolean;
}) {
  const fetchTranscript = useServerFn(getTranscript);
  const { data, isLoading } = useQuery({
    queryKey: ["transcript", callLogId],
    queryFn: () => fetchTranscript({ data: { call_log_id: callLogId } }),
    refetchInterval: (q) => {
      if (!poll) return false;
      const status = (q.state.data as { status?: string } | null | undefined)?.status;
      // Keep polling until the transcript is terminal.
      return status === "completed" || status === "failed" ? false : 4000;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading transcript…</p>;
  }
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        {poll ? "Transcribing…" : "No transcript for this call."}
      </p>
    );
  }
  if (data.status === "processing" || data.status === "pending") {
    return <p className="text-sm text-muted-foreground animate-pulse">Transcribing…</p>;
  }
  if (data.status === "failed") {
    return <p className="text-sm text-destructive">Transcription failed.</p>;
  }

  const segments = (data.segments as Segment[] | null) ?? [];
  if (segments.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {data.text || "Transcript is empty."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {segments.map((seg, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground pt-0.5">
            {formatDuration(Math.floor(seg.start))}
          </span>
          <span className="leading-relaxed">{seg.text}</span>
        </div>
      ))}
    </div>
  );
}
