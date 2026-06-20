import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { createTeam, assignMember, setTeamLead } from "@/lib/teams.functions";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings/teams")({
  head: () => ({ meta: [{ title: "Teams · VDNX Dialer" }] }),
  component: TeamsPage,
});

const NONE = "__none__";

function nameOf(p?: { first_name: string | null; last_name: string | null; email: string | null }) {
  if (!p) return "—";
  const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return n || p.email || "—";
}

function TeamsPage() {
  const { currentOrgId, memberships } = useCurrentOrg();
  const qc = useQueryClient();
  const current = memberships.find((m) => m.organization_id === currentOrgId);
  const canAdmin = current && (current.role === "owner" || current.role === "admin");
  const create = useServerFn(createTeam);
  const assign = useServerFn(assignMember);
  const setLead = useServerFn(setTeamLead);
  const [newTeam, setNewTeam] = useState("");

  const { data: teams } = useQuery({
    queryKey: ["teams", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, lead_user_id")
        .eq("organization_id", currentOrgId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["org_members_full", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("user_id, role, team_id, profiles(id, first_name, last_name, email)")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data as unknown as Array<{
        user_id: string;
        role: string;
        team_id: string | null;
        profiles: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        } | null;
      }>;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["org_members_full"] });
  };

  const doCreate = async () => {
    if (!currentOrgId || !newTeam.trim()) return;
    try {
      await create({ data: { organization_id: currentOrgId, name: newTeam.trim() } });
      setNewTeam("");
      refresh();
      toast.success("Team created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const doAssign = async (userId: string, teamId: string) => {
    if (!currentOrgId) return;
    try {
      await assign({
        data: {
          organization_id: currentOrgId,
          user_id: userId,
          team_id: teamId === NONE ? null : teamId,
        },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const doSetLead = async (teamId: string, leadUserId: string) => {
    try {
      await setLead({
        data: { team_id: teamId, lead_user_id: leadUserId === NONE ? null : leadUserId },
      });
      refresh();
      toast.success("Team lead updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (!canAdmin) {
    return <div className="p-6 text-muted-foreground">Only admins can manage teams.</div>;
  }

  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Users className="h-5 w-5" /> Teams
        </h1>
        <p className="text-sm text-muted-foreground">
          Group agents into teams and assign a team leader. Leaders see their team's live activity
          and can co-listen; admins and owners see the whole org.
        </p>
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label>New team</Label>
          <Input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="Team name"
          />
        </div>
        <Button onClick={doCreate} disabled={!newTeam.trim()}>
          <Plus className="mr-2 h-4 w-4" /> Create
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 font-medium">Teams &amp; leaders</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Members</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(teams ?? []).map((t) => {
              const teamMembers = (members ?? []).filter((m) => m.team_id === t.id);
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Select
                      value={t.lead_user_id ?? NONE}
                      onValueChange={(v) => doSetLead(t.id, v)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No lead</SelectItem>
                        {(members ?? []).map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {nameOf(m.profiles ?? undefined)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {teamMembers.length}
                  </TableCell>
                </TableRow>
              );
            })}
            {(teams ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  No teams yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 font-medium">Members</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members ?? []).map((m) => (
              <TableRow key={m.user_id}>
                <TableCell>{nameOf(m.profiles ?? undefined)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {m.role.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select value={m.team_id ?? NONE} onValueChange={(v) => doAssign(m.user_id, v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No team</SelectItem>
                      {(teams ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
