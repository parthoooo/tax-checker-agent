## Plan to fix “Failed to load email queue”

**Root cause**
- The page queries `email_drafts` with `clients(name, email)` embedded.
- The database currently has no foreign-key relationship between `email_drafts.client_id` and `clients.id`, so the API returns `PGRST200: Could not find a relationship between 'email_drafts' and 'clients'`.
- Inserts are working, so this is a loading/query relationship issue, not a demo email generation issue.

**Fix**
1. Add the missing database relationship:
   - Add a foreign key from `public.email_drafts.client_id` to `public.clients.id`.
   - Add a matching foreign key from `public.time_entries.client_id` to `public.clients.id` because that table was created in the same schema gap and may need client joins later.
   - No demo data seeding in the migration.

2. Clean up the email draft approval mismatch:
   - The app currently updates `approved_by` and `approved_at`, but the actual `email_drafts` table has `sent_at` instead.
   - Update approval logic to set `status = 'sent'` and `sent_at = now` only.
   - Keep dismiss/update behavior unchanged.

3. Verify:
   - Open `/email-queue`.
   - Confirm pending and sent tabs load without the error toast.
   - Click **Generate Demo Emails** and confirm generated rows appear.
   - Approve one draft and confirm it moves to Sent History.