import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Plus, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { enqueueAiCall, cancelAiCall } from "@/lib/ai-calls.functions";
import { transcribeCall } from "@/lib/transcription.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({ meta: [{ title: "AI Campaigns · VDNX Dialer" }] }),
  component: CampaignsPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  pending: "secondary",
  queued: "secondary",
  in_progress: "secondary",
  failed: "destructive",
  canceled: "outline",
};

function CampaignsPage() {
  const { currentOrgId } = useCurrentOrg();
  const qc = useQueryClient();
  const enqueue = useServerFn(enqueueAiCall);
  const cancel = useServerFn(cancelAiCall);
  const transcribe = useServerFn(transcribeCall);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone_e164: "", prompt: "" });

  const { data: jobs } = useQuery({
    queryKey: ["ai_call_jobs", currentOrgId],
    enabled: !!currentOrgId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_call_jobs")
        .select("id, phone_e164, status, prompt, call_log_id, last_error, created_at")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const doEnqueue = async () => {
    if (!currentOrgId || !form.phone_e164.trim()) return;
    try {
      await enqueue({
        data: {
          organization_id: currentOrgId,
          phone_e164: form.phone_e164.trim(),
          prompt: form.prompt || undefined,
        },
      });
      setOpen(false);
      setForm({ phone_e164: "", prompt: "" });
      qc.invalidateQueries({ queryKey: ["ai_call_jobs"] });
      toast.success("AI call queued");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const doCancel = async (id: string) => {
    try {
      await cancel({ data: { id } });
      qc.invalidateQueries({ queryKey: ["ai_call_jobs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const doTranscribe = async (callLogId: string) => {
    try {
      await transcribe({ data: { call_log_id: callLogId } });
      toast.success("Transcript ready");
      qc.invalidateQueries({ queryKey: ["ai_call_jobs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    }
  };

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Bot className="h-5 w-5" /> AI Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Queue AI-agent calls. A worker dials via Telavox and bridges to your voice-AI provider,
            then logs the outcome. Without credentials the pipeline runs with mock/stub providers.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Queue AI call
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Queue AI call</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Phone (E.164)</Label>
                <Input
                  value={form.phone_e164}
                  placeholder="+47..."
                  onChange={(e) => setForm({ ...form, phone_e164: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prompt / script</Label>
                <Textarea
                  rows={4}
                  value={form.prompt}
                  placeholder="What should the AI agent say / accomplish?"
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={doEnqueue} disabled={!form.phone_e164.trim()}>
                Queue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Queued</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(jobs ?? []).map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-medium">{j.phone_e164}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[j.status] ?? "secondary"} className="capitalize">
                    {j.status.replace("_", " ")}
                  </Badge>
                  {j.last_error && (
                    <div className="mt-1 max-w-xs truncate text-xs text-destructive">
                      {j.last_error}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {j.prompt ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(j.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {(j.status === "pending" || j.status === "queued") && (
                    <Button size="sm" variant="ghost" onClick={() => doCancel(j.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {j.call_log_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => doTranscribe(j.call_log_id!)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(jobs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No AI calls queued yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
