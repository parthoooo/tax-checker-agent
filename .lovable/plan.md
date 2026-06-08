## Magic Links Tab + Hide Client Login

The DB-backed `/upload/:token` portal already works. This plan only adds the admin-facing Magic Links surface and dials back the client login.

### 1. Add "Magic Links" tab to `/clients/:id`

File: `src/pages/admin/ClientDetail.tsx`

- Add a sixth `<TabsTrigger value="magic-links">Magic Links</TabsTrigger>` after "Internal Notes".
- New `<TabsContent value="magic-links">` renders a card with:
  - Header row: client's current token status (`Active until <date>` or `No active link`) + **Generate / Regenerate Link** button → calls existing `generateMagicToken(client.id)`, refreshes client, toasts.
  - **Copy Master Link** button → copies `https://brodermansoor.buildyourai.consulting/upload/<token>` to clipboard.
  - Table of pending docs (filter `requirements` where no matching `uploads` row exists). Per row:
    - Doc type + tax year badge
    - Status pill: `Not sent` / `Link sent` / `Uploaded` (derived from uploads + a local `sentTokens` Set kept in component state for the session)
    - **Copy Link** button — same master URL (the portal handles all docs for this token).
    - **Send via Email** button — toast `Link sent to <client.email>`, marks row as `Link sent`, writes an `activity_log` entry via `logActivity` (`Magic link emailed for <docType>`).
  - **Send All Pending** button at top → toast `Links queued for N pending documents` + activity log.

No DB schema changes. Reuses `generateMagicToken`, `logActivity`, and existing token columns on `clients`.

### 2. Hide client login from nav (keep code intact)

- `src/components/Login.tsx`: comment out / remove the "John (Client)" quick-login button only. Leave the `handleQuickLogin('client')` handler.
- `src/components/layout/AppSidebar.tsx`: keep `clientNav` array but it's already gated by role — no change needed since admins/preparers never see it. (No-op; documented for clarity.)
- `src/App.tsx`: leave `/portal` route in place (dormant). No deletion.

### 3. Docs

- `FEATURES.md`: add **Magic Link Upload** section noting:
  - Public `/upload/:token` route, no auth.
  - Admin generates/copies/emails links from Client Detail → Magic Links tab.
  - Client login deprecated in favor of magic links (still routable for future use).

### Out of scope (explicit)

- No changes to `MagicLinkPortal.tsx`, `AdminDashboard`, `ClientDashboard`, `AuthContext`.
- No real email sending (toast only; same mock pattern as ReminderModal).
- No new mock `MOCK_UPLOAD_LINKS` table — we use real DB tokens.
- No per-doc tokens (one token per client covers all their pending docs, matching current portal behavior).

### Technical notes

- "Link sent" state is session-only (`useState<Set<string>>`). A real `magic_link_sends` table can come later if persistence is needed.
- All buttons use `sonner` `toast`, shadcn `Button`, `Badge`, `Card`.
- Mobile responsive via existing Tailwind utility patterns in the file.
