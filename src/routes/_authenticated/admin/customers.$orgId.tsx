import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getCustomer, listPlans, setCustomerPlan, setCustomerStatus } from "@/lib/platform.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/customers/$orgId")({
  component: () => <AdminShell><CustomerDetail /></AdminShell>,
});

function CustomerDetail() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getCustomer);
  const plansFn = useServerFn(listPlans);
  const setPlanFn = useServerFn(setCustomerPlan);
  const setStatusFn = useServerFn(setCustomerStatus);

  const { data } = useQuery({
    queryKey: ["platform-customer", orgId],
    queryFn: () => getFn({ data: { organization_id: orgId } }),
  });
  const { data: plans } = useQuery({ queryKey: ["platform-plans"], queryFn: () => plansFn() });

  const [planId, setPlanId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  if (!data) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const sub = data.subscription;

  const savePlan = async () => {
    await setPlanFn({ data: { organization_id: orgId, plan_id: planId || null } });
    qc.invalidateQueries({ queryKey: ["platform-customer", orgId] });
    toast.success("Plan updated");
  };
  const saveStatus = async () => {
    if (!status) return;
    await setStatusFn({ data: { organization_id: orgId, status: status as "trialing" | "active" | "past_due" | "canceled" | "suspended" } });
    qc.invalidateQueries({ queryKey: ["platform-customer", orgId] });
    toast.success("Status updated");
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link
        to="/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Customers
      </Link>
      <div>
        <h1 className="font-display text-2xl font-semibold">{data.org.name}</h1>
        <p className="text-sm text-muted-foreground">
          {data.org.slug}
          {data.org.source_app ? ` · ${data.org.source_app}` : ""}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Subscription</div>
          {sub ? (
            <>
              <div className="text-sm">
                Status: <Badge>{sub.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(sub.current_period_start).toLocaleDateString()} →{" "}
                {new Date(sub.current_period_end).toLocaleDateString()}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No subscription yet.</div>
          )}
          <div className="flex gap-2 items-end pt-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">Plan</div>
              <Select value={planId || sub?.plan_id || ""} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Choose plan" /></SelectTrigger>
                <SelectContent>
                  {(plans ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={savePlan} disabled={!planId}>Save</Button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Change status" /></SelectTrigger>
                <SelectContent>
                  {["trialing", "active", "past_due", "canceled", "suspended"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" onClick={saveStatus} disabled={!status}>Apply</Button>
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">Usage (this period)</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Cell label="Calls" v={data.usage?.calls_count ?? 0} />
            <Cell label="AI min" v={Number(data.usage?.ai_minutes ?? 0).toFixed(1)} />
            <Cell label="Tx min" v={Number(data.usage?.transcription_minutes ?? 0).toFixed(1)} />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Members ({data.members.length})</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.map((m) => {
              const p = (m as { profile?: { email?: string; first_name?: string; last_name?: string } | null }).profile;
              return (
                <TableRow key={m.id}>
                  <TableCell>{p?.email ?? "—"}</TableCell>
                  <TableCell>{[p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{m.role}</Badge></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">API keys</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.api_keys.map((k) => (
              <TableRow key={k.id}>
                <TableCell>{k.name}</TableCell>
                <TableCell className="font-mono text-xs">vdnx_{k.key_prefix}_…</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                </TableCell>
                <TableCell>
                  {k.revoked_at ? <Badge variant="destructive">revoked</Badge> : <Badge>active</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Cell({ label, v }: { label: string; v: number | string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-semibold">{v}</div>
    </div>
  );
}
