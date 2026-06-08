# Broder-Mansoor Portal — Features

Living document of all features currently shipped in this app. Update this file in the same change whenever a feature is added, removed, or materially changed.

## Authentication & Roles
- Real Supabase email/password auth via `AuthContext` + `onAuthStateChange`
- Google OAuth sign-in (via Lovable auth integration)
- Three roles: `admin`, `preparer`, `client` (derived from `user_metadata.role`)
- Four quick demo logins on the login screen:
  - Nick Broder — admin (`nick@brodermansoor.com`)
  - Shawn Mansoor — preparer (`shawn@brodermansoor.com`)
  - Girik Patel — preparer (`girik@brodermansoor.com`)
  - John Smith — client (`john.smith@email.com`)
  - All seeded with password `password123` via the `seed-demo-users` edge function
- `ProtectedRoute` enforces role-based access: admins/preparers fall back to `/dashboard`, clients fall back to `/portal`
- Logout via Supabase `signOut`

## Client Dashboard (`/portal`)
- Loads the logged-in client via `clients.auth_user_id`
- Document checklist driven by `document_requirements` (W-2, 1099-NEC, etc.) with progress tracking
- Drag-and-drop document upload writing to Supabase Storage (`documents` bucket) + `document_uploads`
- Simulated AI analysis with three outcomes (Wrong Year, Duplicate, Verified) writing `ai_status`
- "Still Missing" alert with self-reminder trigger (logged to `reminders` + `activity_log`)
- Sonner toast feedback

## Magic Link Upload Portal (`/upload/:token`)
- Public, tokenized upload page for clients without a login
- Resolves client by upload token; shows an expired-token state when invalid
- Same checklist + drag-and-drop upload + AI validation pipeline as the client dashboard
- Failed validations create `ai_flags`, draft a client email into `email_drafts`, and append to `activity_log`

## Admin Dashboard (`/dashboard`, admin + preparer)
- Animated ROI hero banner (14.5 hours / $406 saved)
- "Client Portal: brodermansoor.buildyourai.consulting" sub-header
- AI Agent Team Banner (collapsible) — 4 agents: Doc Classifier, Duplicate Detector, Missing Doc Tracker, Follow-up Sender
- Live AI Agent Activity Feed (auto-updates, max 12 entries)
- "Needs Your Attention" AI flag cards: Wrong Year, Duplicates, Unnecessary File — with interactive toasts
- Client management table backed by `clients` table — progress, status, flag counts
- "Remind" button → pre-filled email reminder modal (writes to `reminders`)
- Client detail modal

## Clients
- `/clients` (admin only) — searchable client list with status filter tabs, progress bars, AI issue counts, assigned staff, relative last activity, View + Remind actions, "Add Client" modal
- `/clients/:id` (admin + preparer) — client detail page with header (status, staff, Send Reminder, Back) and tabs:
  - Document Checklist
  - AI Flags
  - Activity Log
  - Internal Notes (save toast, pre-existing note)
  - Input Sheet (see component)
- Time Tracker auto-starts when a preparer opens a client (see component)

## AI Flags (`/flags`, admin + preparer)
- All AI flags from `ai_flags` with severity badges, type filter tabs, Open/Resolved views
- Summary stat cards
- Action buttons: Send Correction / Auto-Remove / Remove File / Send Reminder / Mark Resolved

## Activity Log (`/activity`, admin + preparer)
- Cross-client timeline from `activity_log` with search by client and AI/Staff/Client type filter
- Color-coded actor avatars

## Email Queue (`/email-queue`, admin + preparer)
- Review AI-drafted client emails from `email_drafts`
- Pending vs Sent tabs
- Edit subject + body in modal, then Approve & Send or Dismiss
- Approval logs to `activity_log`

## Admin Settings (`/admin`, admin only)
- User Management (invite modal)
- TaxDome Integration (masked API key)
- Document Types
- Branding (firm name, copyable portal URL, logo upload, save toast)

## Dev Docs (`/dev-docs`, admin only)
- Internal build-status reference with Built / Simulated / Placeholder / Not Built badges and effort estimates

## Profile (`/profile`)
- Shared profile page for all roles: avatar initials, editable name/phone, read-only email, role badge
- Admin sees read-only Tax Season

## Input Sheet (component, on client detail)
- AI-populate tax input rows from uploaded documents (W-2, 1099-NEC/INT/DIV/B, 1098, K-1, Schedule C)
- Per-row Verify action
- Backed by `input_sheet_entries`

## Time Tracker (component, on client detail)
- Auto starts a `time_entries` session for preparers/admins when a client is viewed
- Auto stops on unmount; displays live elapsed time

## Branding
- "Broder-Mansoor" tab title and headers
- "Powered by SJ Innovation AI" footer

## Navigation
- Persistent dark navy sidebar with Broder-Mansoor branding and "Powered by SJ Innovation AI" footer
- Admin sidebar: Dashboard, Clients, AI Flags, Activity Log, Email Queue, Admin, Dev Docs, Profile, Logout
- Preparer sidebar: Dashboard, AI Flags, Activity Log, Email Queue, Profile, Logout
- Client sidebar: My Documents, Profile, Logout
- Active route highlighted with blue left border and lighter background
- Mobile hamburger toggle with slide-in overlay
- Role-protected routes via `ProtectedRoute`

## Backend (Lovable Cloud)
- Supabase tables: `clients`, `document_requirements`, `document_uploads`, `ai_flags`, `email_drafts`, `activity_log`, `time_entries`, `input_sheet_entries`, `reminders`
- Supabase Storage bucket: `documents` (private)
- `is_admin()` security-definer function used by RLS policies
- RLS posture: admin full access, clients read/insert their own rows; demo-grade `authenticated` read policies in place on several tables (to be tightened before production)
- Edge function `seed-demo-users` — one-shot seeding of the 4 demo auth users and linking John's client row to his auth user

## Demo Data Seeding
- **Load Demo Data** button on `/dashboard` AND `/clients` runs `seedAllDemoData` which ensures **20 demo clients** exist (6 hand-crafted scenarios + 14 procedurally generated) and fully populates the app for each
- Per client the seeder produces: 5–7 document uploads (verified / flagged / rejected mix), 2–4 AI flags across all four flag types with some pre-resolved (so the Flags page Resolved tab is populated), 3–5 email drafts (mix of pending and historical sent so Email Queue → Sent is populated), 15–22 activity_log entries across the four named AI agents + staff + client actors, multi-session `time_entries` (3–4 sessions per client) and 1–2 historical `reminders`
- Per-client `documents_submitted` / `issues` / `last_activity` are recomputed from the seeded data so dashboard counters stay accurate
- Seeder is idempotent — missing extra clients are inserted, and per-client data is cleared and re-seeded on each run
- **Seed Demo Emails** button on `/email-queue` adds 2 pending + 1 sent AI-drafted email per active client (populates both Pending and Sent tabs)

## Tech / UI
- React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- React Router v6 with nested layout routes
- TanStack Query, Supabase JS client, Sonner toasts, Lucide icons

---

## Maintenance rule
Every PR/change that adds or materially changes a user-facing feature must update this file in the same commit. Group entries under the appropriate section (add a new section if needed). Keep entries one line and user-facing.

## Magic Link Upload
- Public `/upload/:token` route — no login required; clients open the link and upload requested documents directly.
- Admins generate, copy, and email links from **Client Detail → Magic Links** tab; per-document Copy Link / Send via Email actions and a "Send All Pending" shortcut.
- Link activity (generate / email) is recorded in the activity log; per-session "Link sent" indicators surface status before uploads arrive.
- Client-account login is deprecated in favor of magic links (the `/portal` route is retained but no longer surfaced from the login screen).
