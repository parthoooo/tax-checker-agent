-- v7: client profession lock, prior-year upload access, per-year re-upload unlocks

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profession_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prior_year_upload_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS year_upload_unlocks text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clients.profession_locked IS 'When true, client cannot change profession on portal without admin reset';
COMMENT ON COLUMN public.clients.prior_year_upload_enabled IS 'Admin enables client to select prior tax year on portal';
COMMENT ON COLUMN public.clients.year_upload_unlocks IS 'Tax years admin unlocked for client re-upload after initial submission';

-- Existing clients with a checklist already chose their template (admin or default)
UPDATE public.clients
SET profession_locked = true
WHERE id IN (SELECT DISTINCT client_id FROM public.document_requirements);

-- Magic link submit: all required slots must have a file (verified or flagged)
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
  FROM magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.id IS NOT NULL),
    COUNT(*)
  INTO v_uploaded, v_required
  FROM document_requirements r
  LEFT JOIN LATERAL (
    SELECT du.id
    FROM document_uploads du
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

  UPDATE clients
  SET status = 'complete',
      documents_submitted = v_uploaded,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  INSERT INTO activity_log (client_id, actor, actor_type, action)
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
