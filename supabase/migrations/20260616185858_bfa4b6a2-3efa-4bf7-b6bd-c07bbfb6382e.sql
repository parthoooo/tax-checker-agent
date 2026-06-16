-- 1) activity_log: drop NULL client_id branch from anon insert policy
DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
CREATE POLICY "magic link insert activity" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (client_id IS NOT NULL AND public.magic_link_allows_client(client_id));

-- 2) storage.objects: allow anon magic-link read on documents bucket scoped to client folder
DROP POLICY IF EXISTS "magic link storage read" ON storage.objects;
CREATE POLICY "magic link storage read" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.magic_link_allows_client(((storage.foldername(name))[2])::uuid)
  );