import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { createInvite } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings/organization")({
  head: () => ({ meta: [{ title: "Workspace · VDNX Dialer" }] }),
  component: OrgSettings,
});

function OrgSettings() {
  const { currentOrgId, memberships, refresh } = useCurrentOrg();
  const qc = useQueryClient();
  const invite = useServerFn(createInvite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "agent">("agent");
  const [lastCode, setLastCode] = useState<string | null>(null);

  const current = memberships.find((m) => m.organization_id === currentOrgId);
  const canAdmin = current && (current.role === "owner" || current.role === "admin");

  const { data: members } = useQuery({
    queryKey: ["org_members", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("id, role, user_id, created_at, profile:profiles(email, first_name, last_name)")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["org_invites", currentOrgId],
    enabled: !!currentOrgId && !!canAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_invites")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const send = async () => {
    if (!currentOrgId) return;
    try {
      const res = await invite({
        data: { organization_id: currentOrgId, email: email || undefined, role },
      });
      setLastCode(res.code);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["org_invites"] });
      toast.success("Invite created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const inviteLink = (code: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${code}`;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Workspace</h1>
        <p className="text-sm text-muted-foreground">
          {current?.organizations.name} · your role:{" "}
          <span className="capitalize">{current?.role}</span>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members
        </h2>
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((m) => {
                const p = (
                  m as {
                    profile?: { email?: string; first_name?: string; last_name?: string } | null;
                  }
                ).profile;
                return (
                  <TableRow key={m.id}>
                    <TableCell>{p?.email ?? "—"}</TableCell>
                    <TableCell>
                      {[p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {canAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Invite members
          </h2>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Email (optional)</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={send}>Create invite</Button>
            </div>
            {lastCode && (
              <div className="rounded border bg-muted/50 p-3 text-sm">
                <div className="font-medium mb-1">Share this link:</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all">{inviteLink(lastCode)}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink(lastCode));
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invites ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.code}</TableCell>
                    <TableCell>{i.email ?? "—"}</TableCell>
                    <TableCell className="capitalize">{i.role}</TableCell>
                    <TableCell>
                      {i.accepted_at ? (
                        <Badge>Accepted</Badge>
                      ) : new Date(i.expires_at) < new Date() ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
