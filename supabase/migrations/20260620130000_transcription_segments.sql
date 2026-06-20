-- Persist word/segment-level timestamps from the transcription provider.
-- The provider already returns segments[]; we just had nowhere to store them.
ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS segments jsonb;

-- Expose segments (and transcript status) through the call artifact view so the
-- history detail can render timestamped lines. Keep security_invoker so RLS on
-- the underlying tables still applies.
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
