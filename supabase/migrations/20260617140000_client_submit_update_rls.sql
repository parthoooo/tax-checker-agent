-- Client portal: allow authenticated clients to UPDATE their own clients row on submit-for-review.

DROP POLICY IF EXISTS "client update own submission" ON public.clients;
CREATE POLICY "client update own submission" ON public.clients
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

GRANT UPDATE ON public.clients TO authenticated;
