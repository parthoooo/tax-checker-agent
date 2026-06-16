-- Security hardening: staff-scoped authenticated RLS + magic-link token possession via RPCs.
-- Replaces Phase-1 demo USING (true) policies and client_id-only magic link checks.

-- ── Staff helper (admin + preparer) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_user_meta_data->>'role' IN ('admin', 'preparer')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Internal: resolve client_id from possessed token (not granted to callers directly)
CREATE OR REPLACE FUNCTION public._magic_link_client_id(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.client_id
  FROM public.magic_link_tokens t
  WHERE t.token = p_token
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._magic_link_client_id(text) FROM PUBLIC;

-- ── Drop broken demo + anon direct-access policies ───────────────────────────
DROP POLICY IF EXISTS "demo authenticated read clients" ON public.clients;
DROP POLICY IF EXISTS "demo authenticated read reqs" ON public.document_requirements;
DROP POLICY IF EXISTS "demo authenticated read uploads" ON public.document_uploads;
DROP POLICY IF EXISTS "demo authenticated read flags" ON public.ai_flags;
DROP POLICY IF EXISTS "demo authenticated read activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo authenticated read reminders" ON public.reminders;
DROP POLICY IF EXISTS "demo authenticated read email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "demo authenticated read time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "demo read drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "demo read entries" ON public.input_sheet_entries;
DROP POLICY IF EXISTS "demo read time" ON public.time_entries;

DROP POLICY IF EXISTS "demo authenticated write clients" ON public.clients;
DROP POLICY IF EXISTS "demo authenticated write reqs" ON public.document_requirements;
DROP POLICY IF EXISTS "demo authenticated write uploads" ON public.document_uploads;
DROP POLICY IF EXISTS "demo authenticated write flags" ON public.ai_flags;
DROP POLICY IF EXISTS "demo authenticated write activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo authenticated write time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "demo authenticated write reminders" ON public.reminders;

DROP POLICY IF EXISTS "demo authenticated manage signup requests" ON public.signup_requests;
DROP POLICY IF EXISTS "demo authenticated manage corrections" ON public.client_corrections;

DROP POLICY IF EXISTS "authenticated insert email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "authenticated update email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "authenticated insert time" ON public.time_entries;
DROP POLICY IF EXISTS "authenticated update own time" ON public.time_entries;

DROP POLICY IF EXISTS "anon read clients via magic link" ON public.clients;
DROP POLICY IF EXISTS "anon read reqs via magic link" ON public.document_requirements;
DROP POLICY IF EXISTS "anon read uploads via magic link" ON public.document_uploads;
DROP POLICY IF EXISTS "anon insert uploads via magic link" ON public.document_uploads;
DROP POLICY IF EXISTS "anon insert flags via magic link" ON public.ai_flags;
DROP POLICY IF EXISTS "anon insert drafts via magic link" ON public.email_drafts;
DROP POLICY IF EXISTS "anon insert activity via magic link" ON public.activity_log;

DROP POLICY IF EXISTS "magic link insert upload row" ON public.document_uploads;
DROP POLICY IF EXISTS "magic link update upload row" ON public.document_uploads;
DROP POLICY IF EXISTS "magic link insert flag" ON public.ai_flags;
DROP POLICY IF EXISTS "magic link insert email draft" ON public.email_drafts;
DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
DROP POLICY IF EXISTS "magic link storage upload" ON storage.objects;
DROP POLICY IF EXISTS "magic link storage read" ON storage.objects;

-- ── Staff policies (admin + preparer portal access) ─────────────────────────
DROP POLICY IF EXISTS "staff all clients" ON public.clients;
CREATE POLICY "staff all clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all reqs" ON public.document_requirements;
CREATE POLICY "staff all reqs" ON public.document_requirements
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all uploads" ON public.document_uploads;
CREATE POLICY "staff all uploads" ON public.document_uploads
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all flags" ON public.ai_flags;
CREATE POLICY "staff all flags" ON public.ai_flags
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all activity" ON public.activity_log;
CREATE POLICY "staff all activity" ON public.activity_log
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all reminders" ON public.reminders;
CREATE POLICY "staff all reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all email_drafts" ON public.email_drafts;
CREATE POLICY "staff all email_drafts" ON public.email_drafts
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all time_entries" ON public.time_entries;
CREATE POLICY "staff all time_entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all input_sheet_entries" ON public.input_sheet_entries;
CREATE POLICY "staff all input_sheet_entries" ON public.input_sheet_entries
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff manage signup requests" ON public.signup_requests;
CREATE POLICY "staff manage signup requests" ON public.signup_requests
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff manage corrections" ON public.client_corrections;
CREATE POLICY "staff manage corrections" ON public.client_corrections
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all storage docs" ON storage.objects;
CREATE POLICY "staff all storage docs" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_staff())
  WITH CHECK (bucket_id = 'documents' AND public.is_staff());

-- Revoke direct anon table access (magic link uses SECURITY DEFINER RPCs only)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.clients FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_requirements FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_uploads FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_flags FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_drafts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_log FROM anon;

-- Drop legacy helpers that checked token existence without possession
DROP FUNCTION IF EXISTS public.magic_link_allows_client(uuid);
DROP FUNCTION IF EXISTS public.client_has_active_magic_token(uuid);

-- ── Magic link RPCs (token must match client on every write) ────────────────

CREATE OR REPLACE FUNCTION public.magic_link_upsert_upload(
  p_token text,
  p_existing_upload_id uuid,
  p_client_id uuid,
  p_requirement_id uuid,
  p_file_name text,
  p_storage_path text,
  p_file_size bigint,
  p_mime_type text,
  p_ai_status text,
  p_tax_year text DEFAULT '2025',
  p_is_prior_year boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.document_uploads%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;
  IF v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Token does not match client');
  END IF;

  IF p_existing_upload_id IS NOT NULL THEN
    UPDATE public.document_uploads
    SET
      requirement_id = p_requirement_id,
      file_name = p_file_name,
      storage_path = p_storage_path,
      file_size = p_file_size,
      mime_type = p_mime_type,
      ai_status = p_ai_status,
      tax_year = p_tax_year,
      is_prior_year = p_is_prior_year,
      uploaded_at = now()
    WHERE id = p_existing_upload_id
      AND client_id = v_client_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RETURN jsonb_build_object('error', 'Upload not found for this client');
    END IF;
  ELSE
    INSERT INTO public.document_uploads (
      client_id, requirement_id, file_name, storage_path, file_size,
      mime_type, ai_status, tax_year, is_prior_year, uploaded_by
    ) VALUES (
      v_client_id, p_requirement_id, p_file_name, p_storage_path, p_file_size,
      p_mime_type, p_ai_status, p_tax_year, p_is_prior_year, NULL
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'upload', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_create_flag(
  p_token text,
  p_client_id uuid,
  p_upload_id uuid,
  p_flag_type text,
  p_severity text,
  p_description text,
  p_detected_by text DEFAULT 'Doc Classifier Agent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.ai_flags%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.ai_flags (
    client_id, upload_id, flag_type, severity, description, detected_by
  ) VALUES (
    v_client_id, p_upload_id, p_flag_type, p_severity, p_description, p_detected_by
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'flag', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_create_email_draft(
  p_token text,
  p_client_id uuid,
  p_to_email text,
  p_from_label text,
  p_subject text,
  p_body text,
  p_status text DEFAULT 'pending',
  p_type text DEFAULT 'outbox'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.email_drafts%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.email_drafts (
    client_id, to_email, from_label, subject, body, status, type
  ) VALUES (
    v_client_id, p_to_email, p_from_label, p_subject, p_body, p_status, p_type
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'draft', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_log_activity(
  p_token text,
  p_client_id uuid,
  p_actor text,
  p_actor_type text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (v_client_id, p_actor, p_actor_type, p_action);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_upsert_upload(
  text, uuid, uuid, uuid, text, text, bigint, text, text, text, boolean
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_create_flag(
  text, uuid, uuid, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_create_email_draft(
  text, uuid, text, text, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_log_activity(
  text, uuid, text, text, text
) TO anon, authenticated;

-- Extend resolve_magic_link with prior-year data for YoY analysis (no anon table reads)
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
  v_prior_reqs jsonb;
  v_prior_uploads jsonb;
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

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2025';

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
    AND u.tax_year = '2025'
    AND coalesce(u.is_prior_year, false) = false;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_prior_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2024';

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_prior_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id AND u.tax_year = '2024';

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads,
    'prior_requirements', v_prior_reqs,
    'prior_uploads', v_prior_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;

-- Magic link tokens: staff/admin only (no public token enumeration)
DROP POLICY IF EXISTS "anon read token" ON public.magic_link_tokens;
DROP POLICY IF EXISTS "authenticated read tokens" ON public.magic_link_tokens;
DROP POLICY IF EXISTS "authenticated insert tokens" ON public.magic_link_tokens;

DROP POLICY IF EXISTS "staff manage magic link tokens" ON public.magic_link_tokens;
CREATE POLICY "staff manage magic link tokens" ON public.magic_link_tokens
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.magic_link_tokens FROM anon;

-- Client portal: own-row email draft insert (AI analysis follow-up)
DROP POLICY IF EXISTS "client insert own email drafts" ON public.email_drafts;
CREATE POLICY "client insert own email drafts" ON public.email_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "client read own email drafts" ON public.email_drafts;
CREATE POLICY "client read own email drafts" ON public.email_drafts
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
