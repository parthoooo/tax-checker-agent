-- Magic link portal parity: tax-year snapshot, corrections, submit, signed URLs.

DROP FUNCTION IF EXISTS public.resolve_magic_link(text);

CREATE OR REPLACE FUNCTION public.resolve_magic_link(
  p_token text,
  p_tax_year text DEFAULT '2025'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_client public.clients%ROWTYPE;
  v_reqs jsonb;
  v_uploads jsonb;
  v_prior_reqs jsonb;
  v_prior_uploads jsonb;
  v_year_submitted boolean;
  v_year_locked boolean := false;
  v_lock_reason text;
  v_correction jsonb;
  v_unlocks text[];
  v_portal_years text[];
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = p_tax_year;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM (
    SELECT DISTINCT ON (du.requirement_id) du.*
    FROM document_uploads du
    WHERE du.client_id = v_client_id
      AND du.tax_year = p_tax_year
    ORDER BY du.requirement_id, du.uploaded_at DESC
  ) u;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_prior_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2024';

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_prior_uploads
  FROM (
    SELECT DISTINCT ON (du.requirement_id) du.*
    FROM document_uploads du
    WHERE du.client_id = v_client_id
      AND du.tax_year = '2024'
    ORDER BY du.requirement_id, du.uploaded_at DESC
  ) u;

  SELECT EXISTS (
    SELECT 1
    FROM activity_log a
    WHERE a.client_id = v_client_id
      AND a.action LIKE format('Submitted all %s documents%%', p_tax_year)
  ) INTO v_year_submitted;

  v_unlocks := COALESCE(v_client.year_upload_unlocks, '{}'::text[]);

  IF p_tax_year <> '2025' THEN
    v_portal_years := COALESCE(v_client.portal_enabled_years, '{}'::text[]);
    IF NOT (
      p_tax_year = ANY(v_portal_years)
      OR (v_client.prior_year_upload_enabled AND p_tax_year = '2024')
    ) THEN
      v_year_locked := true;
      v_lock_reason := format(
        'Uploads for %s are disabled. Ask your preparer to enable prior-year uploads.',
        p_tax_year
      );
    END IF;
  END IF;

  IF NOT v_year_locked AND v_year_submitted AND NOT (p_tax_year = ANY(v_unlocks)) THEN
    v_year_locked := true;
    v_lock_reason := format(
      'Your %s documents were already submitted. Contact your preparer if you need to upload again.',
      p_tax_year
    );
  END IF;

  SELECT to_jsonb(c)
  INTO v_correction
  FROM client_corrections c
  WHERE c.client_id = v_client_id
    AND c.status = 'sent'
  ORDER BY c.sent_at DESC
  LIMIT 1;

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'tax_year', p_tax_year,
    'client', row_to_json(v_client),
    'requirements', v_reqs,
    'uploads', v_uploads,
    'prior_requirements', v_prior_reqs,
    'prior_uploads', v_prior_uploads,
    'year_submitted', v_year_submitted,
    'year_locked', v_year_locked,
    'year_lock_reason', v_lock_reason,
    'active_correction', v_correction
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.magic_link_submit_for_review(
  p_token text,
  p_tax_year text DEFAULT '2025',
  p_uploaded_count int DEFAULT 0,
  p_required_count int DEFAULT 0,
  p_actor_name text DEFAULT 'Client'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_client public.clients%ROWTYPE;
  v_unlocks text[];
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = v_client_id;

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
    WHERE id = v_client_id;
  ELSE
    UPDATE public.clients
    SET
      last_activity = now(),
      year_upload_unlocks = v_unlocks
    WHERE id = v_client_id;
  END IF;

  PERFORM set_config('app.client_submit', '', true);

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    p_actor_name,
    'client',
    format('Submitted all %s documents for preparer review (magic link)', p_tax_year)
  );

  UPDATE public.client_corrections
  SET status = 'resolved', resolved_at = now()
  WHERE client_id = v_client_id AND status = 'sent';

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_submit_for_review(text, text, int, int, text) TO anon, authenticated;

-- Keep legacy single-arg submit as thin wrapper for older clients.
CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_uploaded int;
  v_required int;
  v_client public.clients%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

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

  RETURN public.magic_link_submit_for_review(
    p_token,
    '2025',
    v_uploaded,
    v_required,
    (SELECT name FROM public.clients WHERE id = v_client_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_documents_via_token(text) TO anon, authenticated;
