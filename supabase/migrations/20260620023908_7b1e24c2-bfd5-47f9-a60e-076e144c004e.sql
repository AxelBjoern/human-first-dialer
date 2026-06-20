
-- 1. Organizations
CREATE TYPE public.source_app AS ENUM ('vdnx', 'energy', 'executive');
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'agent');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  source_app public.source_app,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX ON public.org_members (user_id);
CREATE INDEX ON public.org_members (organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(_uid uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = _uid AND organization_id = _org);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_uid uuid, _org uuid, _min public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _uid AND organization_id = _org
    AND CASE role
      WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 WHEN 'agent' THEN 1 END
    >= CASE _min
      WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 WHEN 'agent' THEN 1 END
  );
$$;

CREATE POLICY "members read own orgs" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "any auth user creates org" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "admins update org" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), id, 'admin'));
CREATE POLICY "owners delete org" ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'owner'));

CREATE POLICY "members read members of own orgs" ON public.org_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "admins add members" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE POLICY "admins update members" ON public.org_members FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE POLICY "admins remove members or self leave" ON public.org_members FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin') OR user_id = auth.uid());

-- 2. Invites
CREATE TABLE public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text,
  code text NOT NULL UNIQUE,
  role public.org_role NOT NULL DEFAULT 'agent',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.org_invites (organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invites TO authenticated;
GRANT ALL ON public.org_invites TO service_role;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage invites" ON public.org_invites FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));

-- 3. API Keys
CREATE TABLE public.org_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL UNIQUE,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['clients:read','clients:write','calls:write','reminders:read','reminders:write']::text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.org_api_keys (organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_api_keys TO authenticated;
GRANT ALL ON public.org_api_keys TO service_role;
ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage api keys" ON public.org_api_keys FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));

-- 4. Outbound Connections (this dialer pulling from VDNX / Energy / Executive)
CREATE TABLE public.org_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_app public.source_app NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL,
  token text NOT NULL,
  webhook_secret text,
  enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.org_connections (organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_connections TO authenticated;
GRANT ALL ON public.org_connections TO service_role;
ALTER TABLE public.org_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage connections" ON public.org_connections FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));

-- 5. Outbound webhooks
CREATE TABLE public.org_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event text NOT NULL,
  target_url text NOT NULL,
  secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.org_webhooks (organization_id, event);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_webhooks TO authenticated;
GRANT ALL ON public.org_webhooks TO service_role;
ALTER TABLE public.org_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage webhooks" ON public.org_webhooks FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));

-- 6. Add org_id to existing tables and backfill
ALTER TABLE public.profiles ADD COLUMN default_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.clients ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.call_logs ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.call_reminders ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN source_app public.source_app;
ALTER TABLE public.clients ADD COLUMN external_id text;

-- Backfill: one personal org per existing profile
DO $$
DECLARE p record; new_org uuid;
BEGIN
  FOR p IN SELECT id, COALESCE(first_name,'') AS fn, COALESCE(last_name,'') AS ln, email FROM public.profiles LOOP
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (
      COALESCE(NULLIF(trim(p.fn || ' ' || p.ln), ''), split_part(p.email,'@',1), 'Workspace') || '''s workspace',
      'org-' || replace(p.id::text, '-', '') || '-' || floor(extract(epoch from now()))::text,
      p.id
    )
    RETURNING id INTO new_org;
    INSERT INTO public.org_members (organization_id, user_id, role) VALUES (new_org, p.id, 'owner');
    UPDATE public.profiles SET default_organization_id = new_org WHERE id = p.id;
    UPDATE public.clients SET organization_id = new_org WHERE owner_id = p.id AND organization_id IS NULL;
    UPDATE public.call_logs SET organization_id = new_org WHERE agent_id = p.id AND organization_id IS NULL;
    UPDATE public.call_reminders SET organization_id = new_org WHERE agent_id = p.id AND organization_id IS NULL;
  END LOOP;
END $$;

CREATE INDEX ON public.clients (organization_id);
CREATE INDEX ON public.call_logs (organization_id);
CREATE INDEX ON public.call_reminders (organization_id);

-- 7. Rewrite RLS on existing tables to be org-scoped
DROP POLICY IF EXISTS "Agents can view assigned or owned clients" ON public.clients;
DROP POLICY IF EXISTS "Agents can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Agents can update assigned or owned clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;

CREATE POLICY "org members read clients" ON public.clients FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'));

DROP POLICY IF EXISTS "Agents view own call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents insert own call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Agents update own call_logs" ON public.call_logs;
DROP POLICY IF EXISTS "Admins view all call_logs" ON public.call_logs;

CREATE POLICY "org members read call_logs" ON public.call_logs FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert call_logs" ON public.call_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update own call_logs" ON public.call_logs FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND (agent_id = auth.uid() OR public.has_org_role(auth.uid(), organization_id, 'admin')))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Agents view own reminders" ON public.call_reminders;
DROP POLICY IF EXISTS "Agents insert own reminders" ON public.call_reminders;
DROP POLICY IF EXISTS "Agents update own reminders" ON public.call_reminders;
DROP POLICY IF EXISTS "Agents delete own reminders" ON public.call_reminders;

CREATE POLICY "org members read reminders" ON public.call_reminders FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members insert reminders" ON public.call_reminders FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members update reminders" ON public.call_reminders FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND (agent_id = auth.uid() OR public.has_org_role(auth.uid(), organization_id, 'admin')))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members delete reminders" ON public.call_reminders FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id) AND (agent_id = auth.uid() OR public.has_org_role(auth.uid(), organization_id, 'admin')));

-- 8. Make org_id NOT NULL going forward
ALTER TABLE public.clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.call_logs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.call_reminders ALTER COLUMN organization_id SET NOT NULL;

-- 9. Update the signup trigger: keep profile creation; drop auto agent role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;

-- updated_at triggers
CREATE TRIGGER set_updated_at_orgs BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_org_connections BEFORE UPDATE ON public.org_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
