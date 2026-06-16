CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs jsonb;
  v_uploads jsonb;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025';

  IF v_reqs IS NULL OR v_reqs = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND coalesce(u.is_prior_year, false) = false;

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;