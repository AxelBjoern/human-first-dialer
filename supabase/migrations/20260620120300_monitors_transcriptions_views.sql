-- ============================================================
-- Co-listen audit, on-demand transcriptions, activity + artifact
-- views, and expanded API-key scopes.
-- ============================================================

-- Co-listen / monitoring audit log -------------------------------
CREATE TABLE public.call_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  supervisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'listen',     -- 'listen' | 'whisper' | 'barge'
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.call_monitors (organization_id);
CREATE INDEX ON public.call_monitors (session_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_monitors TO authenticated;
GRANT ALL ON public.call_monitors TO service_role;
ALTER TABLE public.call_monitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read monitors" ON public.call_monitors FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
-- Only team leaders and above may start co-listen, and only as themselves.
CREATE POLICY "leaders start monitors" ON public.call_monitors FOR INSERT TO authenticated
  WITH CHECK (
    supervisor_id = auth.uid()
    AND public.has_org_role(auth.uid(), organization_id, 'team_lead')
  );
CREATE POLICY "supervisors end own monitors" ON public.call_monitors FOR UPDATE TO authenticated
  USING (supervisor_id = auth.uid() OR public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- On-demand transcriptions (text only; audio stays in Telavox) ----
CREATE TABLE public.transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  call_log_id uuid REFERENCES public.call_logs(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  status public.transcription_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'stub',
  language text,
  text text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transcriptions (organization_id);
CREATE INDEX ON public.transcriptions (call_log_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcriptions TO authenticated;
GRANT ALL ON public.transcriptions TO service_role;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read transcriptions" ON public.transcriptions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert transcriptions" ON public.transcriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update transcriptions" ON public.transcriptions FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins delete transcriptions" ON public.transcriptions FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER set_updated_at_transcriptions BEFORE UPDATE ON public.transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agent activity rollup view (security_invoker => underlying RLS applies) --
CREATE VIEW public.agent_activity_view
WITH (security_invoker = true) AS
SELECT
  cl.organization_id,
  cl.agent_id,
  (cl.started_at AT TIME ZONE 'UTC')::date AS day,
  cl.caller_type,
  count(*)::int AS calls,
  count(*) FILTER (WHERE cl.answered)::int AS answered_calls,
  count(*) FILTER (WHERE NOT cl.answered)::int AS missed_calls,
  COALESCE(sum(cl.talk_time_s), 0)::int AS total_talk_time_s,
  COALESCE(avg(cl.talk_time_s) FILTER (WHERE cl.answered), 0)::int AS avg_talk_time_s
FROM public.call_logs cl
GROUP BY cl.organization_id, cl.agent_id, (cl.started_at AT TIME ZONE 'UTC')::date, cl.caller_type;
GRANT SELECT ON public.agent_activity_view TO authenticated, service_role;

-- Call artifact view: call + recording link + latest transcript -----------
CREATE VIEW public.call_artifact_view
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
  t.status AS transcript_status
FROM public.call_logs cl
LEFT JOIN LATERAL (
  SELECT tr.text, tr.status
  FROM public.transcriptions tr
  WHERE tr.call_log_id = cl.id
  ORDER BY tr.created_at DESC
  LIMIT 1
) t ON true;
GRANT SELECT ON public.call_artifact_view TO authenticated, service_role;

-- Expand default API-key scopes (existing keys unaffected) -----------------
ALTER TABLE public.org_api_keys
  ALTER COLUMN scopes SET DEFAULT ARRAY[
    'clients:read','clients:write',
    'calls:write','calls:initiate','calls:read',
    'reminders:read','reminders:write',
    'activity:read'
  ]::text[];
