## Plan

1. **Add the real demo-data button to `/clients`**
   - Put a **Load Demo Data** action in the Clients page header next to **Add Client**.
   - Reuse the existing `seedAllDemoData` function.
   - Show loading/progress text and refresh the clients list after it completes.
   - Keep **Generate Demo Emails** on the Email Queue page as a separate email-only action.

2. **Fix why client seeding is not creating records**
   - Add a Lovable Cloud migration that grants authenticated users the required demo write permissions on the existing app tables used by the seeder: `clients`, `document_requirements`, `document_uploads`, `ai_flags`, `activity_log`, `email_drafts`, `time_entries`, and `reminders`.
   - This matches the existing authenticated demo read policies and allows the admin/preparer demo account to insert/update/delete seed rows.

3. **Make seed failures visible instead of silently continuing**
   - Update `seedAllDemoData` so if any client fails to seed, the button reports which client/table failed.
   - This avoids the current situation where the UI can appear to finish while `/clients` still has only one client.

4. **Update feature documentation**
   - Update `FEATURES.md` to say **Load Demo Data** is available from `/clients` and seeds 20 clients plus documents, flags, emails, activity logs, time entries, and reminders.

## Expected result

After implementation, clicking **Load Demo Data** on `/clients` should populate all 20 clients, and activity/email/flag screens should fill with demo records.