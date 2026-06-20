import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Phone, PhoneIncoming, PhoneOutgoing, Voicemail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallTranscript } from "@/components/call-transcript";
import { getVoicemailUrl } from "@/lib/voicemail.functions";
import { useCallEngine, formatDuration } from "@/lib/call-engine";
import { useCurrentOrg } from "@/lib/current-org";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Call history · VDNX Dialer" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const engine = useCallEngine();
  const { currentOrgId } = useCurrentOrg();
  const [transcriptFor, setTranscriptFor] = useState<{ id: string; phone: string } | null>(null);
  const fetchVoicemail = useServerFn(getVoicemailUrl);

  const playVoicemail = async (callLogId: string) => {
    try {
      const res = await fetchVoicemail({ data: { call_log_id: callLogId } });
      if (res?.url) new Audio(res.url).play().catch(() => {});
      else toast.error("Voicemail not available");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load voicemail");
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["call_logs", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select(
          "id,direction,phone_e164,started_at,duration_s,outcome_code,notes,voicemail_url,client:clients(first_name,last_name),outcome:call_outcomes(label,color)",
        )
        .eq("organization_id", currentOrgId!)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Call history</h1>
        <p className="text-sm text-muted-foreground">Your last 200 calls</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>When</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No calls yet.
                </TableCell>
              </TableRow>
            )}
            {data?.map((row) => {
              const client = (
                row as { client?: { first_name?: string; last_name?: string } | null }
              ).client;
              const outcome = (row as { outcome?: { label?: string; color?: string } | null })
                .outcome;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.direction === "outbound" ? (
                      <PhoneOutgoing className="h-4 w-4 text-primary" />
                    ) : (
                      <PhoneIncoming className="h-4 w-4 text-accent" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(row.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.phone_e164}</TableCell>
                  <TableCell>
                    {client ? [client.first_name, client.last_name].filter(Boolean).join(" ") : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.duration_s != null ? formatDuration(row.duration_s) : "—"}
                  </TableCell>
                  <TableCell>
                    {outcome?.label ? (
                      <Badge
                        variant="secondary"
                        style={
                          outcome.color
                            ? { backgroundColor: outcome.color + "22", color: outcome.color }
                            : undefined
                        }
                      >
                        {outcome.label}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(row as { voicemail_url?: string | null }).voicemail_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Play voicemail narration"
                          onClick={() => playVoicemail(row.id)}
                        >
                          <Voicemail className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        title="View transcript"
                        onClick={() => setTranscriptFor({ id: row.id, phone: row.phone_e164 })}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => engine.dial(row.phone_e164)}>
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!transcriptFor} onOpenChange={(o) => !o && setTranscriptFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transcript</DialogTitle>
            <DialogDescription>{transcriptFor?.phone}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {transcriptFor && <CallTranscript callLogId={transcriptFor.id} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
