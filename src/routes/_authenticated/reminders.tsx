import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCallEngine } from "@/lib/call-engine";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders · VDNX Dialer" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const engine = useCallEngine();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["call_reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_reminders")
        .select("id,call_time,note,done,client:clients(id,first_name,last_name,phone)")
        .eq("done", false)
        .order("call_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("call_reminders").update({ done: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder cleared");
      qc.invalidateQueries({ queryKey: ["call_reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reminders</h1>
        <p className="text-sm text-muted-foreground">Pending callbacks</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-32"></TableHead>
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
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No pending reminders.
                </TableCell>
              </TableRow>
            )}
            {data?.map((r) => {
              const client = (r as {
                client?: { id?: string; first_name?: string; last_name?: string; phone?: string } | null;
              }).client;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    {new Date(r.call_time).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {client
                      ? [client.first_name, client.last_name].filter(Boolean).join(" ")
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{client?.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.note ?? "—"}</TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    {client?.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => engine.dial(client.phone!, client.id)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" onClick={() => markDone.mutate(r.id)}>
                      <Check className="h-4 w-4" />
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
