## Goal

`FEATURES.md` is out of date — it still describes the original mock/localStorage prototype. The app has since moved to a real Supabase backend with new pages, roles, and flows. I'll rewrite it so it accurately reflects what's shipped today.

## What's missing or wrong in the current file

- **Auth**: now real Supabase email/password (not mock/localStorage). Includes Google OAuth, 4 quick demo logins (Nick admin, Shawn preparer, Girik preparer, John client), and a `preparer` role.
- **Magic link upload portal** (`/upload/:token`) for clients to upload without logging in — not listed.
- **Email Queue** page (`/email-queue`) for reviewing/approving/editing AI-drafted client emails — not listed.
- **Dev Docs** page (`/dev-docs`) admin-only build status reference — not listed.
- **Input Sheet** component (AI-populated tax input sheet with verify flow) — not listed.
- **Time Tracker** component (auto start/stop time entries for preparers on client view) — not listed.
- **Seed demo users** edge function — not listed.
- **Data layer**: Supabase tables (clients, document_requirements, document_uploads, ai_flags, email_drafts, activity_log, time_entries, input_sheet_entries, reminders) — current doc still implies localStorage.
- **Role routing**: preparer role + new redirect rules in `ProtectedRoute`.
- **Routes**: `/email-queue`, `/dev-docs`, `/upload/:token` all missing from Navigation section.

## Plan

Rewrite `FEATURES.md` end-to-end with these sections:

1. **Authentication & Roles** — Supabase auth, email/password, Google OAuth, 3 roles (admin/preparer/client), 4 quick demo logins, role-based route protection with preparer fallback.
2. **Client Dashboard** (`/portal`) — checklist driven by `document_requirements`, real uploads to `document_uploads`, AI simulation outcomes, reminder logging.
3. **Magic Link Upload Portal** (`/upload/:token`) — tokenized client upload, expiry handling, same AI validation pipeline, writes flags + email drafts + activity.
4. **Admin Dashboard** (`/dashboard`) — ROI hero, AI agent team banner, live activity feed, "Needs Your Attention" flag cards, client table with remind action.
5. **Clients** (`/clients`, `/clients/:id`) — list with search/filter/add modal; detail page tabs (Checklist, AI Flags, Activity, Internal Notes) plus Input Sheet and Time Tracker.
6. **AI Flags** (`/flags`) — severity badges, filters, resolution actions.
7. **Activity Log** (`/activity`) — cross-client timeline from `activity_log` table.
8. **Email Queue** (`/email-queue`) — pending vs sent AI email drafts, edit subject/body, approve/dismiss.
9. **Admin Settings** (`/admin`) — User Management, TaxDome Integration, Document Types, Branding.
10. **Dev Docs** (`/dev-docs`, admin only) — internal build status reference.
11. **Profile** (`/profile`) — shared admin/client profile.
12. **Input Sheet** (component) — AI populate from uploaded docs, per-row verify.
13. **Time Tracker** (component) — auto start/stop time entries for preparers.
14. **Branding & Navigation** — sidebar items per role (admin / preparer / client), Broder-Mansoor branding, "Powered by SJ Innovation AI".
15. **Backend (Lovable Cloud)** — list the real Supabase tables, the `seed-demo-users` edge function, RLS posture (note: still to be hardened).
16. **Tech / UI** — React 18 + Vite + TS + Tailwind + shadcn/ui, React Router v6, Sonner, Lucide, TanStack Query, Supabase JS.
17. **Maintenance rule** — keep existing rule at the bottom.

No code changes — documentation only. Single file touched: `FEATURES.md`.
