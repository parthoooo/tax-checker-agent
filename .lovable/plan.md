## Goal
Make the **Load Demo Data** button (dashboard) and **Seed Demo Emails** button (email queue) populate a much richer dataset across the entire app, and keep `FEATURES.md` in sync.

## What's thin today
`src/lib/seedDemoData.ts` only covers 5 clients (David Kim is missing entirely), each gets:
- 2–4 uploads max
- 0–1 flag
- 0–1 email draft (only `pending`, never `sent`)
- 6–10 activity rows
- 1 time entry
- No reminders at all

## Changes

### 1. Expand `src/lib/seedDemoData.ts`

Add a `David Kim` scenario, and beef up every existing scenario so the whole app feels lived-in:

- **Uploads**: 5–8 per client (mix of `verified`, `flagged`, `rejected`)
- **Flags**: 2–4 per client across all 4 types (`wrong-year`, `duplicate`, `unexpected`, `missing`); include some pre-resolved ones (`resolved: true` with `resolved_at`) so the Flags page's Resolved tab is populated
- **Email drafts**: 1–2 per client, plus 1 historical `sent` draft per active client (so Email Queue → Sent tab is no longer empty)
- **Activity log**: 12–20 entries per client spread across the last 7 days, mixing AI/staff/client actors and naming all 4 agents (Doc Classifier, Duplicate Detector, Missing Doc Tracker, Follow-up Sender)
- **Input sheet entries**: extend `inputFileNames` to cover all uploaded docs so every client's Input Sheet tab has rows
- **Time entries**: 3–5 sessions per client over the past week (different preparers, varied durations) instead of one big session
- **Reminders**: insert 1–2 historical reminders per overdue/active client into the `reminders` table

Add a new section in the seeder that clears + reseeds `reminders` per client (mirrors the existing clear/insert pattern). Keep the existing safe re-run behavior.

Adjust the per-client `documents_submitted` / `issues` / `last_activity` update to reflect the new richer counts.

### 2. Keep `Seed Demo Emails` aligned

`EmailQueue.tsx`'s **Seed Demo Emails** button already calls a helper that generates extra drafts. Extend it (or have it call into the new richer email portion of `seedDemoData.ts`) so clicking it produces ~3 pending and ~2 sent drafts per client instead of just one per client.

### 3. Update `FEATURES.md`

Append/refresh entries to reflect:
- Richer demo seeder coverage (uploads, flags incl. resolved, emails pending+sent, multi-session time tracking, historical reminders, full activity timeline)
- David Kim now included in the seeder
- Reminders table populated by the seeder

Reinforce the existing **Maintenance rule** section (already there) — no structural change needed.

## Verification

1. Click **Load Demo Data** on `/dashboard`, wait for "Done ✅".
2. Visit each page and confirm rich data:
   - `/dashboard` — all 6 clients, varied progress, flag counts > 0
   - `/clients` — same
   - `/clients/:id` (each one) — checklist, flags, activity timeline (>10 rows), input sheet rows, internal notes
   - `/flags` — Open tab has many rows across all 4 types; Resolved tab is no longer empty
   - `/activity` — long cross-client timeline
   - `/email-queue` — Pending tab has multiple drafts; Sent tab is no longer empty
3. Click **Seed Demo Emails** on `/email-queue` and confirm new pending + sent drafts appear.
4. Confirm `FEATURES.md` reflects the new demo coverage.

## Out of scope

- No schema changes (all target tables already exist with correct FKs and RLS).
- No UI changes to the buttons themselves — only what they produce.
- No changes to auth, routes, or component layouts.
