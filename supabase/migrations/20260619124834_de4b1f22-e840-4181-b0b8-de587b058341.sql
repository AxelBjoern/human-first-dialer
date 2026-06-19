
-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent');
CREATE TYPE public.presence_status AS ENUM ('available', 'busy', 'away', 'offline');
CREATE TYPE public.call_direction AS ENUM ('outbound', 'inbound');

-- ============================================================
-- updated_at trigger fn
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  extension text,
  default_country text NOT NULL DEFAULT 'NO',
  presence public.presence_status NOT NULL DEFAULT 'offline',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: read all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: insert own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- user_roles + has_role
-- ============================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles: read own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============================================================
-- new user trigger: profile + default agent role
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- clients (mirrors VDNX shape)
-- ============================================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  company_id uuid,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_org_number text,
  address text,
  city text,
  postal_code text,
  country text,
  investment_status text,
  notes text,
  vdnx_client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_owner_idx ON public.clients(owner_id);
CREATE INDEX clients_assigned_idx ON public.clients(assigned_to);
CREATE INDEX clients_phone_idx ON public.clients(phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: read own/assigned or staff" ON public.clients
  FOR SELECT TO authenticated USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "clients: insert own" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "clients: update own/assigned or staff" ON public.clients
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "clients: delete own or admin" ON public.clients
  FOR DELETE TO authenticated USING (
    owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- call_outcomes (lookup)
-- ============================================================
CREATE TABLE public.call_outcomes (
  code text PRIMARY KEY,
  label text NOT NULL,
  color text,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.call_outcomes TO authenticated;
GRANT ALL ON public.call_outcomes TO service_role;
ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outcomes: read authenticated" ON public.call_outcomes
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.call_outcomes (code, label, color, sort) VALUES
  ('connected',      'Connected',       '#16a34a', 10),
  ('voicemail',      'Voicemail',       '#0ea5e9', 20),
  ('no_answer',      'No answer',       '#64748b', 30),
  ('busy',           'Busy',            '#f59e0b', 40),
  ('wrong_number',   'Wrong number',    '#dc2626', 50),
  ('do_not_call',    'Do not call',     '#7f1d1d', 60),
  ('callback',       'Callback requested','#8b5cf6', 70),
  ('interested',     'Interested',      '#C9A962', 80),
  ('not_interested', 'Not interested',  '#475569', 90),
  ('deal_closed',    'Deal closed',     '#1E3A5F', 100);

-- ============================================================
-- call_logs
-- ============================================================
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  direction public.call_direction NOT NULL DEFAULT 'outbound',
  phone_e164 text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_s int,
  outcome_code text REFERENCES public.call_outcomes(code),
  notes text,
  follow_up_at timestamptz,
  recording_url text,
  external_call_id text,
  vdnx_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_logs_agent_idx ON public.call_logs(agent_id, started_at DESC);
CREATE INDEX call_logs_client_idx ON public.call_logs(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs TO authenticated;
GRANT ALL ON public.call_logs TO service_role;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_logs: read own or staff" ON public.call_logs
  FOR SELECT TO authenticated USING (
    agent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "call_logs: insert own" ON public.call_logs
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "call_logs: update own or staff" ON public.call_logs
  FOR UPDATE TO authenticated USING (
    agent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "call_logs: delete own or admin" ON public.call_logs
  FOR DELETE TO authenticated USING (
    agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================================
-- call_reminders
-- ============================================================
CREATE TABLE public.call_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  call_time timestamptz NOT NULL,
  note text,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_reminders_agent_time_idx ON public.call_reminders(agent_id, call_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_reminders TO authenticated;
GRANT ALL ON public.call_reminders TO service_role;
ALTER TABLE public.call_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders: read own or staff" ON public.call_reminders
  FOR SELECT TO authenticated USING (
    agent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "reminders: insert own" ON public.call_reminders
  FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "reminders: update own or staff" ON public.call_reminders
  FOR UPDATE TO authenticated USING (
    agent_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "reminders: delete own or admin" ON public.call_reminders
  FOR DELETE TO authenticated USING (
    agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );
