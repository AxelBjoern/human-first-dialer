-- 1. Transcription segments + view
ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS segments jsonb;

CREATE OR REPLACE VIEW public.call_artifact_view
WITH (security_invoker = true) AS
SELECT
  cl.id,
  cl.organization_id,
  cl.agent_id,
  cl.client_id,
  cl.phone_e164,
  cl.started_at,
  cl.duration_s,
  cl.outcome_code,
  cl.caller_type,
  cl.provider,
  cl.recording_url,
  t.text AS transcript_text,
  t.status AS transcript_status,
  t.segments AS transcript_segments
FROM public.call_logs cl
LEFT JOIN LATERAL (
  SELECT tr.text, tr.status, tr.segments
  FROM public.transcriptions tr
  WHERE tr.call_log_id = cl.id
  ORDER BY tr.created_at DESC
  LIMIT 1
) t ON true;
GRANT SELECT ON public.call_artifact_view TO authenticated, service_role;

-- 2. Voicemail URL on call_logs
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS voicemail_url text;

-- 3. Voice cue cache table + storage read policy
CREATE TABLE IF NOT EXISTS public.voice_cue_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cue_key text NOT NULL,
  storage_path text NOT NULL,
  text_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_cue_cache_org_idx ON public.voice_cue_cache (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS voice_cue_cache_org_cue_hash_idx
  ON public.voice_cue_cache (organization_id, cue_key, text_hash);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_cue_cache TO authenticated;
GRANT ALL ON public.voice_cue_cache TO service_role;
ALTER TABLE public.voice_cue_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read voice cues" ON public.voice_cue_cache FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert voice cues" ON public.voice_cue_cache FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update voice cues" ON public.voice_cue_cache FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins delete voice cues" ON public.voice_cue_cache FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'));

CREATE POLICY "org members read voice-cues objects" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-cues'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
