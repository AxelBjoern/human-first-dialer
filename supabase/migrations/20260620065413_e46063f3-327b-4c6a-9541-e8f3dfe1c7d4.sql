CREATE OR REPLACE FUNCTION public.users_share_org(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members ma
    JOIN public.org_members mb ON mb.organization_id = ma.organization_id
    WHERE ma.user_id = _a AND mb.user_id = _b
  );
$$;

DROP POLICY IF EXISTS "profiles: read all authenticated" ON public.profiles;

CREATE POLICY "profiles: read self or shared org"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.users_share_org(auth.uid(), id)
  );
