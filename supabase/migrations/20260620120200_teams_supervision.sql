-- ============================================================
-- Teams + team-leader supervision.
-- Base reads stay org-scoped (existing model: any org member reads
-- the org's call_logs / sessions). Supervision is layered ADDITIVELY:
-- team leaders are scoped to their team via can_supervise(), used by
-- co-listen authorization and team activity filtering in app code.
-- ============================================================

-- Re-rank has_org_role to include team_lead (owner > admin > team_lead > agent).
-- 'team_lead' is referenced here in a SEPARATE migration from ADD VALUE, so it
-- is already committed and safe to use.
CREATE OR REPLACE FUNCTION public.has_org_role(_uid uuid, _org uuid, _min public.org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _uid AND organization_id = _org
    AND CASE role
      WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'team_lead' THEN 2 WHEN 'agent' THEN 1 END
    >= CASE _min
      WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'team_lead' THEN 2 WHEN 'agent' THEN 1 END
  );
$$;

-- Teams ------------------------------------------------------
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  lead_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.teams (organization_id);
CREATE INDEX ON public.teams (lead_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read teams" ON public.teams FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org admins manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), organization_id, 'admin'))
  WITH CHECK (public.has_org_role(auth.uid(), organization_id, 'admin'));
CREATE TRIGGER set_updated_at_teams BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Team membership pointer on org_members (managed by existing admin policies)
ALTER TABLE public.org_members ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
CREATE INDEX ON public.org_members (team_id);

-- can_supervise: true if _uid is owner/admin of _org, OR leads a team that _target belongs to.
CREATE OR REPLACE FUNCTION public.can_supervise(_uid uuid, _target uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_org_role(_uid, _org, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.org_members m ON m.team_id = t.id
      WHERE t.organization_id = _org
        AND t.lead_user_id = _uid
        AND m.user_id = _target
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_supervise(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_supervise(uuid, uuid, uuid) TO authenticated, service_role;
