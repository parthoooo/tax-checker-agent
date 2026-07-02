-- Client portal submit: bypass staff-field trigger via trusted SECURITY DEFINER RPC.
-- Direct client UPDATE of status/documents_submitted was blocked by _clients_restrict_client_updates.

CREATE OR REPLACE FUNCTION public._clients_restrict_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.portal_profession_sync', true) IN ('1', 'on') THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.client_submit', true) IN ('1', 'on') THEN
    RETURN NEW;
  END IF;

  IF NEW.status               IS DISTINCT FROM OLD.status
  OR NEW.documents_required   IS DISTINCT FROM OLD.documents_required
  OR NEW.documents_submitted  IS DISTINCT FROM OLD.documents_submitted
  OR NEW.assigned_staff       IS DISTINCT FROM OLD.assigned_staff
  OR NEW.assigned_preparer    IS DISTINCT FROM OLD.assigned_preparer
  OR NEW.profession_locked    IS DISTINCT FROM OLD.profession_locked
  OR NEW.year_upload_unlocks  IS DISTINCT FROM OLD.year_upload_unlocks
  OR NEW.prior_year_upload_enabled IS DISTINCT FROM OLD.prior_year_upload_enabled
  OR NEW.portal_enabled_years IS DISTINCT FROM OLD.portal_enabled_years
  OR NEW.issues               IS DISTINCT FROM OLD.issues
  OR NEW.auth_user_id         IS DISTINCT FROM OLD.auth_user_id
  OR NEW.email                IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'Clients cannot modify staff-controlled fields';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_submit_for_review(
  p_client_id uuid,
  p_tax_year text DEFAULT '2025',
  p_uploaded_count int DEFAULT 0,
  p_required_count int DEFAULT 0,
  p_actor_name text DEFAULT 'Client'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_client clients%ROWTYPE;
  v_unlocks text[];
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;

  IF v_client.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  IF auth.uid() IS NULL OR v_client.auth_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  PERFORM set_config('app.client_submit', '1', true);

  v_unlocks := array_remove(COALESCE(v_client.year_upload_unlocks, '{}'::text[]), p_tax_year);

  IF p_tax_year = '2025' THEN
    UPDATE public.clients
    SET
      last_activity = now(),
      documents_submitted = p_uploaded_count,
      documents_required = p_required_count,
      status = 'complete',
      issues = 0,
      year_upload_unlocks = v_unlocks
    WHERE id = p_client_id;
  ELSE
    UPDATE public.clients
    SET
      last_activity = now(),
      year_upload_unlocks = v_unlocks
    WHERE id = p_client_id;
  END IF;

  PERFORM set_config('app.client_submit', '', true);

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    p_client_id,
    p_actor_name,
    'client',
    format('Submitted all %s documents for preparer review', p_tax_year)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_submit_for_review(uuid, text, int, int, text) TO authenticated;

-- Magic link submit: same trigger bypass
CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_client      clients%ROWTYPE;
  v_uploaded    int;
  v_required    int;
BEGIN
  SELECT mlt.client_id INTO v_client_id
  FROM public.magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.id IS NOT NULL),
    COUNT(*)
  INTO v_uploaded, v_required
  FROM public.document_requirements r
  LEFT JOIN LATERAL (
    SELECT du.id
    FROM public.document_uploads du
    WHERE du.requirement_id = r.id
      AND du.client_id = r.client_id
      AND du.tax_year = '2025'
    ORDER BY du.uploaded_at DESC
    LIMIT 1
  ) u ON true
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025'
    AND r.required = true;

  IF v_required = 0 OR v_uploaded < v_required THEN
    RETURN jsonb_build_object(
      'error', 'Upload a file for every required document before submitting',
      'uploaded', v_uploaded,
      'required', v_required
    );
  END IF;

  PERFORM set_config('app.client_submit', '1', true);

  UPDATE public.clients
  SET status = 'complete',
      documents_submitted = v_uploaded,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  PERFORM set_config('app.client_submit', '', true);

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    v_client.name,
    'client',
    'Submitted all 2025 documents for preparer review (magic link)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'uploaded', v_uploaded
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_documents_via_token(text) TO anon, authenticated;
