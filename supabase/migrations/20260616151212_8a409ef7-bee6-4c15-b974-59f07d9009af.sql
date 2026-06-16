
-- 1) document_uploads tax year columns
ALTER TABLE public.document_uploads
  ADD COLUMN IF NOT EXISTS tax_year text NOT NULL DEFAULT '2024',
  ADD COLUMN IF NOT EXISTS is_prior_year boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_document_uploads_client_tax_year
  ON public.document_uploads (client_id, tax_year, is_prior_year);

-- 2) email_drafts.type
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS type text CHECK (type IS NULL OR type IN ('outbox', 'reminder'));
CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON public.email_drafts(type);

-- 3) Drop existing resolve_magic_link variants then recreate JSON version
DROP FUNCTION IF EXISTS public.resolve_magic_link(text);
DROP FUNCTION IF EXISTS public.resolve_magic_link(_token text);
DROP FUNCTION IF EXISTS public.resolve_magic_link(p_token text);

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
  v_reqs json;
  v_uploads json;
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

  SELECT coalesce(json_agg(r ORDER BY r.created_at), '[]'::json)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025';

  IF v_reqs = '[]'::json OR v_reqs IS NULL THEN
    SELECT coalesce(json_agg(r ORDER BY r.created_at), '[]'::json)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(json_agg(u ORDER BY u.uploaded_at DESC), '[]'::json)
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

-- 4) magic_link_allows_client helper + anon policies
CREATE OR REPLACE FUNCTION public.magic_link_allows_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM magic_link_tokens t
    WHERE t.client_id = p_client_id
      AND t.expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_allows_client(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "magic link storage upload" ON storage.objects;
CREATE POLICY "magic link storage upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.magic_link_allows_client(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "magic link insert upload row" ON public.document_uploads;
CREATE POLICY "magic link insert upload row" ON public.document_uploads
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link update upload row" ON public.document_uploads;
CREATE POLICY "magic link update upload row" ON public.document_uploads
  FOR UPDATE TO anon
  USING (public.magic_link_allows_client(client_id))
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert flag" ON public.ai_flags;
CREATE POLICY "magic link insert flag" ON public.ai_flags
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert email draft" ON public.email_drafts;
CREATE POLICY "magic link insert email draft" ON public.email_drafts
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
CREATE POLICY "magic link insert activity" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (client_id IS NULL OR public.magic_link_allows_client(client_id));

GRANT INSERT ON public.document_uploads TO anon;
GRANT UPDATE ON public.document_uploads TO anon;
GRANT INSERT ON public.ai_flags TO anon;
GRANT INSERT ON public.email_drafts TO anon;
GRANT INSERT ON public.activity_log TO anon;
