# Tax-Checker — Admin Guide

Step-by-step guide for **admins** (and preparers where noted). Use this to onboard clients, collect documents, run AI review, and manage firm operations.

**Current tax year:** 2025 · **Prior year for YoY compare:** 2024

---

## Table of contents

1. [Before you start](#before-you-start)
2. [Category 1 — Users & client management](#category-1--users--client-management)
3. [Category 2 — Documents & AI review](#category-2--documents--ai-review)
4. [Category 3 — Communications & operations](#category-3--communications--operations)
5. [Profession guides (three client types)](#profession-guides-three-client-types)
6. [End-to-end workflows](#end-to-end-workflows)
7. [Quick reference](#quick-reference)

---

## Before you start

### Sign in as admin

1. Open the app (local: `http://localhost:8080`).
2. Sign in with:
   - **Email:** `admin@tax-checker.demo`
   - **Password:** `TaxChecker-Demo-2026!`
3. Or use **Quick demo login → Admin** on the login page.

You land on **Dashboard** (`/dashboard`).

**Open the in-app guide:** Dashboard → blue **Admin Guide** card or header button **Admin Guide** → `/admin/guide`. Also in the sidebar under **Admin Guide** (above **Admin** settings).

### Admin vs preparer

| Capability | Admin | Preparer |
|------------|:-----:|:--------:|
| Dashboard, Vault, Flags, Outbox, Reminders, Activity | ✓ | ✓ |
| All Clients (`/clients`) | ✓ | — (assigned clients on dashboard only) |
| Sign-up Approvals | ✓ | — |
| Client Detail (`/clients/:id`) | ✓ | ✓ |
| Admin Settings (`/admin`) | ✓ | — |
| Sample PDFs (`/staff/sample-docs`) | ✓ | ✓ |
| Enable prior years / change profession | ✓ | ✓ (on Client Detail) |
| Delete client | ✓ | — |

### Sidebar map (admin)

| Menu item | Route | Purpose |
|-----------|-------|---------|
| Dashboard | `/dashboard` | Firm overview, AI feed, client table |
| All Clients | `/clients` | Search, add, delete clients |
| Document Vault | `/vault` | All files by client |
| Sample PDFs | `/staff/sample-docs` | Download test PDFs |
| AI Flags | `/flags` | Cross-client flag queue |
| Outbox | `/email-queue` | Approve AI-drafted emails |
| Reminders | `/reminders` | Missing-doc reminder drafts |
| Activity Log | `/activity` | Audit trail |
| Admin Guide | `/admin/guide` | This manual (in-app) |
| Admin | `/admin` | Settings & integrations |
| Profile | `/profile` | Your name / phone |

---

## Category 1 — Users & client management

Everything related to **who** can use the portal and **how client records** are set up.

### 1.1 Approve new sign-ups

New users who use **Create Account** or **Continue with Google** wait for admin approval.

**Steps:**

1. Go to **All Clients** → **Sign-up Approvals** (or `/clients/signups`).
2. Review each pending request (name, email, sign-up method).
3. Click **Approve** → choose role:
   - **Client** — portal access + document checklist (most common).
   - **Preparer** — staff dashboard; sees assigned clients.
   - **Admin** — full access.
4. Or click **Reject** → optional reason.

**After approval:** User signs in at `/` and is routed by role (client → `/portal`, staff → `/dashboard`).

**Tip:** Pending sign-ups show a badge count on the Clients page when approvals are waiting.

---

### 1.2 Add a client manually

Use when you onboard someone without self-sign-up.

**Steps:**

1. Go to **All Clients** (`/clients`).
2. Click **Add Client**.
3. Enter **Name**, **Email**, optional **Phone**, optional **Assigned staff**.
4. Click **Save**.

**What happens:** A `clients` row is created with default status `active` and business type `freelancer`. You should open **Client Detail** next to set the correct profession (see [Profession guides](#profession-guides-three-client-types)).

**Note:** This does not create a Supabase Auth login. The client still needs **Create Account** (same email) or you share a **magic link** for uploads without login.

---

### 1.3 View and manage the client list

**Steps:**

1. Go to **All Clients**.
2. Use **search** by name.
3. Filter tabs: **All** · **Active** · **Overdue** · **Complete**.
4. Per row you see: progress (`submitted/required`), AI issue count, assigned staff, last activity.
5. Actions:
   - **View** → Client Detail.
   - **Remind** → opens reminder email modal.
   - **Delete** (admin) → permanently removes client data (uploads, flags, links; auth account is **not** deleted).

---

### 1.4 Edit client profile and assignment

**Steps:**

1. Open **Client Detail** (`/clients/:id`).
2. Click **Edit client** on the info card.
3. Update **Name**, **Email**, **Phone**, **Assigned staff**, **Status** (`active` / `overdue` / `complete`).
4. Save.

**Header actions:**

- **Copy Portal Link** — magic upload URL for the client (generates token if needed).
- **Send Reminder** — manual reminder modal.
- **Time Tracker** — auto-starts while you are on this page (logged to `time_entries`).

---

### 1.5 Set business type (profession)

The profession controls which documents appear on the client checklist.

**Steps:**

1. Client Detail → **Document Checklist** tab.
2. Under **Business / profession**, select:
   - **Employee (W-2)**
   - **Freelancer / Self-employed**
   - **Partnership / K-1**
3. Saving updates `document_requirements` for the current tax year and **locks profession** on the client portal (client cannot change it).

**To let the client change profession again:** Click **Unlock profession on portal**.

See [Profession guides](#profession-guides-three-client-types) for required documents per type.

---

### 1.6 Enable prior tax years on the portal

Clients always see **2025**. Prior years appear only when you enable them.

**Steps:**

1. Client Detail → **Document Checklist**.
2. Under **Tax year**, pick a prior year (e.g. 2024).
3. Click **Enable on client portal**.
4. Enabled years show as chips — click **Disable** to remove.

**Limits:** Up to 30 prior years back from current. YoY AI review compares **2025 vs 2024** only.

**Optional — seed prior-year baseline for testing:**

1. Select year (e.g. 2024).
2. Click **Set up {year} test baseline**.
3. Creates verified placeholder uploads for YoY comparison (client does not upload these).

---

### 1.7 Allow client to re-upload after submit

After **Submit for Review**, clients cannot replace files until you unlock.

**Steps:**

1. Client Detail → **Document Checklist**.
2. If the year was submitted, you see **Allow {year} re-upload**.
3. Click it — client can select new files and submit again.

---

### 1.8 Admin Settings (`/admin`)

| Tab | What you can do today |
|-----|------------------------|
| **User Management** | View demo users; **Invite User** modal (demo toast) |
| **Document Types** | View W-2, 1099-NEC, 1098, K-1, Schedule C list |
| **CCH Integration** | Placeholder — API key pending |
| **Outlook** | Placeholder — OAuth per preparer pending |
| **Branding** | Firm name, copy portal URL, logo upload (demo save) |

Real user invites and integrations are planned; sign-up approval and manual client add are the live paths today.

---

## Category 2 — Documents & AI review

Everything related to **collecting tax documents**, **storage**, **AI analysis**, and **corrections**.

### 2.1 How clients submit documents

Clients use one of two paths (both supported equally):

| Path | Who | URL |
|------|-----|-----|
| **Authenticated portal** | Logged-in client | `/portal` |
| **Magic link** | Anyone with link | `/upload/:token` |

**Client flow (same for both):**

1. See checklist for selected tax year.
2. **Select a file** per slot (nothing uploads yet).
3. Click **Submit for Review** — batch upload to Supabase Storage + database.

**Important:** Clients do **not** see AI errors during upload. All validation runs on the staff side after submit.

---

### 2.2 Send magic upload links

**From Client Detail:**

1. Open **Magic Links** tab.
2. Click **Generate / Regenerate Link**.
3. **Copy link** or use per-document **Copy Link** / **Send via Email** (logs activity).
4. **Send All Pending** — marks unsent checklist items as link-sent.

**From Document Vault:**

1. `/vault` → select client.
2. Empty slots show **Send Upload Link** — copies magic URL.

**Link format:** `{your-site}/upload/{token}`

---

### 2.3 Document Vault (`/vault`)

Central file browser for all clients.

**Steps:**

1. Open **Document Vault** from sidebar.
2. Select client (left panel or mobile dropdown).
3. Optional: deep-link with `?client={clientId}` from Client Detail.

**Per file:**

| Action | Effect |
|--------|--------|
| **Preview** | Opens signed URL in new tab |
| **Download** | Signed URL download (1 hour) |
| **Delete** | Removes from storage + database (confirm dialog) |

**Header shortcuts:**

- **Download All** — toast confirmation (demo).
- **Request Missing Docs** — navigates to Reminders.

**AI status badges:** Verified · Wrong Year · Duplicate · Unexpected · Pending · Flagged · Rejected

---

### 2.4 Download sample test PDFs

**Steps:**

1. Go to **Sample PDFs** (`/staff/sample-docs`).
2. Choose profession tab: **Employee** · **Freelancer** · **Partnership** · **Other**.
3. **Download** single file, **Download bundle** (per year), or **Download all**.

Use these to test client upload and AI review without creating real tax forms.

---

### 2.5 Run AI Review (after client submits)

**When:** Client has clicked **Submit for Review** for the current year.

**Steps:**

1. Client Detail → **Document Checklist**.
2. Click **Run AI Review**.
3. Wait for **Analysis Summary** (Gemini if configured, otherwise mock engine).
4. Review:
   - Per-document status (verified, wrong year, duplicate, unexpected).
   - Year-over-year amount changes (2025 vs 2024).
5. If issues found → **Send correction to client** (opens message dialog).
6. To remove correction from portal → **Clear correction from portal**.

**Checklist table** below the summary shows each requirement, AI result, filename, preview, and link to Vault.

---

### 2.6 Send correction checklist to client

**Steps:**

1. Run AI Review (correction button stays disabled until a result exists).
2. Click **Send correction to client**.
3. Edit the message if needed → **Send**.
4. Client sees **Action Required** on `/portal` with your instructions.

Resolve when fixed: **Clear correction from portal** or after client re-submits and you re-run review.

---

### 2.7 AI Flags page (`/flags`)

Cross-client queue of all open issues.

**Steps:**

1. Open **AI Flags**.
2. Review summary cards: Wrong Year · Duplicates · Unexpected · Missing.
3. Filter by type or switch **Open** / **Resolved**.
4. Per flag, primary action (demo):
   - Wrong Year → Send Correction Request
   - Duplicate → Auto-Remove Duplicates
   - Unexpected → Remove File
   - Missing → Send Reminder
5. **Mark Resolved** — closes the flag and logs activity.

Flags also appear on Client Detail → **AI Flags** tab.

---

### 2.8 Input Sheet (Client Detail tab)

**Purpose:** Tax data rows extracted from uploaded PDFs for preparer verification.

**Steps:**

1. Client Detail → **Input Sheet**.
2. After uploads exist, rows populate (W-2 wages, 1099 amounts, etc.).
3. Click **Verify** per row when confirmed.

Backed by `input_sheet_entries` in the database.

---

### 2.9 Reset current-year documents (testing)

**Steps:**

1. Client Detail → **Document Checklist** → **Reset 2025 Documents**.
2. Confirm.

**Removes:** All 2025 uploads, AI flags, pending outbox drafts for that client, storage files.  
**Keeps:** Client account, magic links, 2024 baseline.

---

## Category 3 — Communications & operations

Dashboard monitoring, email approval, reminders, audit trail, and firm settings.

### 3.1 Dashboard (`/dashboard`)

**What you see:**

- ROI / time-saved banner (demo metrics).
- **AI Agent Team** banner (Doc Classifier, Duplicate Detector, etc.).
- **AI Agent Activity Feed** — live staff/AI actions.
- **Needs Your Attention** — recent AI flag cards.
- **Client table** — progress, status, flag counts, **Remind** button.
- Click a client row → **Client detail modal** or open in vault.

**Preparer view:** Same layout but table filtered to **assigned clients** only.

---

### 3.2 Outbox (`/email-queue`)

AI-drafted emails that need human approval before “sending” (demo logs send; no real SMTP unless Outlook is connected).

**Steps:**

1. Open **Outbox** (badge = pending count).
2. Tabs: **Pending** · **Sent**.
3. Click a draft → edit **Subject** and **Body**.
4. **Approve & Send** — marks sent, logs to Activity Log.
5. **Dismiss** — discards draft.

**Sources:** AI flags, wrong-year notices, duplicate alerts, correction follow-ups (`email_drafts` where `type = 'outbox'`).

---

### 3.3 Reminders (`/reminders`)

Separate from Outbox — focused on **missing document** nudges.

**Tabs:**

| Tab | Purpose |
|-----|---------|
| **Pending Approval** | `email_drafts` with `type = 'reminder'` — approve or dismiss |
| **Cadence Settings** | First delay, repeat interval, max sends (saved in browser localStorage) |
| **History** | Past sent/dismissed reminders (localStorage + seed data) |

**Steps (pending reminder):**

1. Expand draft → edit body if needed.
2. **Approve & Send** or **Dismiss**.
3. Action logs to Activity Log.

**Cadence tab:** Toggle **Exclude Abad's long-term clients**, per-client overrides, **Do Not Remind** flags.

**Manual remind:** Dashboard or Client Detail → **Send Reminder** / **Remind**.

---

### 3.4 Activity Log (`/activity`)

**Steps:**

1. Open **Activity Log**.
2. Search by client name.
3. Filter: **All** · **AI** · **Staff** · **Client**.
4. Review chronological actions (uploads, flags, emails, magic links, etc.).

Client Detail also has a per-client **Activity Log** tab.

---

### 3.5 Internal notes

**Steps:**

1. Client Detail → **Internal Notes**.
2. Type notes (staff-only; not visible to client).
3. Save — confirmation toast.

---

### 3.6 Profile (`/profile`)

**Steps:**

1. Sidebar → **Profile**.
2. Edit **Name** and **Phone** → **Save** (persists to database + auth metadata).
3. Email and role are read-only.

---

## Profession guides (three client types)

Choose the correct **Business / profession** on Client Detail before the client uploads. Each type has a fixed checklist for **2025** (and enabled prior years).

### Type A — Employee (W-2)

**Best for:** Salaried employees with W-2 income, mortgage interest, and bank interest.

| Slot | Document |
|------|----------|
| 1 | W-2 |
| 2 | 1098 Mortgage Interest |
| 3 | 1099-INT |

**Sample PDFs:** Sidebar → **Sample PDFs** → **Employee** → download **2025** bundle.

**Files (2025 folder):**

- `W2_2025_Goldman.pdf`
- `1098_2025_WellsFargo.pdf`
- `1099-INT_2025_Fidelity.pdf`

**Admin setup checklist:**

1. Set profession → **Employee (W-2)**.
2. (Optional) Enable **2024** + **Set up 2024 test baseline** for YoY.
3. Send magic link or ask client to log in → upload three files → **Submit for Review**.
4. **Run AI Review** → verify all green → approve in Outbox if drafts appear.

---

### Type B — Freelancer / Self-employed

**Best for:** 1099 contractors with possible W-2 side job, mortgage, and Schedule C business income.

| Slot | Document |
|------|----------|
| 1 | W-2 |
| 2 | 1099-NEC |
| 3 | 1098 Mortgage Interest |
| 4 | Schedule C |

**Sample PDFs:** **Sample PDFs** → **Freelancer** → **2025** bundle.

**Files (2025 folder):**

- `W2_2025_Goldman.pdf`
- `1099-NEC_2025_BrightPath.pdf`
- `1098_2025_WellsFargo.pdf`
- `ScheduleC_2025_SmithDesign.pdf`

**Default for new clients:** Manual **Add Client** defaults to freelancer until you change it.

---

### Type C — Partnership / K-1

**Best for:** Partners with K-1 income plus freelancer-style documents.

| Slot | Document |
|------|----------|
| 1 | W-2 |
| 2 | 1099-NEC |
| 3 | 1098 Mortgage Interest |
| 4 | Schedule C |
| 5 | K-1 Partnership |

**Sample PDFs:** **Sample PDFs** → **Partnership** → **2025** bundle.

**Extra file (2025):**

- `K1_2025_AlphaPartnership.pdf`

**YoY tip:** Upload 2024 and 2025 K-1 samples; Run AI Review shows ordinary business income change ($12,450 → $18,920 in demo data).

---

### Testing AI flags (all types)

After client submit, use these files from **Sample PDFs → Other** or root `/sample-docs/`:

| Upload this file | To this slot | Expected AI result |
|------------------|--------------|-------------------|
| `W2_2024_Goldman.pdf` | W-2 (2025 year) | Wrong year |
| `BankStatement_Jan2025.pdf` | Any | Unexpected document |
| Same file twice | Two slots | Duplicate |
| `1099-NEC_2025.pdf` | W-2 slot | Wrong document type |
| Correct year/type PDF | Matching slot | Verified |

---

## End-to-end workflows

### Workflow 1 — New client from sign-up to complete

```
Sign-up Approvals → Approve as Client
    → Client Detail → set Profession
    → Magic Links → Generate → email link
    → Client uploads + Submit for Review
    → Run AI Review
    → (if issues) Send correction → Outbox approve emails
    → Mark flags Resolved → set Status Complete
```

### Workflow 2 — Employee with YoY review

```
Client Detail → Employee profession
    → Enable 2024 + Set up 2024 test baseline
    → Client uploads 2025 employee bundle → Submit
    → Run AI Review → read YoY wage/interest deltas
    → Input Sheet → Verify rows
```

### Workflow 3 — Missing documents

```
Dashboard → see low progress
    → Remind (manual) OR wait for Reminders pending tab
    → Approve reminder email
    → Activity Log confirms send
```

### Workflow 4 — Magic-link-only client (no login)

```
Add Client (name + email)
    → Magic Links → Generate → Copy link
    → Client opens /upload/:token → submit docs
    → Vault / Client Detail → Run AI Review
```

---

## Quick reference

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@tax-checker.demo` | `TaxChecker-Demo-2026!` |
| Preparer | `preparer1@tax-checker.demo` | same |
| Client | `client1@tax-checker.demo` | same |

### Key routes

| Task | Route |
|------|-------|
| Approve sign-ups | `/clients/signups` |
| Client list | `/clients` |
| Client workbench | `/clients/:id` |
| All files | `/vault` |
| Test PDFs | `/staff/sample-docs` |
| Flag inbox | `/flags` |
| Email approval | `/email-queue` |
| Reminders | `/reminders` |
| Settings | `/admin` |

### Client-visible vs staff-only

| Feature | Client sees | Staff sees |
|---------|:-----------:|:----------:|
| Upload / submit | ✓ | ✓ (vault) |
| AI errors on upload | — | ✓ (after review) |
| YoY analysis | — | ✓ |
| Action Required correction | ✓ | ✓ |
| Internal notes | — | ✓ |
| Outbox / Reminders | — | ✓ |
| Input Sheet | — | ✓ |

### When something fails

| Problem | Action |
|---------|--------|
| Magic link preview 404 | Redeploy `magic-link-download` edge function (see [README](../README.md)) |
| Demo login fails | Run `npm run setup:supabase` or invoke `seed-demo-users` |
| AI always "mock" | Set `GEMINI_API_KEY` in Supabase secrets |
| Client can't re-upload | **Allow {year} re-upload** on Client Detail |

---

## Related docs

- [README.md](../README.md) — Developer setup and environment
- [FEATURES.md](../FEATURES.md) — Full feature inventory (engineering)
- [GIT_WORKFLOW.md](../GIT_WORKFLOW.md) — Branch and PR policy

---

*Last updated for Tax-Checker hackathon demo. Update this guide when admin-facing flows change.*
