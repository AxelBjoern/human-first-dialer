import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCallEngine } from "@/lib/call-engine";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients · VDNX Dialer" }] }),
  component: ClientsPage,
});

interface ClientForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  investment_status: string;
  notes: string;
}

const empty: ClientForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  city: "",
  country: "NO",
  investment_status: "",
  notes: "",
};

function ClientsPage() {
  const engine = useCallEngine();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(empty);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (input: ClientForm) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("clients").insert({
        ...input,
        owner_id: u.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client added");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (clients ?? []).filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (c.first_name ?? "").toLowerCase().includes(s) ||
      (c.last_name ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.city ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients?.length ?? 0} total · click the phone to dial
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New client</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First name</Label>
                  <Input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Last name</Label>
                  <Input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone (E.164)</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+47..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Investment status</Label>
                <Input
                  value={form.investment_status}
                  onChange={(e) => setForm({ ...form, investment_status: e.target.value })}
                  placeholder="lead / qualified / customer ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, phone, city..."
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No clients yet.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  {c.email && (
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{c.phone ?? "—"}</TableCell>
                <TableCell>{c.city ?? "—"}</TableCell>
                <TableCell>
                  {c.investment_status ? (
                    <Badge variant="secondary">{c.investment_status}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    disabled={!c.phone}
                    onClick={() => c.phone && engine.dial(c.phone, c.id)}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
