
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS org_number text,
  ADD COLUMN IF NOT EXISTS vdnx_company_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_org_number_key
  ON public.organizations (org_number)
  WHERE org_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name text,
  p_slug text,
  p_company_name text DEFAULT NULL,
  p_org_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.organizations (name, slug, created_by, company_name, org_number)
  VALUES (p_name, p_slug, v_uid, p_company_name, p_org_number)
  RETURNING id INTO v_org_id;
  INSERT INTO public.org_members (organization_id, user_id, role)
  VALUES (v_org_id, v_uid, 'owner');
  UPDATE public.profiles SET default_organization_id = v_org_id WHERE id = v_uid;
  RETURN v_org_id;
END;
$function$;
