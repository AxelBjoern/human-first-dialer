import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { listStaff, grantStaff, revokeStaff } from "@/lib/platform.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  component: () => <AdminShell><Staff /></AdminShell>,
});

function Staff() {
  const qc = useQueryClient();
  const listFn = useServerFn(listStaff);
  const grantFn = useServerFn(grantStaff);
  const revokeFn = useServerFn(revokeStaff);
  const { data } = useQuery({ queryKey: ["platform-staff"], queryFn: () => listFn() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"superadmin" | "staff" | "billing" | "support">("support");

  const add = async () => {
    try {
      await grantFn({ data: { email, role } });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["platform-staff"] });
      toast.success("Granted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const remove = async (uid: string) => {
    try {
      await revokeFn({ data: { user_id: uid } });
      qc.invalidateQueries({ queryKey: ["platform-staff"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-semibold">Platform staff</h1>
        <p className="text-sm text-muted-foreground">Who at VDNX can access this admin panel.</p>
      </div>

      <div className="rounded-lg border bg-card p-4 flex gap-2 items-end">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Email (must already be signed up)</div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@vdnx.com" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Role</div>
          <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="superadmin">Superadmin</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="support">Support</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={!email}><Plus className="h-4 w-4 mr-1" /> Grant</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Since</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((s) => {
              const p = (s as { profile?: { email?: string; first_name?: string; last_name?: string } | null }).profile;
              return (
                <TableRow key={s.user_id}>
                  <TableCell>{p?.email ?? s.user_id}</TableCell>
                  <TableCell>{[p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{s.role}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => remove(s.user_id)}>
                      <Trash2 className="h-4 w-4" />
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
