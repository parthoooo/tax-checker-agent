## Why only 1 client / 1 activity row shows

Two bugs in `src/lib/seedDemoData.ts` make **Load Demo Data** fail before it can populate anything:

### Bug 1 — Seeder only auto-inserts the 14 procedural clients, never the 6 scenario clients
`seedAllDemoData()` only loops over `EXTRA_CLIENTS` (Emily Davis, James Wilson, …) and inserts the missing ones. The 6 hand-written `SCENARIOS` clients (`John Smith`, `Michael Brown`, `Sarah Johnson`, `Robert Chen`, `Maria Rodriguez`, `David Kim`) are assumed to already exist from `supabase/seed.sql`. In your DB only **John Smith** exists, so the other 5 named scenarios never get created.

### Bug 2 — Seeder writes to a table that doesn't exist (`input_sheet_entries`)
At line 785 the seeder runs `supabase.from('input_sheet_entries').insert(...)` and the next line throws via `check(...)`. There is **no `input_sheet_entries` table** in the schema (only `activity_log`, `ai_flags`, `clients`, `document_requirements`, `document_uploads`, `email_drafts`, `reminders`, `time_entries`). So the very first iteration of the per-client loop aborts the whole seeder with `relation "public.input_sheet_entries" does not exist`. Even if `EXTRA_CLIENTS` were inserted just before, every downstream insert (activity, flags, emails, time entries…) for every client is skipped.

The activity log shows only 1 row because nothing past that throw ever runs.

## Fix

Edit `src/lib/seedDemoData.ts` only:

1. **Auto-insert SCENARIO clients too.** Before the existing `EXTRA_CLIENTS` block, build a list of the 6 scenario clients (name + email + phone + assigned_staff + status, matching what `SCENARIOS` expects) and upsert any that aren't already in the DB. After that, also insert any missing `EXTRA_CLIENTS`. End result: every run guarantees all 20 clients exist.

2. **Remove the broken `input_sheet_entries` calls.** Delete the `supabase.from('input_sheet_entries').delete(...)` line in the per-client cleanup `Promise.all`, and delete the entire input-sheet insert block (the `if (fields.length > 0) { … }` around lines 775–787) plus the `generateInputSheetData` call/import if it becomes unused. (The Input Sheet tab in `ClientDetail` already generates this view-side; no DB rows are needed for it to render.)

3. (Defensive) Wrap the per-client loop body in a `try/catch` that logs the failing client and continues, so one bad client never blanks the entire dataset again.

## Verify

- Click **Load Demo Data** on `/dashboard` → toast says "Demo data loaded".
- `/clients` shows 20 rows; `/activity` shows hundreds of rows across many clients; `/flags` Open + Resolved both populated; `/email-queue` Pending + Sent both populated.
- Re-click is still idempotent (existing per-client data is cleared before re-seeding).

## Out of scope

- No schema changes — we are not creating an `input_sheet_entries` table since nothing reads from it.
- No UI changes.
- No changes to `FEATURES.md` (already reflects the intended seeder coverage).
