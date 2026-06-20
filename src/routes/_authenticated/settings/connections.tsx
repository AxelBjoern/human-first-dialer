import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { syncConnection } from "@/lib/connections.functions";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings/connections")({
  head: () => ({ meta: [{ title: "Connections · VDNX Dialer" }] }),
  component: ConnectionsPage,
});

const SOURCE_PRESETS: Record<string, string> = {
  vdnx: "VDNX",
  energy: "Energy system",
  executive: "VDNX Executive Command",
};

function ConnectionsPage() {
  const { currentOrgId, memberships } = useCurrentOrg();
  const qc = useQueryClient();
  const sync = useServerFn(syncConnection);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    source_app: "vdnx" as "vdnx" | "energy" | "executive",
    name: "",
    base_url: "",
    token: "",
    webhook_secret: "",
  });

  const current = memberships.find((m) => m.organization_id === currentOrgId);
  const canAdmin = current && (current.role === "owner" || current.role === "admin");

  const { data: conns } = useQuery({
    queryKey: ["org_connections", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_connections")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!currentOrgId) throw new Error("No workspace");
      const { error } = await supabase.from("org_connections").insert({
        organization_id: currentOrgId,
        source_app: form.source_app,
        name: form.name || SOURCE_PRESETS[form.source_app],
        base_url: form.base_url,
        token: form.token,
        webhook_secret: form.webhook_secret || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org_connections"] });
      setOpen(false);
      setForm({ source_app: "vdnx", name: "", base_url: "", token: "", webhook_secret: "" });
      toast.success("Connection added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org_connections"] }),
  });

  const runSync = async (id: string) => {
    try {
      const res = await sync({ data: { connection_id: id } });
      if (res.error) toast.error(`Synced with errors: ${res.error}`);
      else toast.success(`Imported ${res.imported} client(s)`);
      qc.invalidateQueries({ queryKey: ["org_connections"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Connections</h1>
          <p className="text-sm text-muted-foreground">
            Pull leads and clients from your source apps. The dialer also receives real-time pushes
            when you configure webhooks on the remote side.
          </p>
        </div>
        {canAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add connection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New connection</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Source app</Label>
                  <Select
                    value={form.source_app}
                    onValueChange={(v) =>
                      setForm({ ...form, source_app: v as typeof form.source_app })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vdnx">VDNX</SelectItem>
                      <SelectItem value="energy">Energy system</SelectItem>
                      <SelectItem value="executive">VDNX Executive Command</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Connection name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={SOURCE_PRESETS[form.source_app]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Base URL</Label>
                  <Input
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    placeholder="https://your-vdnx.lovable.app"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>API token (Bearer)</Label>
                  <Input
                    type="password"
                    value={form.token}
                    onChange={(e) => setForm({ ...form, token: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Webhook signing secret (optional)</Label>
                  <Input
                    type="password"
                    value={form.webhook_secret}
                    onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
                    placeholder="If the remote pushes to us, use HMAC-SHA256 with this secret"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={create.isPending || !form.base_url || !form.token}
                >
                  {create.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last sync</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(conns ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.name}
                  <div className="text-xs text-muted-foreground truncate max-w-xs">
                    {c.base_url}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{c.source_app}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "never"}
                </TableCell>
                <TableCell>
                  {!c.enabled ? (
                    <Badge variant="outline">Disabled</Badge>
                  ) : c.last_sync_status === "error" ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : c.last_sync_status === "ok" ? (
                    <Badge>OK</Badge>
                  ) : (
                    <Badge variant="secondary">Idle</Badge>
                  )}
                  {c.last_sync_error && (
                    <div className="text-xs text-destructive mt-1 truncate max-w-xs">
                      {c.last_sync_error}
                    </div>
                  )}
                </TableCell>
                <TableCell className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => runSync(c.id)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  {canAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(conns ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No connections yet. Add one to start syncing.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
