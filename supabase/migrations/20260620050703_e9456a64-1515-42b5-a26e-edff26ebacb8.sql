CREATE OR REPLACE FUNCTION public.get_telephony_mode(_org uuid)
RETURNS TABLE(enabled boolean, provider text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_enabled boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT public.is_org_member(v_uid, _org) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT (c.enabled AND c.api_token IS NOT NULL AND length(c.api_token) > 0)
    INTO v_enabled
  FROM public.telavox_configs c
  WHERE c.organization_id = _org;
  RETURN QUERY SELECT COALESCE(v_enabled,false),
    CASE WHEN COALESCE(v_enabled,false) THEN 'telavox' ELSE 'mock' END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_telephony_mode(uuid) TO authenticated;