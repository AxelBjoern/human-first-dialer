// Generates and plays an ElevenLabs voicemail narration from a missed call's
// outcome notes. Honest copy: this is a clip for the agent to review/download —
// it is not injected into the (already-missed) phone call.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Voicemail, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateVoicemail } from "@/lib/voicemail.functions";

export function VoicemailNarration({
  organizationId,
  callLogId,
  notes,
}: {
  organizationId: string;
  callLogId: string;
  notes: string;
}) {
  const generate = useServerFn(generateVoicemail);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGenerate = async () => {
    setLoading(true);
    try {
      const res = await generate({
        data: { organization_id: organizationId, call_log_id: callLogId, notes },
      });
      setUrl(res.url);
      toast.success("Voicemail narration ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate voicemail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-background/50 p-3">
      <Label className="flex items-center gap-2">
        <Voicemail className="h-4 w-4" /> Voicemail narration
      </Label>
      {url ? (
        <div className="space-y-2">
          <audio controls src={url} className="w-full" />
          <a
            href={url}
            download="voicemail.mp3"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Download className="h-3 w-3" /> Download
          </a>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={onGenerate} disabled={loading}>
          {loading ? "Generating…" : "Generate voicemail from notes"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        A spoken version of your notes for you to review or send — it is not played into the missed
        call.
      </p>
    </div>
  );
}
