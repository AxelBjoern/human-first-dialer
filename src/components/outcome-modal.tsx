import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActiveCall } from "@/lib/call-engine";
import { useCurrentOrg } from "@/lib/current-org";
import { CallTranscript } from "@/components/call-transcript";
import { VoicemailNarration } from "@/components/voicemail-narration";

// Outcomes that mean the call was not picked up — eligible for a voicemail clip.
const NOT_ANSWERED = new Set(["no_answer", "busy", "voicemail"]);

export function OutcomeModal({
  open,
  onOpenChange,
  call,
  durationS,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  call: ActiveCall | null;
  durationS: number;
}) {
  const qc = useQueryClient();
  const { currentOrgId } = useCurrentOrg();
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedLogId, setSavedLogId] = useState<string | null>(null);

  const { data: outcomes } = useQuery({
    queryKey: ["call_outcomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_outcomes")
        .select("code,label,color,sort")
        .order("sort");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (open) {
      setOutcome("");
      setNotes("");
      setFollowUp("");
      setSavedLogId(null);
    }
  }, [open]);

  const save = async () => {
    if (!call) return onOpenChange(false);
    if (!currentOrgId) return toast.error("No workspace selected");
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const startedAt = new Date(call.startedAt).toISOString();
      const endedAt = new Date(call.endedAt ?? Date.now()).toISOString();
      const answered = !!outcome && !NOT_ANSWERED.has(outcome);

      const { data: insertedLog, error: logErr } = await supabase
        .from("call_logs")
        .insert({
          organization_id: currentOrgId,
          agent_id: uid,
          client_id: call.clientId ?? null,
          direction: "outbound",
          caller_type: "human",
          provider: call.provider ?? null,
          external_call_id: call.externalCallId ?? null,
          phone_e164: call.phone,
          started_at: startedAt,
          ended_at: endedAt,
          duration_s: durationS,
          talk_time_s: answered ? durationS : 0,
          answered,
          outcome_code: outcome || null,
          notes: notes || null,
          follow_up_at: followUp ? new Date(followUp).toISOString() : null,
        })
        .select("id")
        .single();
      if (logErr) throw logErr;

      if (followUp) {
        const { error: remErr } = await supabase.from("call_reminders").insert({
          organization_id: currentOrgId,
          agent_id: uid,
          client_id: call.clientId ?? null,
          call_time: new Date(followUp).toISOString(),
          note: notes || `Follow up: ${call.phone}`,
        });
        if (remErr) throw remErr;
      }

      qc.invalidateQueries({ queryKey: ["call_logs"] });
      qc.invalidateQueries({ queryKey: ["call_reminders"] });
      toast.success("Call logged");

      // Keep the dialog open for a post-call step when there's something to show:
      //  - real provider calls get a near-live transcript (recording via webhook)
      //  - missed/declined calls with notes can generate a voicemail narration
      const wantsVoicemail = NOT_ANSWERED.has(outcome) && !!notes.trim();
      if (insertedLog?.id && (call.externalCallId || wantsVoicemail)) {
        setSavedLogId(insertedLog.id);
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log call outcome</DialogTitle>
          <DialogDescription>
            {call?.phone} · {Math.floor(durationS / 60)}m {durationS % 60}s
          </DialogDescription>
        </DialogHeader>

        {savedLogId ? (
          <div className="space-y-4">
            {NOT_ANSWERED.has(outcome) && notes.trim() && currentOrgId && (
              <VoicemailNarration
                organizationId={currentOrgId}
                callLogId={savedLogId}
                notes={notes}
              />
            )}
            {call?.externalCallId && (
              <div className="space-y-2">
                <Label>Transcript</Label>
                <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border bg-background/50 p-3">
                  <CallTranscript callLogId={savedLogId} poll />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {outcomes?.map((o) => (
                    <SelectItem key={o.code} value={o.code}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was discussed?"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Follow up (optional)</Label>
              <Input
                type="datetime-local"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {savedLogId ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Skip
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save log"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
