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
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallEngine, formatDuration } from "@/lib/call-engine";
import { useCurrentOrg } from "@/lib/current-org";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Call history · VDNX Dialer" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const engine = useCallEngine();
  const { currentOrgId } = useCurrentOrg();
  const { data, isLoading } = useQuery({
    queryKey: ["call_logs", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select(
          "id,direction,phone_e164,started_at,duration_s,outcome_code,notes,client:clients(first_name,last_name),outcome:call_outcomes(label,color)",
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
              const client = (row as { client?: { first_name?: string; last_name?: string } | null }).client;
              const outcome = (row as { outcome?: { label?: string; color?: string } | null }).outcome;
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
                    {client
                      ? [client.first_name, client.last_name].filter(Boolean).join(" ")
                      : "—"}
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => engine.dial(row.phone_e164)}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
