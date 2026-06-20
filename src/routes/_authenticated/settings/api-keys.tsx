import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { createApiKey, revokeApiKey } from "@/lib/admin.functions";
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

export const Route = createFileRoute("/_authenticated/settings/api-keys")({
  head: () => ({ meta: [{ title: "API keys · VDNX Dialer" }] }),
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { currentOrgId, memberships } = useCurrentOrg();
  const qc = useQueryClient();
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const current = memberships.find((m) => m.organization_id === currentOrgId);
  const canAdmin = current && (current.role === "owner" || current.role === "admin");

  const { data: keys } = useQuery({
    queryKey: ["org_api_keys", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_api_keys")
        .select("id, name, key_prefix, scopes, created_at, last_used_at, revoked_at")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleCreate = async () => {
    if (!currentOrgId || !name.trim()) return;
    try {
      const res = await create({ data: { organization_id: currentOrgId, name: name.trim() } });
      setNewKey(res.plain);
      setName("");
      qc.invalidateQueries({ queryKey: ["org_api_keys"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revoke({ data: { id } });
      qc.invalidateQueries({ queryKey: ["org_api_keys"] });
      toast.success("Revoked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">API keys</h1>
          <p className="text-sm text-muted-foreground">
            Use these to authenticate external apps (VDNX, Energy, Executive) against this workspace
            via REST and MCP.
          </p>
        </div>
        {canAdmin && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setNewKey(null);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> New key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newKey ? "Copy your key" : "New API key"}</DialogTitle>
              </DialogHeader>
              {!newKey ? (
                <div className="space-y-3">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VDNX production"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    This is the only time you'll see this key. Store it securely.
                  </p>
                  <div className="rounded border bg-muted/50 p-3 flex items-center gap-2">
                    <code className="flex-1 break-all text-xs">{newKey}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(newKey);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <DialogFooter>
                {!newKey ? (
                  <>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate}>Generate</Button>
                  </>
                ) : (
                  <Button
                    onClick={() => {
                      setOpen(false);
                      setNewKey(null);
                    }}
                  >
                    Done
                  </Button>
                )}
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
              <TableHead>Prefix</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(keys ?? []).map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell className="font-mono text-xs">vdnx_{k.key_prefix}_…</TableCell>
                <TableCell className="text-xs">{(k.scopes ?? []).join(", ")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                </TableCell>
                <TableCell>
                  {k.revoked_at ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Badge>Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!k.revoked_at && canAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(keys ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No API keys yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
