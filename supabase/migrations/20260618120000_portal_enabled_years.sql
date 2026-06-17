-- Multi-year client portal uploads: admin-enabled prior tax years (up to 30 back).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_enabled_years text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clients.portal_enabled_years IS
  'Admin-enabled prior tax years visible on the client portal upload dropdown.';

UPDATE public.clients
SET portal_enabled_years = ARRAY['2024']
WHERE prior_year_upload_enabled = true
  AND (portal_enabled_years IS NULL OR portal_enabled_years = '{}');

CREATE OR REPLACE FUNCTION public.client_update_profession(
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_locked boolean;
  v_prior_enabled boolean;
  v_portal_years text[];
  v_year text;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
  v_requirements_by_year jsonb := '{}'::jsonb;
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT profession_locked, prior_year_upload_enabled, portal_enabled_years
  INTO v_locked, v_prior_enabled, v_portal_years
  FROM public.clients
  WHERE id = v_client_id;

  IF v_locked AND NOT p_lock_profession THEN
    RETURN jsonb_build_object('error', 'Profession is locked. Ask your preparer to unlock it on the portal.');
  END IF;

  IF v_portal_years IS NULL OR coalesce(array_length(v_portal_years, 1), 0) = 0 THEN
    IF v_prior_enabled THEN
      v_portal_years := ARRAY['2024'];
    ELSE
      v_portal_years := '{}';
    END IF;
  END IF;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, '2025', v_business_type, p_lock_profession
  );
  v_requirements_by_year := jsonb_build_object(
    '2025', public._portal_requirements_json(v_client_id, '2025', v_business_type)
  );

  FOREACH v_year IN ARRAY v_portal_years
  LOOP
    PERFORM public._sync_checklist_to_profession(
      v_client_id, v_year, v_business_type, false
    );
    v_requirements_by_year := v_requirements_by_year || jsonb_build_object(
      v_year, public._portal_requirements_json(v_client_id, v_year, v_business_type)
    );
  END LOOP;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    'Client',
    'client',
    format('Set profession to %s and synced portal checklists', v_business_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'business_type', v_business_type,
    'requirements_by_year', v_requirements_by_year,
    'requirements_2025', v_requirements_by_year->'2025',
    'requirements_2024', coalesce(v_requirements_by_year->'2024', '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_update_profession(text, boolean) TO authenticated;
