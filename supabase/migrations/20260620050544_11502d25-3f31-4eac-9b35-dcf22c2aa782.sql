CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (p_name, p_slug, v_uid)
  RETURNING id INTO v_org_id;
  INSERT INTO public.org_members (organization_id, user_id, role)
  VALUES (v_org_id, v_uid, 'owner');
  UPDATE public.profiles SET default_organization_id = v_org_id WHERE id = v_uid;
  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;