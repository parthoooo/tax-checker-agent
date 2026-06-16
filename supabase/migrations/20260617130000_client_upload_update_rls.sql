-- Client portal: allow authenticated clients to UPDATE (replace) their own uploads and storage files.
-- Fixes "new row violates row-level security policy" on /portal Replace File.

DROP POLICY IF EXISTS "client update own uploads" ON public.document_uploads;
CREATE POLICY "client update own uploads" ON public.document_uploads
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "client update own docs" ON storage.objects;
CREATE POLICY "client update own docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

GRANT UPDATE ON public.document_uploads TO authenticated;
