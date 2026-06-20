-- Cache for ElevenLabs-generated audio (call cues, scripted prompts, voicemail
-- narration). Generation is "create if missing": we hash the text and reuse the
-- stored object instead of re-synthesizing. Audio bytes live in the private
-- voice-cues Storage bucket; this table is the index.

-- Private bucket for all generated audio. Objects keyed by org id as the first
-- path segment (e.g. <org_id>/cue/answered.mp3, <org_id>/voicemail/<log>.mp3).
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-cues', 'voice-cues', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.voice_cue_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cue_key text NOT NULL,
  storage_path text NOT NULL,
  text_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.voice_cue_cache (organization_id);
-- One cached object per (org, cue, text) — lets us upsert/lookup idempotently.
CREATE UNIQUE INDEX voice_cue_cache_org_cue_hash_idx
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

-- Storage RLS: org members may read objects in the voice-cues bucket whose first
-- path segment is an org they belong to. Writes go through the service role
-- (server functions), which bypasses RLS.
CREATE POLICY "org members read voice-cues objects" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-cues'
    AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
