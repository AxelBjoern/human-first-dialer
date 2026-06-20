import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Archive } from "lucide-react";
import { listPlans, upsertPlan, archivePlan } from "@/lib/platform.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  component: Plans,
});

const empty = {
  code: "",
  name: "",
  price_cents: 0,
  currency: "EUR",
  monthly_call_quota: null as number | null,
  monthly_ai_minute_quota: null as number | null,
  seat_quota: null as number | null,
  active: true,
};

function Plans() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlans);
  const saveFn = useServerFn(upsertPlan);
  const archiveFn = useServerFn(archivePlan);
  const { data } = useQuery({ queryKey: ["platform-plans"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const save = async () => {
    try {
      await saveFn({ data: form });
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
      setOpen(false);
      setForm(empty);
      toast.success("Plan saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Plans</h1>
          <p className="text-sm text-muted-foreground">Internal billing plans &amp; quotas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New plan</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="starter" /></Field>
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Starter" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (cents)"><Input type="number" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })} /></Field>
                <Field label="Currency"><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Call quota"><Input type="number" value={form.monthly_call_quota ?? ""} onChange={(e) => setForm({ ...form, monthly_call_quota: e.target.value ? Number(e.target.value) : null })} placeholder="∞" /></Field>
                <Field label="AI min quota"><Input type="number" value={form.monthly_ai_minute_quota ?? ""} onChange={(e) => setForm({ ...form, monthly_ai_minute_quota: e.target.value ? Number(e.target.value) : null })} placeholder="∞" /></Field>
                <Field label="Seats"><Input type="number" value={form.seat_quota ?? ""} onChange={(e) => setForm({ ...form, seat_quota: e.target.value ? Number(e.target.value) : null })} placeholder="∞" /></Field>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>AI min</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{(p.price_cents / 100).toLocaleString(undefined, { style: "currency", currency: p.currency })}</TableCell>
                <TableCell>{p.monthly_call_quota ?? "∞"}</TableCell>
                <TableCell>{p.monthly_ai_minute_quota ?? "∞"}</TableCell>
                <TableCell>{p.seat_quota ?? "∞"}</TableCell>
                <TableCell>{p.active ? <Badge>active</Badge> : <Badge variant="secondary">archived</Badge>}</TableCell>
                <TableCell>
                  {p.active && (
                    <Button size="sm" variant="ghost" onClick={async () => { await archiveFn({ data: { id: p.id } }); qc.invalidateQueries({ queryKey: ["platform-plans"] }); }}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No plans yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
