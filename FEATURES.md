# Broder-Mansoor Portal — Features

Living document of all features currently shipped in this app. Update this file in the same change whenever a feature is added, removed, or materially changed.

## Authentication
- Mock auth via `AuthContext` with localStorage persistence
- Standard email/password login (`john.smith@email.com`, `nick@brodermansoor.com`, password `password123`)
- Quick demo login buttons: "Login as Nick (Admin)" and "Login as Client (Demo)"
- Role-based routing (admin → AdminDashboard, client → ClientDashboard)
- Logout

## Client Dashboard
- Document checklist (W-2, 1099-NEC, etc.) with progress tracking
- Drag-and-drop document upload with drag hint on W-2 row
- Simulated AI analysis on upload (1.5s) with three outcomes:
  - Wrong Year detection (e.g. `W2_2023_*`)
  - Duplicate detection
  - Verified success
- Dynamic result banners per upload
- "Still Missing" alert box with self-reminder trigger
- Sonner toast feedback

## Admin Dashboard
- Animated ROI hero banner (14.5 hours / $406 saved)
- "Client Portal: brodermansoor.buildyourai.consulting" sub-header
- AI Agent Team Banner (collapsible) — 4 agents: Doc Classifier, Duplicate Detector, Missing Doc Tracker, Follow-up Sender
- Live AI Agent Activity Feed (auto-updates every 4s, max 12 entries)
- "Needs Your Attention" AI flag cards: Wrong Year, Duplicates, Unnecessary File — with interactive toasts
- Client management table with 5 realistic clients (John Smith, Michael Brown, Sarah Johnson, Robert Chen, Maria Rodriguez), progress, status, flag counts
- "Remind" button → pre-filled email reminder modal
- Client detail modal

## Branding
- "Broder-Mansoor" tab title and headers
- "Powered by SJ Innovation AI" footer

## Navigation
- Persistent dark navy sidebar with Broder-Mansoor branding and "Powered by SJ Innovation AI" footer
- Admin sidebar: Dashboard, Clients, AI Flags, Activity Log, Admin, Profile, Logout
- Client sidebar: My Documents, Profile, Logout
- Active route highlighted with blue left border and lighter background
- Mobile hamburger toggle with slide-in overlay
- Role-protected routes

## Admin Pages
- `/clients` — All-clients list with search, status filter tabs, progress bars, AI issue counts, assigned staff, relative last activity, View + Remind actions, "Add Client" modal
- `/clients/:id` — Client detail with header (status, staff, Send Reminder, Back) and 4 tabs: Document Checklist, AI Flags, Activity Log, Internal Notes (save toast, pre-existing note)
- `/flags` — All AI flags with severity badges, type filter tabs, Open/Resolved views, summary stat cards, action buttons (Send Correction / Auto-Remove / Remove File / Send Reminder / Mark Resolved)
- `/activity` — Cross-client activity timeline (15 entries) with search by client and AI/Staff/Client type filter, color-coded actor avatars
- `/admin` — Settings with 4 tabs: User Management (invite modal), TaxDome Integration (masked API key), Document Types, Branding (firm name, copyable portal URL, logo upload, save toast)

## Profile
- `/profile` — Shared profile page for admin and client: avatar initials, editable name/phone, read-only email, role badge; admin sees read-only Tax Season

## Tech / UI
- React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- React Router v6 with nested layout routes
- Sonner toasts, Lucide icons

---

## Maintenance rule
Every PR/change that adds or materially changes a user-facing feature must update this file in the same commit. Group entries under the appropriate section (add a new section if needed). Keep entries one line and user-facing.
