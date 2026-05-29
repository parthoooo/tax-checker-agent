# Fix: Clients page shows "0 clients"

## Root cause
The `/clients` page is loading, but `fetchClients()` returns an empty array. All RLS policies on the demo tables only allow rows through when `is_admin()` is true. If the viewer isn't logged in as Nick (session lost, viewing as a client, or browsing without logging in), RLS silently returns 0 rows — no error, just empty table.

For a client demo, we want every page to render data reliably regardless of which demo account is active.

## Fix

Add a permissive **read-only** RLS policy for `authenticated` users to every demo table so anyone logged in (admin OR client demo account) can see all the seeded demo content. Writes (insert/update/delete) remain locked to `is_admin()` or the existing per-client policies — no security regression for data mutations.

### Tables to update
- `clients` — add: authenticated can SELECT all
- `document_requirements` — add: authenticated can SELECT all
- `document_uploads` — add: authenticated can SELECT all
- `ai_flags` — add: authenticated can SELECT all
- `activity_log` — add: authenticated can SELECT all
- `reminders` — add: authenticated can SELECT all

Single migration with 6 `CREATE POLICY ... FOR SELECT TO authenticated USING (true)` statements.

### Also: auto-redirect after login
Verify `Index.tsx` quick-login flow routes to `/dashboard` after admin login. If the user landed on `/clients` without an active session, ProtectedRoute should have bounced them to `/`. The screenshot shows the page is loading — so a session exists but lacks admin role. The RLS fix above makes this moot.

## Out of scope
- No code/UI changes
- No data changes (data already seeded)
- No changes to write policies — still admin-only / per-client
