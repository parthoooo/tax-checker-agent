# Broder Mansoor Muqtadir, Inc. Portal — Features

Living document of all features currently shipped in this app. Update this file in the same change whenever a feature is added, removed, or materially changed.

## Authentication & Roles
- Real Supabase email/password auth via `AuthContext` + `onAuthStateChange`
- **Client self-signup** — Create Account tab on login page; **Continue with Google** on the same screen. New users enter an **admin approval queue** before portal access.
- **Sign-up Approvals** (admin) — `/clients/signups` lists pending Google/email registrations; admin assigns role: **Client** (portal + checklist), **Preparer**, or **Admin**.
- Google OAuth sign-in (via Lovable auth integration)
- Three roles: `admin`, `preparer`, `client` (derived from `user_metadata.role`)
- Quick demo logins on the login screen (password `BMM-Demo-2026!`, seeded via `seed-demo-users` edge function):
  - Nick Broder — admin (`nick@brodermansoor.com`)
  - Shawn Mansoor — preparer (`shawn@brodermansoor.com`)
  - Girik Patel — preparer (`girik@brodermansoor.com`)
  - John Smith — client (`john.smith@email.com`)
  - Sean Test Client — client (`sean.test@brodermansoor.com`)
  - Girik Test Client — client (`girik.test@brodermansoor.com`)
- `ProtectedRoute` enforces role-based access: admins/preparers fall back to `/dashboard`, clients fall back to `/portal`
- Logout via Supabase `signOut`

## Client Dashboard (`/portal`)
- Loads the logged-in client via `clients.auth_user_id`
- **Tax year dropdown:** current filing year (2025) always available; admin-enabled prior years (up to 30 back) appear when enabled on Client Detail
- Per-year checklist from `document_requirements` (W-2, 1099-NEC, 1098, Schedule C, etc.) with progress tracking
- **Deferred upload:** client selects a file per checklist slot locally; nothing is stored until **Submit for Review**
- On submit: batch upload to Supabase Storage (`documents` bucket) + `document_uploads` with `ai_status: pending` (no client-visible AI validation)
- Slot badges: Pending / Selected / Submitted (neutral — no Verified/Flagged on client UI)
- Preparer-driven **Action Required** card when admin sends a correction checklist (`client_corrections`)
- "Still Missing" alert with self-reminder trigger (logged to `reminders` + `activity_log`)
- Sonner toast feedback

## Magic Link Upload Portal (`/upload/:token`)
- Public, tokenized upload page — **equal priority** with authenticated `/portal`
- Resolves client by upload token; shows an expired-token state when invalid
- Same deferred select-then-submit flow as `/portal` — no client-visible AI validation or Analysis Summary
- On submit: batch upload via `persistClientDocumentPackage` + `submit_documents_via_token` RPC

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
  - Document Checklist — profession picker, **multi-year portal controls** (admin picks a prior year and **Enable on client portal**; enabled years shown as chips with Disable), per-year re-upload unlock, YoY test baseline seed, Run AI Review
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

## Outbox (`/email-queue`, admin + preparer)
- Renamed from "Email Queue" — shows all AI-drafted emails where `type = 'outbox'` (AI flags, wrong year, duplicates, etc.)
- Pending vs Sent tabs; "Generate Demo Emails" seeder stamps `type: 'outbox'`
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
- "Broder Mansoor Muqtadir, Inc." tab title and headers
- "Powered by SJ Innovation AI" footer

## Navigation
- Persistent dark navy sidebar with Broder Mansoor Muqtadir, Inc. branding and "Powered by SJ Innovation AI" footer
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
- Edge functions: `seed-demo-users` (demo auth + client seeding), `analyze-document` (mock AI + optional Claude fallback)

## Demo Data Seeding
- **Load Demo Data** button on `/dashboard` AND `/clients` runs `seedAllDemoData` which ensures **20 demo clients** exist (6 hand-crafted scenarios + 14 procedurally generated) and fully populates the app for each
- Per client the seeder produces: **2024 prior-year baseline uploads** (all verified) + **2025 requirements and current uploads** (verified / flagged / rejected mix), 2–4 AI flags across all four flag types with some pre-resolved (so the Flags page Resolved tab is populated), 3–5 email drafts (mix of pending and historical sent so Email Queue → Sent is populated), 15–22 activity_log entries across the four named AI agents + staff + client actors, multi-session `time_entries` (3–4 sessions per client) and 1–2 historical `reminders`
- Per-client `documents_submitted` / `issues` / `last_activity` are recomputed from the seeded data so dashboard counters stay accurate
- Seeder is idempotent — missing extra clients are inserted, and per-client data is cleared and re-seeded on each run
- **Seed Demo Emails** button on `/email-queue` adds 2 pending + 1 sent AI-drafted email per active client (populates both Pending and Sent tabs)

## Reminder System
- `/reminders` page with three tabs: Pending Approval, Cadence Settings, History
- Pending Approval tab backed by Supabase `email_drafts` filtered to `type = 'reminder'` — distinct from Outbox
- "Seed Demo Reminders" button creates `type: 'reminder'` drafts for testing
- `email_drafts.type` discriminator (`'outbox' | 'reminder'`) separates the two workflows; null treated as outbox for backwards compat
- Inline email editing before approval; actions write back to Supabase + log to `activity_log`
- Global cadence settings: first reminder delay, repeat interval, max sends (localStorage)
- "Exclude Abad's long-term clients" toggle — those clients marked Manual Only
- Per-client reminder overrides and Do Not Remind flag (localStorage)
- Reminder history log with sent/dismissed status (localStorage + seeded data)
- Sidebar Reminders badge reads `countPendingReminderDrafts()` from Supabase
- AdminDashboard "Remind" button updated to "Approve & Send" language; logs Manual Send to history

## Document Vault
- `/vault` page — two-panel layout (client list sidebar + document grid), mobile collapses to dropdown selector
- Real Supabase Storage integration — files stored at `clients/{id}/{year}/{type}/{filename}`
- Shared `uploadDocument()` utility (`src/utils/uploadDocument.ts`) used by all upload zones: validates before uploading, returns structured `UploadResult`
- `DocumentUpload` component and `MagicLinkPortal` now both use `uploadDocument` — no duplicate validation logic
- Per-file actions: download (signed URL, 1hr expiry), preview (signed URL in new tab), delete with confirmation dialog
- AI status badges per file: Verified, Wrong Year, Duplicate, Unexpected, Pending, Flagged, Rejected
- Empty state placeholder cards per doc type with "Send Upload Link" button (copies magic link to clipboard)
- Mock file data always present for demo; real Supabase uploads merged on top when available
- "Download All" (toast) and "Request Missing Docs" (→ /reminders) shortcuts in vault header
- Client pre-selection via `?client=` query param — AdminDashboard modal "Open in Vault →" button wires this
- Sidebar "Document Vault" nav item (folder icon) for admin + preparer

## E-Signatures (`/signatures`, admin + preparer)
- SignNow integration stub in `src/utils/signNowService.ts` — clearly marked `SIGNNOW INTEGRATION POINT` comments; only this file changes when the real API key arrives
- Three tabs: Pending (copy link, resend email, void), Completed (signer name, IP, timestamp, download receipt), Send Request (client dropdown, doc type auto-fill, delivery radio, optional note)
- Send Request tab pre-selects client via `?client=` query param (wired from Vault "Request Signature" button)
- Mock data seeded to localStorage on first visit (`sig_seeded` guard)
- Public signing page `/sign/:id` — no auth required; handles Pending → Confirmed → Declined flow
- Canvas signature pad (mouse + passive:false touch events for mobile)
- IP captured from `api.ipify.org` with `'0.0.0.0'` fallback; never blocks signing
- Signature status column on AdminDashboard client table (Signed/Pending/Declined/Not sent)
- "Request Signature" button on VaultPage right-panel header → `/signatures?client=<slug>`
- E-Signatures nav item (PenLine icon) in admin + preparer sidebar

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
- **Dual client access:** authenticated `/portal` (signup/login) and magic links are both supported equally.

## Phase 1 Handoff — Sean & Girik Testing

### Test client accounts (login at `/` → quick demo or Create Account)
| Account | Email | Password | Role |
|---------|-------|----------|------|
| Sean Test Client | `sean.test@brodermansoor.com` | `BMM-Demo-2026!` | client |
| Girik Test Client | `girik.test@brodermansoor.com` | `BMM-Demo-2026!` | client |
| John Smith (demo) | `john.smith@email.com` | `BMM-Demo-2026!` | client |

Run `seed-demo-users` edge function once to create/reset these accounts and seed 2024 baseline + 2025 checklist.

**Create Account** (email sign-up) requires a strong password (12+ chars, mixed case, number, symbol). Supabase rejects common passwords like `password123`. Example: `MyTax-Firm-2026!`

### Demo filenames to trigger AI flags (admin testing only)
Use these after a client submits — run **Run AI Review** on Client Detail as staff. Clients see no AI errors during upload.

| Filename | Expected result (admin review) |
|----------|-------------------------------|
| `W2_2024_JohnSmith.pdf` | Wrong year (2024 detected, 2025 required) |
| `BankStatement_Jan2025.pdf` | Unexpected document |
| Same filename uploaded twice | Duplicate |
| `W2_2025_Employer.pdf` in W-2 slot | Verified |
| `1099-NEC_2025.pdf` in W-2 slot | Wrong document type |

### Sample test files (download and upload)
After running the dev server or deploying, download these from `/sample-docs/`:

| File | URL path | Use for |
|------|----------|---------|
| `W2_2025_Goldman.pdf` | `/sample-docs/W2_2025_Goldman.pdf` | Verified W-2 upload |
| `W2_2024_Goldman.pdf` | `/sample-docs/W2_2024_Goldman.pdf` | Wrong year flag |
| `1099-NEC_2025.pdf` | `/sample-docs/1099-NEC_2025.pdf` | Wrong type (upload to W-2 slot) |
| `BankStatement_Jan2025.pdf` | `/sample-docs/BankStatement_Jan2025.pdf` | Unexpected document flag |
| `1098_2025_WellsFargo.pdf` | `/sample-docs/1098_2025_WellsFargo.pdf` | Verified 1098 upload |
| `ScheduleC_2025.pdf` | `/sample-docs/ScheduleC_2025.pdf` | Verified Schedule C upload |
| `K1_2025_AlphaPartnership.pdf` | `/sample-docs/K1_2025_AlphaPartnership.pdf` | Verified K-1 upload (if on checklist) |

Local: `http://localhost:8080/sample-docs/W2_2025_Goldman.pdf`  
Production: `https://brodermansoor.buildyourai.consulting/sample-docs/W2_2025_Goldman.pdf`

### Document replace
After submit, clients cannot change files unless the preparer unlocks the tax year. Before submit, clients can clear and re-select files per slot. Admins enable prior tax years individually on Client Detail (stored in `clients.portal_enabled_years`); YoY AI review still compares **2025 vs 2024** only.

### End-to-end flow
1. Sign in as test client → `/portal`
2. Select a file for each required checklist slot (any filename accepted — no client-side AI)
3. Click **Submit for Review** — files upload to storage and preparer is notified
4. Staff opens Client Detail → **Run AI Review** → **Send Correction Checklist** if needed
5. Client sees preparer correction on portal; staff approves email in Outbox
