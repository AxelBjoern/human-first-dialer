import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PhoneCall, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { saveTelavoxConfig, testTelavoxConfig } from "@/lib/telephony.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings/telephony")({
  head: () => ({ meta: [{ title: "Telephony · VDNX Dialer" }] }),
  component: TelephonyPage,
});

function TelephonyPage() {
  const { currentOrgId, memberships } = useCurrentOrg();
  const qc = useQueryClient();
  const save = useServerFn(saveTelavoxConfig);
  const test = useServerFn(testTelavoxConfig);
  const current = memberships.find((m) => m.organization_id === currentOrgId);
  const canAdmin = current && (current.role === "owner" || current.role === "admin");

  const [form, setForm] = useState({
    enabled: false,
    base_url: "https://api.telavox.se",
    auth_kind: "bearer" as "bearer" | "basic",
    api_token: "",
    caller_id_e164: "",
    default_extension: "",
    extension_map: "{}",
    voice_provider: "stub",
    transcription_provider: "stub",
    webhook_secret: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: cfg } = useQuery({
    queryKey: ["telavox_config", currentOrgId],
    enabled: !!currentOrgId && !!canAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telavox_configs")
        .select(
          "enabled, base_url, auth_kind, caller_id_e164, default_extension, extension_map, voice_provider, transcription_provider, api_token, webhook_secret",
        )
        .eq("organization_id", currentOrgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!cfg) return;
    setForm((f) => ({
      ...f,
      enabled: cfg.enabled,
      base_url: cfg.base_url,
      auth_kind: (cfg.auth_kind as "bearer" | "basic") ?? "bearer",
      caller_id_e164: cfg.caller_id_e164 ?? "",
      default_extension: cfg.default_extension ?? "",
      extension_map: JSON.stringify(cfg.extension_map ?? {}, null, 2),
      voice_provider: cfg.voice_provider ?? "stub",
      transcription_provider: cfg.transcription_provider ?? "stub",
    }));
  }, [cfg]);

  const hasToken = !!cfg?.api_token;
  const hasSecret = !!cfg?.webhook_secret;

  const onSave = async () => {
    if (!currentOrgId) return;
    let extMap: Record<string, string> = {};
    try {
      extMap = JSON.parse(form.extension_map || "{}");
    } catch {
      return toast.error("Extension map is not valid JSON");
    }
    setSaving(true);
    try {
      await save({
        data: {
          organization_id: currentOrgId,
          enabled: form.enabled,
          base_url: form.base_url,
          auth_kind: form.auth_kind,
          api_token: form.api_token || undefined,
          caller_id_e164: form.caller_id_e164 || null,
          default_extension: form.default_extension || null,
          extension_map: extMap,
          voice_provider: form.voice_provider,
          transcription_provider: form.transcription_provider,
          webhook_secret: form.webhook_secret || null,
        },
      });
      setForm((f) => ({ ...f, api_token: "", webhook_secret: "" }));
      qc.invalidateQueries({ queryKey: ["telavox_config"] });
      qc.invalidateQueries({ queryKey: ["telephony-mode"] });
      toast.success("Telephony settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (!currentOrgId) return;
    setTesting(true);
    try {
      const res = await test({ data: { organization_id: currentOrgId } });
      if (res.ok) toast.success(res.message);
      else toast.warning(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (!canAdmin) {
    return <div className="p-6 text-muted-foreground">Only admins can manage telephony.</div>;
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <PhoneCall className="h-5 w-5" /> Telephony (Telavox)
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect Telavox to place real calls. Telavox has no built-in dialer — it provides the
          telephony, PBX and webhooks; this dialer is built on top. Until enabled, calls use the
          built-in mock engine.
        </p>
      </div>

      <div className="space-y-5 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Telavox</Label>
            <p className="text-xs text-muted-foreground">
              When on (and a token is set), the softphone and AI calls route through Telavox.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Base URL</Label>
            <Input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Auth kind</Label>
            <Select
              value={form.auth_kind}
              onValueChange={(v) => setForm({ ...form, auth_kind: v as "bearer" | "basic" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bearer">Bearer (JWT)</SelectItem>
                <SelectItem value="basic">Basic (user:pass)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            API token {hasToken && <span className="text-xs text-emerald-600">(set)</span>}
          </Label>
          <Input
            type="password"
            value={form.api_token}
            placeholder={hasToken ? "•••••• leave blank to keep" : "Telavox token"}
            onChange={(e) => setForm({ ...form, api_token: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Caller ID (E.164)</Label>
            <Input
              value={form.caller_id_e164}
              placeholder="+47..."
              onChange={(e) => setForm({ ...form, caller_id_e164: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default extension</Label>
            <Input
              value={form.default_extension}
              onChange={(e) => setForm({ ...form, default_extension: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Extension map (JSON: profile id → extension)</Label>
          <Textarea
            rows={4}
            className="font-mono text-xs"
            value={form.extension_map}
            onChange={(e) => setForm({ ...form, extension_map: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Voice-AI provider</Label>
            <Select
              value={form.voice_provider}
              onValueChange={(v) => setForm({ ...form, voice_provider: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stub">Stub (offline)</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Transcription provider</Label>
            <Select
              value={form.transcription_provider}
              onValueChange={(v) => setForm({ ...form, transcription_provider: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stub">Stub (offline)</SelectItem>
                <SelectItem value="whisper">Whisper</SelectItem>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Webhook secret {hasSecret && <span className="text-xs text-emerald-600">(set)</span>}
          </Label>
          <Input
            type="password"
            value={form.webhook_secret}
            placeholder={
              hasSecret ? "•••••• leave blank to keep" : "HMAC secret for Telavox webhooks"
            }
            onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Point Telavox webhooks at{" "}
            <code>/api/public/v1/webhooks/telavox?org={currentOrgId}</code>
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
          <Button variant="outline" onClick={onTest} disabled={testing}>
            <FlaskConical className="mr-2 h-4 w-4" />
            {testing ? "Testing..." : "Test connection"}
          </Button>
        </div>
      </div>
    </div>
  );
}
