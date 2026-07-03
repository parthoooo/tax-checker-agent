# Tax-Checker

AI-powered tax document management portal for a CPA firm hackathon demo. Clients upload tax documents; staff review them with AI-assisted flags, year-over-year comparison, magic-link uploads, and an internal workflow (outbox, reminders, vault).

**Stack:** Vite · React 18 · TypeScript · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Storage, Edge Functions)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 18+** and **npm** | [nvm](https://github.com/nvm-sh/nvm) recommended |
| **Git** | Clone and branch workflow (see [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)) |
| **Supabase account** | Free tier is enough for local dev ([supabase.com](https://supabase.com)) |
| **Supabase CLI** | Used via `npx supabase@latest` — no global install required |
| **Google Gemini API key** (optional) | Real PDF analysis in edge functions; mock fallback works without it |

There is **no local Supabase instance**. The app talks to a **remote** Supabase project configured in `.env`.

---

## Quick start (shared team backend)

If a teammate gives you a working `.env` (URL + anon/publishable key):

```sh
git clone https://github.com/parthoooo/tax-checker-agent.git
cd tax-checker-agent
npm install
cp .env.example .env   # then paste the shared values into .env
npm run dev
```

Open **http://localhost:8080** and sign in with a demo account (below).

---

## Full setup (your own Supabase project)

Use this when you want an isolated database and auth for development.

### 1. Clone and install

```sh
git clone https://github.com/parthoooo/tax-checker-agent.git
cd tax-checker-agent
npm install
npm run install-git-hooks   # optional: blocks accidental push to main
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Note the **Project URL**, **anon/public key**, and **project ref** (subdomain in the URL).

### 3. Configure environment

```sh
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

> Use the **anon** (publishable) key only. Never commit `.env` or put service-role keys in the frontend.

### 4. Log in to Supabase CLI

```sh
npx supabase@latest login
```

### 5. Apply schema, deploy functions, seed demo users

This runs migrations, deploys edge functions, and creates demo auth users:

```sh
npm run setup:supabase
```

You will be prompted for your database password when linking/pushing migrations.

**What `setup:supabase` does:**

- Links CLI to `VITE_SUPABASE_PROJECT_ID`
- Runs `db push` (all files in `supabase/migrations/`)
- Deploys edge functions: `analyze-document`, `analyze-client-documents`, `magic-link-upload`, `magic-link-download`, `seed-demo-users`
- Invokes `seed-demo-users` to create demo logins and client checklists

### 6. (Optional) Enable real PDF analysis

Without this, **Run AI Review** still works using a built-in mock engine.

```sh
# Get a free key: https://aistudio.google.com/apikey
npx supabase@latest secrets set GEMINI_API_KEY=your_key_here
```

Redeploy analysis functions after setting secrets:

```sh
npx supabase@latest functions deploy analyze-document --no-verify-jwt
npx supabase@latest functions deploy analyze-client-documents --no-verify-jwt
```

### 7. (Optional) Google sign-in

In the Supabase dashboard → **Authentication → Providers → Google**, enable OAuth and add your redirect URL:

- Local: `http://localhost:8080`
- Production: your deployed site URL

Email/password auth works without Google.

### 8. Run the app

```sh
npm run dev
```

App URL: **http://localhost:8080**

Other scripts:

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run lint` | ESLint |
| `npm run generate:sample-docs` | Regenerate demo PDFs in `public/sample-docs/` |

---

## Demo accounts

Password for all seeded demo users: **`TaxChecker-Demo-2026!`**

| Role | Email | After login |
|------|-------|-------------|
| Admin | `admin@tax-checker.demo` | `/dashboard` |
| Preparer | `preparer1@tax-checker.demo` | `/dashboard` |
| Preparer | `preparer2@tax-checker.demo` | `/dashboard` |
| Client | `client1@tax-checker.demo` | `/portal` |
| Client | `client2@tax-checker.demo` | `/portal` |
| Client | `client3@tax-checker.demo` | `/portal` |

The login page has **Quick demo login** buttons for these roles.

If demo login fails, re-run seeding:

```sh
curl -X POST "$VITE_SUPABASE_URL/functions/v1/seed-demo-users" \
  -H "Authorization: Bearer $VITE_SUPABASE_PUBLISHABLE_KEY" \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

(Use values from your `.env`.)

**New user sign-up:** Create Account on the login page → admin approves at `/clients/signups`. Sign-up passwords must be strong (12+ chars, mixed case, number, symbol), e.g. `MyTax-Firm-2026!`.

---

## Sample tax PDFs (testing uploads)

Pre-generated PDFs live in `public/sample-docs/` (employee, freelancer, partnership × 2024/2025).

- **Staff UI:** sign in as admin/preparer → sidebar **Sample PDFs** (`/staff/sample-docs`) → download bundles or individual files
- **Direct URLs:** e.g. `http://localhost:8080/sample-docs/employee/2025/W2_2025_Goldman.pdf`
- **Regenerate:** `npm run generate:sample-docs`

See [FEATURES.md](./FEATURES.md) for filenames that trigger specific AI flags during staff review.

---

## Roles and main routes

| Role | Access |
|------|--------|
| **client** | `/portal` — upload checklist, submit for review |
| **preparer** | Dashboard, vault, flags, outbox, reminders, clients assigned to them |
| **admin** | Everything preparer has + all clients, sign-up approvals, admin settings |

| Route | Who |
|-------|-----|
| `/` | Login (or redirect by role) |
| `/portal` | Clients |
| `/upload/:token` | Public magic-link upload (no login) |
| `/dashboard` | Admin, preparer |
| `/clients`, `/clients/signups`, `/admin` | Admin |
| `/staff/sample-docs` | Admin, preparer |

Full feature list: [FEATURES.md](./FEATURES.md).

**Admin operations:** step-by-step guide for all admin features (users, documents, communications, and the three client profession types) → [docs/ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md).

---

## Project structure

```
tax-checker-agent/
├── public/sample-docs/     # Demo PDFs served statically
├── scripts/
│   ├── setup-personal-supabase.sh   # Migrations + function deploy + seed
│   └── generate-sample-tax-pdfs.mjs
├── src/
│   ├── components/         # UI (admin, client, layout)
│   ├── contexts/           # AuthContext
│   ├── lib/                # DB helpers, tax config, sample docs
│   ├── pages/              # Route pages
│   └── integrations/supabase/client.ts  # Supabase client (reads .env)
└── supabase/
    ├── migrations/         # Postgres schema + RLS + RPCs
    └── functions/          # Edge functions (AI, magic link, seed)
```

---

## Typical dev workflow

1. **Client flow:** Log in as `client1@tax-checker.demo` → `/portal` → select files per checklist slot → **Submit for Review**.
2. **Staff flow:** Log in as admin → **Clients** → open client → **Run AI Review** → handle flags in **AI Flags** / **Outbox**.
3. **Magic link:** From client detail or vault, copy upload link → open in incognito → same submit flow without login.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Blank app / auth errors | Check `.env` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; restart `npm run dev` |
| Demo login fails | Run `npm run setup:supabase` or invoke `seed-demo-users` (see above) |
| Magic link preview/download 404 | Deploy `magic-link-download`: `npx supabase@latest functions deploy magic-link-download --no-verify-jwt` |
| Upload fails | Confirm migrations applied (`npm run setup:supabase`); check browser network tab for RLS/storage errors |
| AI review always “mock” | Set `GEMINI_API_KEY` secret and redeploy `analyze-document` / `analyze-client-documents` |
| Port in use | Dev server uses **8080** (`vite.config.ts`); stop other process or change port there |

---

## Git workflow

- Work on feature branches; open PRs into `main` (no direct pushes to `main`).
- Install hook: `npm run install-git-hooks`
- Details: [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)

---

## Deploy

Build static assets:

```sh
npm run build
```

Host `dist/` on any static host (Vercel, Netlify, S3, etc.). Set the same `VITE_*` env vars at build time. Point the site URL in Supabase Auth redirect allowlist if using Google OAuth.

Edge functions and database changes are applied with the Supabase CLI (`npm run setup:supabase` or individual `db push` / `functions deploy` commands).

---

## License

Hackathon / internal demo project. See repository owner for usage terms.
