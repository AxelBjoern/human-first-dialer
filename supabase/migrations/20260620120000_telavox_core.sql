-- ============================================================
-- Telavox telephony core: enums, per-org config, call sessions,
-- AI call jobs, and additive call_logs columns.
-- Build-to-spec: provider credentials live in telavox_configs;
-- with no enabled config the app falls back to Mock/Stub providers.
-- ============================================================

-- Enums ------------------------------------------------------
CREATE TYPE public.caller_type AS ENUM ('human', 'ai');
CREATE TYPE public.call_session_state AS ENUM ('queued', 'dialing', 'ringing', 'active', 'completed', 'failed', 'canceled');
CREATE TYPE public.ai_job_status AS ENUM ('pending', 'queued', 'in_progress', 'completed', 'failed', 'canceled');
CREATE TYPE public.transcription_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Per-org Telavox + voice/transcription configuration --------
-- One row per organization. Restricted to org admins via RLS;
-- api_token is read only by server-role code (never client bundle).
CREATE TABLE public.telavox_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  base_url text NOT NULL DEFAULT 'https://api.telavox.se',
  auth_kind text NOT NULL DEFAULT 'bearer',          -- 'bearer' | 'basic'
  api_token text,                                     -- bearer JWT OR basic "user:pass" (plaintext, admin-only row)
  caller_id_e164 text,                               -- presented number for trunk / AI calls
  default_extension text,                            -- fallback Telavox extension for click-to-dial
  extension_map jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { "<profile_uuid>": "<telavox_extension>" }
  voice_provider text NOT NULL DEFAULT 'stub',       -- 'stub' | 'elevenlabs' | 'deepseek'
  voice_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcription_provider text NOT NULL DEFAULT 'stub', -- 'stub' | 'whisper' | 'elevenlabs' | 'deepseek'
  transcription_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_secret text,                               -- HMAC secret for inbound Telavox webhooks
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.telavox_configs (organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telavox_configs TO authenticated;
GRANT ALL ON public.telavox_configs TO service_role;
ALTER TABLE public.telavox_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage telavox config" ON public.telavox_configs FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER set_updated_at_telavox_configs BEFORE UPDATE ON public.telavox_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Live call sessions (state machine over a provider call) ----
CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  caller_type public.caller_type NOT NULL DEFAULT 'human',
  agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- human initiator; null for AI
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  state public.call_session_state NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'mock',                              -- 'telavox' | 'mock'
  external_call_id text,
  from_extension text,
  recording_url text,
  recording_id text,
  error text,
  call_log_id uuid REFERENCES public.call_logs(id) ON DELETE SET NULL,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  last_polled_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.call_sessions (organization_id);
CREATE INDEX ON public.call_sessions (external_call_id);
CREATE INDEX ON public.call_sessions (organization_id, state);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_sessions TO authenticated;
GRANT ALL ON public.call_sessions TO service_role;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read sessions" ON public.call_sessions FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert sessions" ON public.call_sessions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update sessions" ON public.call_sessions FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id)
         AND (agent_id = auth.uid() OR public.has_org_role(auth.uid(), organization_id, 'admin')))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins delete sessions" ON public.call_sessions FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER set_updated_at_call_sessions BEFORE UPDATE ON public.call_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AI call job queue ------------------------------------------
CREATE TABLE public.ai_call_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  phone_e164 text NOT NULL,
  status public.ai_job_status NOT NULL DEFAULT 'pending',
  prompt text,
  voice_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 1,
  locked_at timestamptz,                                            -- claim marker for the drain worker
  session_id uuid REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  call_log_id uuid REFERENCES public.call_logs(id) ON DELETE SET NULL,
  last_error text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ai_call_jobs (organization_id);
CREATE INDEX ON public.ai_call_jobs (status, scheduled_at);
CREATE INDEX ON public.ai_call_jobs (organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_call_jobs TO authenticated;
GRANT ALL ON public.ai_call_jobs TO service_role;
ALTER TABLE public.ai_call_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read jobs" ON public.ai_call_jobs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert jobs" ON public.ai_call_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update jobs" ON public.ai_call_jobs FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins delete jobs" ON public.ai_call_jobs FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER set_updated_at_ai_call_jobs BEFORE UPDATE ON public.ai_call_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Additive call_logs columns for provider + activity capture -
ALTER TABLE public.call_logs ADD COLUMN caller_type public.caller_type NOT NULL DEFAULT 'human';
ALTER TABLE public.call_logs ADD COLUMN provider text;             -- 'telavox' | 'mock' | null (legacy)
ALTER TABLE public.call_logs ADD COLUMN ai_job_id uuid REFERENCES public.ai_call_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.call_logs ADD COLUMN ring_time_s int;           -- answered_at - started_at
ALTER TABLE public.call_logs ADD COLUMN talk_time_s int;           -- ended_at - answered_at
ALTER TABLE public.call_logs ADD COLUMN answered boolean NOT NULL DEFAULT false;
ALTER TABLE public.call_logs ADD COLUMN recording_id text;
CREATE INDEX call_logs_caller_type_idx ON public.call_logs (organization_id, caller_type, started_at DESC);
CREATE INDEX call_logs_ai_job_idx ON public.call_logs (ai_job_id);
