import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Headphones, Radio, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { startMonitor, endMonitor } from "@/lib/telephony.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/supervisor")({
  head: () => ({ meta: [{ title: "Supervisor · VDNX Dialer" }] }),
  component: SupervisorPage,
});

const LIVE = ["queued", "dialing", "ringing", "active"] as const;

function SupervisorPage() {
  const { currentOrgId, memberships } = useCurrentOrg();
  const current = memberships.find((m) => m.organization_id === currentOrgId);
  const canSupervise = current && ["owner", "admin", "team_lead"].includes(current.role);
  const monitor = useServerFn(startMonitor);
  const stop = useServerFn(endMonitor);
  const [active, setActive] = useState<Record<string, string>>({}); // session_id -> monitor_id

  const { data: sessions } = useQuery({
    queryKey: ["live_sessions", currentOrgId],
    enabled: !!currentOrgId && !!canSupervise,
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_sessions")
        .select("id, agent_id, caller_type, phone_e164, state, started_at")
        .eq("organization_id", currentOrgId!)
        .in("state", LIVE)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members_names", currentOrgId],
    enabled: !!currentOrgId && !!canSupervise,
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
    if (!agentId) return "AI agent";
    const m = members?.find((x) => x.user_id === agentId);
    const p = m?.profiles;
    if (!p) return agentId.slice(0, 8);
    return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || agentId.slice(0, 8);
  };

  const listen = async (sessionId: string) => {
    try {
      const res = await monitor({ data: { session_id: sessionId, mode: "listen" } });
      setActive((a) => ({ ...a, [sessionId]: res.monitor_id }));
      toast.success("Listening in");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot co-listen");
    }
  };

  const stopListen = async (sessionId: string) => {
    const monitorId = active[sessionId];
    if (!monitorId) return;
    try {
      await stop({ data: { monitor_id: monitorId } });
    } catch {
      /* ignore */
    }
    setActive((a) => {
      const next = { ...a };
      delete next[sessionId];
      return next;
    });
  };

  if (!canSupervise) {
    return (
      <div className="p-6 text-muted-foreground">
        Supervisor tools are available to team leaders, admins and owners.
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Headphones className="h-5 w-5" /> Supervisor
        </h1>
        <p className="text-sm text-muted-foreground">
          Live calls for the agents you supervise. Co-listen (listen / whisper / barge) is a Telavox
          PBX capability — listen-in is shown here.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sessions ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{nameFor(s.agent_id)}</TableCell>
                <TableCell>
                  <Badge variant={s.caller_type === "ai" ? "secondary" : "outline"}>
                    {s.caller_type}
                  </Badge>
                </TableCell>
                <TableCell>{s.phone_e164}</TableCell>
                <TableCell>
                  <Badge className="capitalize">
                    <Radio className="mr-1 h-3 w-3" />
                    {s.state}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end">
                  {active[s.id] ? (
                    <Button size="sm" variant="destructive" onClick={() => stopListen(s.id)}>
                      <Square className="mr-1 h-3.5 w-3.5" /> Stop
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => listen(s.id)}>
                      <Headphones className="mr-1 h-3.5 w-3.5" /> Listen
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(sessions ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No live calls right now.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
