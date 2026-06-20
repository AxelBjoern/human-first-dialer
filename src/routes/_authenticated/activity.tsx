import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { getAgentActivity } from "@/lib/activity.functions";
import { formatDuration } from "@/lib/call-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity · VDNX Dialer" }] }),
  component: ActivityPage,
});

type Row = {
  agent_id: string | null;
  day: string | null;
  caller_type: "human" | "ai" | null;
  calls: number | null;
  answered_calls: number | null;
  missed_calls: number | null;
  total_talk_time_s: number | null;
};

function ActivityPage() {
  const { currentOrgId } = useCurrentOrg();
  const activity = useServerFn(getAgentActivity);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);

  const { data: rows } = useQuery({
    queryKey: ["agent_activity", currentOrgId, from, to],
    enabled: !!currentOrgId,
    queryFn: () =>
      activity({
        data: {
          organization_id: currentOrgId!,
          from: from || undefined,
          to: to || undefined,
        },
      }) as Promise<Row[]>,
  });

  const { data: members } = useQuery({
    queryKey: ["members_names_activity", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("user_id, profiles(first_name, last_name, email)")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data as unknown as Array<{
        user_id: string;
        profiles: {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        } | null;
      }>;
    },
  });

  const nameFor = (agentId: string | null) => {
    if (!agentId) return "—";
    const p = members?.find((x) => x.user_id === agentId)?.profiles;
    if (!p) return agentId.slice(0, 8);
    return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || agentId.slice(0, 8);
  };

  // Aggregate per agent across the selected range.
  const perAgent = useMemo(() => {
    const map = new Map<
      string,
      { calls: number; answered: number; missed: number; talk: number; human: number; ai: number }
    >();
    for (const r of rows ?? []) {
      const key = r.agent_id ?? "unknown";
      const cur = map.get(key) ?? { calls: 0, answered: 0, missed: 0, talk: 0, human: 0, ai: 0 };
      cur.calls += r.calls ?? 0;
      cur.answered += r.answered_calls ?? 0;
      cur.missed += r.missed_calls ?? 0;
      cur.talk += r.total_talk_time_s ?? 0;
      if (r.caller_type === "ai") cur.ai += r.calls ?? 0;
      else cur.human += r.calls ?? 0;
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].calls - a[1].calls);
  }, [rows]);

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <BarChart3 className="h-5 w-5" /> Activity
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-agent call activity: calls, answered vs missed, and talk time. Team leaders see their
          team; admins and owners see the whole org.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Answered</TableHead>
              <TableHead className="text-right">Missed</TableHead>
              <TableHead className="text-right">Talk time</TableHead>
              <TableHead>Mix</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perAgent.map(([agentId, a]) => (
              <TableRow key={agentId}>
                <TableCell className="font-medium">{nameFor(agentId)}</TableCell>
                <TableCell className="text-right">{a.calls}</TableCell>
                <TableCell className="text-right text-emerald-600">{a.answered}</TableCell>
                <TableCell className="text-right text-muted-foreground">{a.missed}</TableCell>
                <TableCell className="text-right font-mono">{formatDuration(a.talk)}</TableCell>
                <TableCell className="space-x-1">
                  <Badge variant="outline">{a.human} human</Badge>
                  <Badge variant="secondary">{a.ai} AI</Badge>
                </TableCell>
              </TableRow>
            ))}
            {perAgent.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No activity in this range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
