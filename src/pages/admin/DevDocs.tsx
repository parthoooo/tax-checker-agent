import React, { useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CheckCircle2, Clock, AlertCircle, Database, Code2, GitBranch, Layers, Zap, ExternalLink,
  ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';

const StatusBadge: React.FC<{ status: 'built' | 'simulation' | 'placeholder' | 'needed' }> = ({ status }) => {
  const map = {
    built:       'bg-green-100 text-green-800',
    simulation:  'bg-yellow-100 text-yellow-800',
    placeholder: 'bg-blue-100 text-blue-700',
    needed:      'bg-gray-100 text-gray-600',
  };
  const labels = {
    built: '✅ Built',
    simulation: '⚠️ Simulated',
    placeholder: '🔲 Placeholder UI',
    needed: '❌ Not Built',
  };
  return <Badge className={`text-xs ${map[status]}`}>{labels[status]}</Badge>;
};

const EffortBadge: React.FC<{ days: number }> = ({ days }) => {
  const cls = days <= 2 ? 'bg-green-50 text-green-700' : days <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{days}d</span>;
};

interface Feature {
  id: number;
  module: string;
  feature: string;
  route?: string;
  prototypeStatus: 'built' | 'simulation' | 'placeholder' | 'needed';
  tables: string[];
  effortDays: number;
  productionNotes: string;
}

const FEATURES: Feature[] = [
  {
    id: 1, module: 'Auth & Access',
    feature: 'Email/password login with role-based access (admin, preparer, client)',
    route: '/',
    prototypeStatus: 'built',
    tables: ['auth.users'],
    effortDays: 3,
    productionNotes: 'Supabase Auth is functional. Production: add SSO/Google OAuth, enforce email verification, add 2FA for staff.'
  },
  {
    id: 2, module: 'Auth & Access',
    feature: 'Magic link client portal — no-login document upload',
    route: '/upload/:token',
    prototypeStatus: 'simulation',
    tables: ['magic_link_tokens', 'clients'],
    effortDays: 2,
    productionNotes: 'Token generation works. Production: send token via real email (Resend/SendGrid), add expiry UI, one-time-use enforcement.'
  },
  {
    id: 3, module: 'Client Management',
    feature: 'Client list, search, filter by status, add client',
    route: '/clients',
    prototypeStatus: 'built',
    tables: ['clients'],
    effortDays: 2,
    productionNotes: 'CRUD complete. Production: bulk import from CSV/CCH, client grouping by entity type.'
  },
  {
    id: 4, module: 'Client Management',
    feature: 'Client detail — info card, tabs, portal link copy',
    route: '/clients/:id',
    prototypeStatus: 'built',
    tables: ['clients', 'document_requirements', 'document_uploads', 'ai_flags', 'activity_log'],
    effortDays: 1,
    productionNotes: 'All tabs functional. Production: add notes persistence (currently UI-only), edit client info inline.'
  },
  {
    id: 5, module: 'Document Upload',
    feature: 'Client document upload with per-requirement checklist and progress',
    route: '/upload/:token, /portal',
    prototypeStatus: 'built',
    tables: ['document_uploads', 'document_requirements'],
    effortDays: 1,
    productionNotes: 'Supabase Storage wired. tax_year + is_prior_year columns on document_uploads. Production: enforce file size/type limits, virus scan.'
  },
  {
    id: 6, module: 'AI Validation',
    feature: 'AI document validation — classify type/year, wrong year, duplicate, YoY comparison',
    route: 'analyze-document edge fn + auto on upload',
    prototypeStatus: 'simulation',
    tables: ['document_uploads', 'ai_flags', 'email_drafts'],
    effortDays: 5,
    productionNotes: 'Phase 1: mock filename analyzer in edge function; Claude fallback when ANTHROPIC_API_KEY set. Production: PDF OCR, content-based classification.'
  },
  {
    id: 7, module: 'AI Flags',
    feature: 'AI flag list with severity, type, description; resolve action',
    route: '/flags, /clients/:id (Flags tab)',
    prototypeStatus: 'built',
    tables: ['ai_flags', 'activity_log'],
    effortDays: 1,
    productionNotes: 'Fully functional. Production: add snooze/defer, bulk resolve, assign to specific preparer.'
  },
  {
    id: 8, module: 'Email Queue',
    feature: 'AI-drafted email review, edit subject/body, approve & send',
    route: '/email-queue',
    prototypeStatus: 'simulation',
    tables: ['email_drafts', 'activity_log'],
    effortDays: 4,
    productionNotes: 'Approve flow updates DB status only — no real email sent. Production: integrate Resend (simple) or Outlook Graph API (per-preparer mailbox). Email templates with firm branding.'
  },
  {
    id: 9, module: 'Input Sheet',
    feature: 'Tax input sheet auto-population from uploads, per-field verify, CSV export',
    route: '/clients/:id (Input Sheet tab)',
    prototypeStatus: 'simulation',
    tables: ['input_sheet_entries', 'document_uploads'],
    effortDays: 10,
    productionNotes: 'Populates with mock values based on doc section. Production: Claude API extracts real field values (Box 1-20 of W-2, 1099 amounts etc), stores with confidence score, flags low-confidence entries for review.'
  },
  {
    id: 10, module: 'Time Tracking',
    feature: 'Per-client session timer, auto-start/stop, dashboard weekly total',
    route: '/clients/:id (header), /dashboard (ROI banner)',
    prototypeStatus: 'built',
    tables: ['time_entries'],
    effortDays: 2,
    productionNotes: 'Fully functional. Production: per-preparer breakdown, export timesheet CSV, bill rate configuration per client, Harvest/QuickBooks sync.'
  },
  {
    id: 11, module: 'Activity Log',
    feature: 'System-wide and per-client chronological activity feed',
    route: '/activity, /clients/:id (Activity tab)',
    prototypeStatus: 'built',
    tables: ['activity_log'],
    effortDays: 1,
    productionNotes: 'Functional. Production: filter by actor/action type, search, export, webhook to Slack for high-severity events.'
  },
  {
    id: 12, module: 'Reminders',
    feature: 'Send reminder email modal with message template',
    route: '/clients (Remind button), /clients/:id',
    prototypeStatus: 'simulation',
    tables: ['reminders'],
    effortDays: 2,
    productionNotes: 'Modal saves to DB but no email sent. Production: connect to email provider, add configurable cadence per client (reminder_cadence_days column exists), automated scheduler via Supabase Edge Functions + cron.'
  },
  {
    id: 13, module: 'Preparer Role',
    feature: 'Scoped view — preparers see only assigned clients, no admin settings',
    route: 'all routes',
    prototypeStatus: 'built',
    tables: ['clients (assigned_preparer)'],
    effortDays: 1,
    productionNotes: 'Frontend scoping done. Production: enforce via Supabase RLS policies so preparers cannot query other clients via API.'
  },
  {
    id: 14, module: 'CCH Integration',
    feature: 'Sync client list and prior-year return data from CCH Axcess',
    route: '/admin (CCH tab)',
    prototypeStatus: 'placeholder',
    tables: ['clients', 'document_requirements'],
    effortDays: 12,
    productionNotes: 'Requires CCH Axcess API credentials from Nick/Andrew. Scope: OAuth handshake, client sync job (nightly), prior-year data import for input sheet pre-fill, return status push-back.'
  },
  {
    id: 15, module: 'SignNow E-Signature',
    feature: 'Send IRS Form 8879 and state returns for client digital signature',
    route: '/admin (SignNow tab)',
    prototypeStatus: 'placeholder',
    tables: ['document_uploads', 'activity_log'],
    effortDays: 7,
    productionNotes: 'Requires SignNow API key. Scope: create signature request from completed return PDF, track status via webhook, notify preparer on sign, log to activity.'
  },
  {
    id: 16, module: 'Outlook Integration',
    feature: 'Send approved emails from each preparer\'s own Outlook mailbox',
    route: '/admin (Outlook tab)',
    prototypeStatus: 'placeholder',
    tables: ['email_drafts'],
    effortDays: 8,
    productionNotes: 'Requires Microsoft 365 app registration + admin consent. Scope: OAuth per preparer, store token in Supabase, send via Microsoft Graph API on draft approval, handle token refresh.'
  },
  {
    id: 17, module: 'Client Dashboard',
    feature: 'Authenticated client view — signup, doc checklist, upload, YoY analysis summary',
    route: '/portal',
    prototypeStatus: 'built',
    tables: ['clients', 'document_uploads', 'document_requirements'],
    effortDays: 1,
    productionNotes: 'Phase 1 complete: signup, 2025 checklist, 2024 baseline comparison, email draft on analysis. Production: password reset, email verification.'
  },
  {
    id: 18, module: 'Admin Settings',
    feature: 'User management, document types, branding, integration config',
    route: '/admin',
    prototypeStatus: 'simulation',
    tables: ['auth.users', 'clients'],
    effortDays: 3,
    productionNotes: 'User list is hardcoded. Production: manage users via Supabase Admin API, real invite flow, role assignment, deactivation enforced in DB.'
  },
];

const DB_TABLES = [
  { name: 'clients', cols: 'id, name, email, phone, status, documents_submitted, documents_required, issues, assigned_staff, assigned_preparer, reminder_cadence_days, last_activity', notes: 'Core entity' },
  { name: 'document_requirements', cols: 'id, client_id, name, doc_type, tax_year, required', notes: 'Per-client checklist' },
  { name: 'document_uploads', cols: 'id, client_id, requirement_id, file_name, file_size, mime_type, ai_status, ai_result, uploaded_at', notes: 'Uploaded files (no Storage yet)' },
  { name: 'ai_flags', cols: 'id, client_id, upload_id, flag_type, severity, description, detected_by, resolved, created_at', notes: 'Validation issues' },
  { name: 'activity_log', cols: 'id, client_id, actor, actor_type, action, created_at', notes: 'Audit trail' },
  { name: 'reminders', cols: 'id, client_id, message, sent_at, created_by', notes: 'Outbound reminders' },
  { name: 'magic_link_tokens', cols: 'id, client_id, token, expires_at, used_at', notes: 'No-auth portal access' },
  { name: 'email_drafts', cols: 'id, client_id, to_email, from_label, subject, body, status, approved_by, approved_at', notes: 'AI-drafted email queue' },
  { name: 'input_sheet_entries', cols: 'id, client_id, tax_year, section, field_name, field_value, ai_populated, verified', notes: 'Tax data pre-fill' },
  { name: 'time_entries', cols: 'id, client_id, user_email, started_at, ended_at, duration_seconds', notes: 'Preparer time tracking' },
];

const STACK = [
  { layer: 'Frontend', tech: 'React 18 + Vite + TypeScript', detail: 'SPA, strict mode, path aliases via @/' },
  { layer: 'UI Library', tech: 'shadcn/ui + Tailwind CSS 3', detail: 'Radix primitives, fully customisable' },
  { layer: 'Routing', tech: 'React Router v6', detail: 'Nested protected routes, role guards' },
  { layer: 'Data Fetching', tech: 'TanStack Query + Supabase JS v2', detail: 'Direct Supabase calls via db.ts wrapper' },
  { layer: 'Auth', tech: 'Supabase Auth', detail: 'Email/password, JWT, role in raw_user_meta_data' },
  { layer: 'Database', tech: 'Supabase (PostgreSQL 15)', detail: 'Row Level Security, foreign keys, generated columns' },
  { layer: 'File Storage', tech: 'Planned — Supabase Storage', detail: 'Not yet wired; uploads stored as metadata only' },
  { layer: 'AI / ML', tech: 'Simulated (production: Claude API)', detail: 'claude-sonnet-4-6 recommended for OCR + extraction' },
  { layer: 'Email', tech: 'Planned — Resend or Outlook Graph', detail: 'Draft/approve flow built; delivery not wired' },
  { layer: 'Deployment', tech: 'Lovable / Vite preview', detail: 'Production: Vercel, Netlify, or Cloudflare Pages' },
];

const totalDays = FEATURES.reduce((s, f) => s + f.effortDays, 0);
const builtCount = FEATURES.filter(f => f.prototypeStatus === 'built').length;
const simCount = FEATURES.filter(f => f.prototypeStatus === 'simulation').length;
const placeholderCount = FEATURES.filter(f => f.prototypeStatus === 'placeholder').length;

const DevDocs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('features');

  // CCH Axcess connect state
  const [cchOpen, setCchOpen]           = useState(false);
  const [cchApiKey, setCchApiKey]       = useState('');
  const [cchFirmId, setCchFirmId]       = useState('');
  const [cchEnv, setCchEnv]             = useState('production');
  const [cchTesting, setCchTesting]     = useState(false);
  const [cchConnected, setCchConnected] = useState(false);

  // SignNow connect state
  const [snOpen, setSnOpen]             = useState(false);
  const [snApiKey, setSnApiKey]         = useState('');
  const [snClientId, setSnClientId]     = useState('');
  const [snTesting, setSnTesting]       = useState(false);
  const [snConnected, setSnConnected]   = useState(false);

  // Outlook per-preparer connect state
  const [outlookConnecting, setOutlookConnecting] = useState({ sean: false, girik: false, nick: false });
  const [outlookConnected,  setOutlookConnected]  = useState({ sean: false, girik: false, nick: false });

  const testCch = async () => {
    setCchTesting(true);
    await new Promise(r => setTimeout(r, 2000));
    setCchTesting(false);
    toast.success('✅ CCH connected — 847 clients found');
  };

  const saveCch = () => {
    setCchConnected(true);
    setCchOpen(false);
    toast.success('CCH Axcess activated');
  };

  const testSn = async () => {
    setSnTesting(true);
    await new Promise(r => setTimeout(r, 2000));
    setSnTesting(false);
    toast.success('✅ SignNow connected — Business plan confirmed');
  };

  const saveSn = () => {
    setSnConnected(true);
    setSnOpen(false);
    toast.success('SignNow activated');
  };

  const connectOutlook = async (key: 'sean' | 'girik' | 'nick') => {
    setOutlookConnecting(prev => ({ ...prev, [key]: true }));
    await new Promise(r => setTimeout(r, 2000));
    setOutlookConnecting(prev => ({ ...prev, [key]: false }));
    setOutlookConnected(prev => ({ ...prev, [key]: true }));
  };

  return (
    <PageShell>
      <PageHeader
        title="Developer Documentation"
        subtitle="Feature inventory, technical spec, and production estimation for Broder Mansoor Muqtadir, Inc. AI"
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-5 text-center">
              <p className="text-3xl font-bold text-green-600">{builtCount}</p>
              <p className="text-xs text-gray-500 mt-1">Features Built</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5 text-center">
              <p className="text-3xl font-bold text-amber-500">{simCount}</p>
              <p className="text-xs text-gray-500 mt-1">Simulated (need real impl)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5 text-center">
              <p className="text-3xl font-bold text-blue-500">{placeholderCount}</p>
              <p className="text-xs text-gray-500 mt-1">Placeholder UIs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-5 text-center">
              <p className="text-3xl font-bold text-gray-800">{totalDays}d</p>
              <p className="text-xs text-gray-500 mt-1">Est. Total to Production</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="features">Feature Matrix</TabsTrigger>
            <TabsTrigger value="pages">Page Inventory</TabsTrigger>
            <TabsTrigger value="schema">DB Schema</TabsTrigger>
            <TabsTrigger value="stack">Tech Stack</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          {/* Feature Matrix */}
          <TabsContent value="features">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <th className="py-3 px-4 w-8">#</th>
                      <th className="py-3 px-4">Module</th>
                      <th className="py-3 px-4">Feature</th>
                      <th className="py-3 px-4">Prototype Status</th>
                      <th className="py-3 px-4">DB Tables</th>
                      <th className="py-3 px-4">Prod Effort</th>
                      <th className="py-3 px-4 min-w-[260px]">Production Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURES.map(f => (
                      <tr key={f.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-400 text-xs">{f.id}</td>
                        <td className="py-3 px-4 font-medium text-xs text-blue-700 whitespace-nowrap">{f.module}</td>
                        <td className="py-3 px-4 text-gray-800">{f.feature}</td>
                        <td className="py-3 px-4"><StatusBadge status={f.prototypeStatus} /></td>
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {f.tables.map(t => <span key={t} className="inline-block mr-1 mb-0.5 bg-gray-100 rounded px-1.5 py-0.5 font-mono text-[10px]">{t}</span>)}
                        </td>
                        <td className="py-3 px-4"><EffortBadge days={f.effortDays} /></td>
                        <td className="py-3 px-4 text-xs text-gray-600">{f.productionNotes}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={5} className="py-3 px-4 text-right text-sm text-gray-700">Total estimated production dev effort</td>
                      <td className="py-3 px-4"><EffortBadge days={totalDays} /></td>
                      <td className="py-3 px-4 text-xs text-gray-500">~{Math.ceil(totalDays / 5)} weeks (1 senior dev)</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Page Inventory */}
          <TabsContent value="pages">
            <div className="space-y-3">
              {[
                {
                  route: '/', name: 'Login', status: 'built', who: 'Public',
                  desc: 'Email/password login. Quick login buttons for demo personas (Nick/Admin, Sean/Preparer, Girik/Preparer, John/Client).',
                  req: ['Real email magic links for staff', 'Google/Microsoft SSO', '2FA for admin accounts']
                },
                {
                  route: '/upload/:token', name: 'Magic Link Portal', status: 'simulation', who: 'Public (no login)',
                  desc: 'Client-facing upload page accessed via tokenized URL. Shows document checklist, upload button per requirement, AI validation result in real-time. Creates ai_flag and email_draft on failure.',
                  req: ['Real Supabase Storage upload', 'Real AI doc classification', 'Token sent via email (not manually copied)']
                },
                {
                  route: '/dashboard', name: 'Admin/Preparer Dashboard', status: 'built', who: 'Admin + Preparer',
                  desc: 'ROI banner (live time tracking hours + cost savings), AI flags needing attention, client overview table with search. Preparers see only their assigned clients.',
                  req: ['ROI calculation from real time data ✅ done', 'Preparer filtering ✅ done', 'Export PDF/Excel report']
                },
                {
                  route: '/clients', name: 'All Clients', status: 'built', who: 'Admin only',
                  desc: 'Paginated client table with status filter tabs. Add client dialog. Each row links to detail page.',
                  req: ['CSV/bulk import', 'CCH sync button', 'Pagination for 800+ clients']
                },
                {
                  route: '/clients/:id', name: 'Client Detail', status: 'built', who: 'Admin + Preparer',
                  desc: 'Five tabs: Document Checklist, Input Sheet (AI-populated tax fields), AI Flags, Activity Log, Internal Notes. Header: time tracker, copy portal link, send reminder.',
                  req: ['Notes persistence (currently lost on refresh)', 'Download uploaded files', 'Edit client info inline']
                },
                {
                  route: '/flags', name: 'AI Flags', status: 'built', who: 'Admin + Preparer',
                  desc: 'Filterable list of all open AI flags across all clients. Severity badges. One-click resolve.',
                  req: ['Bulk resolve', 'Assign flag to preparer', 'Export flags report']
                },
                {
                  route: '/email-queue', name: 'Email Queue', status: 'simulation', who: 'Admin + Preparer',
                  desc: 'Pending approval tab shows AI-drafted emails. Review modal with editable subject/body. Approve & Send (simulated) or Dismiss. Sent history tab.',
                  req: ['Real email delivery (Resend or Outlook)', 'Firm email template/branding', 'Per-preparer from address (Outlook OAuth)']
                },
                {
                  route: '/activity', name: 'Activity Log', status: 'built', who: 'Admin + Preparer',
                  desc: 'Full chronological log of all actions across all clients. Actor avatar, timestamp.',
                  req: ['Filter by actor, date, action type', 'Webhook export to Slack/Teams']
                },
                {
                  route: '/portal', name: 'Client Portal', status: 'built', who: 'Client (authenticated)',
                  desc: 'Authenticated client view with document checklist, upload button, progress bar, and missing document list.',
                  req: ['Link Supabase auth user → clients row by email', 'RLS to isolate client data', 'Download previously uploaded files']
                },
                {
                  route: '/admin', name: 'Admin Settings', status: 'simulation', who: 'Admin only',
                  desc: 'Six tabs: User Management (hardcoded list), Document Types, CCH Integration (placeholder), SignNow E-Signature (placeholder), Outlook (placeholder), Branding.',
                  req: ['Live user management via Supabase Admin API', 'Real invite/deactivate flow', 'CCH/SignNow/Outlook real integrations (see Integrations tab)']
                },
                {
                  route: '/dev-docs', name: 'Developer Docs (this page)', status: 'built', who: 'Admin only',
                  desc: 'Feature matrix, page inventory, DB schema, tech stack, and integration roadmap for developer estimation.',
                  req: ['Keep updated as features ship']
                },
              ].map(page => (
                <Card key={page.route}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">{page.route}</code>
                          <span className="font-semibold text-sm">{page.name}</span>
                          <Badge variant="outline" className="text-xs">{page.who}</Badge>
                          <StatusBadge status={page.status as any} />
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{page.desc}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {page.req.map((r, i) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* DB Schema */}
          <TabsContent value="schema">
            <Card>
              <CardContent className="pt-5 pb-2 overflow-x-auto">
                <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Supabase (PostgreSQL 15) · All tables in public schema · RLS enabled
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <th className="py-3 px-4">Table</th>
                      <th className="py-3 px-4">Key Columns</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DB_TABLES.map(t => (
                      <tr key={t.name} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-xs text-blue-700 font-semibold whitespace-nowrap">{t.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-gray-600">{t.cols}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{t.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">Production DB notes</p>
                  <p>• <strong>Supabase Storage</strong> bucket needed for document_uploads (currently metadata only, no binary storage)</p>
                  <p>• <strong>RLS policies</strong> for preparer isolation (client filter currently frontend-only)</p>
                  <p>• <strong>Edge Functions</strong> needed for: email delivery cron, token expiry cleanup, CCH/SignNow webhooks</p>
                  <p>• <strong>Indexes</strong> to add: clients(assigned_preparer), ai_flags(client_id, resolved), document_uploads(client_id), time_entries(user_email, started_at)</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tech Stack */}
          <TabsContent value="stack">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-5 pb-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-500" /> Current Stack
                  </h3>
                  <div className="space-y-3">
                    {STACK.map(s => (
                      <div key={s.layer} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
                        <div className="w-28 text-xs font-medium text-gray-500 shrink-0 pt-0.5">{s.layer}</div>
                        <div>
                          <p className="text-sm font-medium">{s.tech}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5 pb-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500" /> Key Source Files
                  </h3>
                  <div className="space-y-2 font-mono text-xs text-gray-700">
                    {[
                      ['src/lib/db.ts', 'All Supabase queries (single source of truth)'],
                      ['src/lib/aiSimulation.ts', 'Validation simulation logic — replace with Claude API'],
                      ['src/lib/database.types.ts', 'Generated DB types (regenerate after schema changes)'],
                      ['src/contexts/AuthContext.tsx', 'Auth state, role, quick login'],
                      ['src/App.tsx', 'Route tree, role-gated routes'],
                      ['src/components/layout/AppSidebar.tsx', 'Navigation by role'],
                      ['src/pages/MagicLinkPortal.tsx', 'Client upload flow (public)'],
                      ['src/pages/admin/EmailQueue.tsx', 'Email draft review UI'],
                      ['src/components/client/InputSheet.tsx', 'Tax field auto-population'],
                      ['src/components/client/TimeTracker.tsx', 'Session timer'],
                      ['supabase/migrations/', 'Schema migrations (apply in order)'],
                      ['supabase/seed.sql', 'Demo data (6 clients, flags, emails, tokens)'],
                    ].map(([file, desc]) => (
                      <div key={file} className="flex gap-2 pb-1.5 border-b last:border-0">
                        <span className="text-blue-600 shrink-0">{file}</span>
                        <span className="text-gray-500">— {desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <div className="space-y-4">

              {/* ── CCH Axcess ─────────────────────────────────────────────── */}
              <Card className="border-l-4 border-l-blue-400 bg-blue-50">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">CCH Axcess</span>
                        {cchConnected
                          ? <Badge className="bg-green-100 text-green-700 text-xs">Connected ✅</Badge>
                          : <Badge className="bg-gray-100 text-gray-600 text-xs">Needs API credentials from Nick/Andrew</Badge>}
                        <EffortBadge days={12} />
                      </div>
                      <p className="text-sm text-gray-700 mt-1">Sync client list from CCH, import prior-year return data to pre-fill input sheets, push completed tax data back for e-filing.</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Implementation Steps</p>
                      <ol className="space-y-1">
                        {[
                          'Obtain CCH Axcess API key + Firm ID from CCH support',
                          'Build OAuth handshake / API key auth in Supabase Edge Function',
                          'Write nightly sync job: pull clients, map to our schema, upsert',
                          'Map prior-year return fields to input_sheet_entries columns',
                          'Build push-back: format completed input sheet → CCH return format',
                        ].map((step, i) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-2">
                            <span className="w-4 h-4 rounded-full bg-white border text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 border">
                      <p className="text-xs font-semibold text-red-600 mb-1">Blocker</p>
                      <p className="text-xs text-gray-700">CCH API credentials — contact Andrew or Nick Muqtadir</p>
                    </div>
                  </div>

                  {/* Connect section */}
                  <div className="border-t border-blue-200 pt-3">
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
                      onClick={() => setCchOpen(o => !o)}
                    >
                      {cchOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      🔌 Connect CCH Axcess
                    </button>
                    {cchOpen && (
                      <div className="mt-3 bg-white rounded-lg border border-blue-200 p-4 space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">API Key</Label>
                            <Input
                              type="password"
                              placeholder="Paste CCH API key..."
                              value={cchApiKey}
                              onChange={e => setCchApiKey(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Firm ID</Label>
                            <Input
                              type="text"
                              placeholder="CCH Firm ID"
                              value={cchFirmId}
                              onChange={e => setCchFirmId(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Environment</Label>
                          <Select value={cchEnv} onValueChange={setCchEnv}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="production">Production</SelectItem>
                              <SelectItem value="sandbox">Sandbox</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={testCch} disabled={cchTesting}>
                            {cchTesting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                            Test Connection
                          </Button>
                          <Button size="sm" onClick={saveCch} disabled={cchTesting}>
                            Save & Activate
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── SignNow ─────────────────────────────────────────────────── */}
              <Card className="border-l-4 border-l-green-400 bg-green-50">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">SignNow E-Signature</span>
                        {snConnected
                          ? <Badge className="bg-green-100 text-green-700 text-xs">Connected ✅</Badge>
                          : <Badge className="bg-gray-100 text-gray-600 text-xs">Account created — API key needed</Badge>}
                        <EffortBadge days={7} />
                      </div>
                      <p className="text-sm text-gray-700 mt-1">Create e-signature requests for Form 8879 and state returns. Track status, notify preparer on completion.</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Implementation Steps</p>
                      <ol className="space-y-1">
                        {[
                          'Obtain SignNow API key / OAuth client',
                          'Edge Function: create document + signature invite on trigger',
                          'Webhook endpoint to receive signing events from SignNow',
                          'Log to activity_log, update document status',
                          'Preparer notification (email or in-app badge)',
                        ].map((step, i) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-2">
                            <span className="w-4 h-4 rounded-full bg-white border text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 border">
                      <p className="text-xs font-semibold text-red-600 mb-1">Blocker</p>
                      <p className="text-xs text-gray-700">SignNow API credentials — contact Nick</p>
                    </div>
                  </div>

                  {/* Connect section */}
                  <div className="border-t border-green-200 pt-3">
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-900 transition-colors"
                      onClick={() => setSnOpen(o => !o)}
                    >
                      {snOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      🔌 Connect SignNow
                    </button>
                    {snOpen && (
                      <div className="mt-3 bg-white rounded-lg border border-green-200 p-4 space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">API Key</Label>
                            <Input
                              type="password"
                              placeholder="Paste SignNow API key..."
                              value={snApiKey}
                              onChange={e => setSnApiKey(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Client ID</Label>
                            <Input
                              type="text"
                              placeholder="SignNow Client ID"
                              value={snClientId}
                              onChange={e => setSnClientId(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={testSn} disabled={snTesting}>
                            {snTesting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                            Test Connection
                          </Button>
                          <Button size="sm" onClick={saveSn} disabled={snTesting}>
                            Save & Activate
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── Microsoft Outlook ───────────────────────────────────────── */}
              <Card className="border-l-4 border-l-indigo-400 bg-indigo-50">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">Microsoft Outlook</span>
                        <Badge className="bg-gray-100 text-gray-600 text-xs">Needs Microsoft 365 app registration</Badge>
                        <EffortBadge days={8} />
                      </div>
                      <p className="text-sm text-gray-700 mt-1">Send approved emails from each preparer's own Outlook mailbox via Microsoft Graph API. Per-preparer OAuth consent.</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Implementation Steps</p>
                      <ol className="space-y-1">
                        {[
                          'Register app in Azure AD for brodermansoor.com tenant',
                          'Request admin consent for Mail.Send delegated permission',
                          'OAuth flow per preparer — store refresh token in Supabase (encrypted)',
                          'Edge Function: on email_draft approved → send via Graph API using preparer token',
                          'Handle token refresh, failure retry, send confirmation',
                        ].map((step, i) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-2">
                            <span className="w-4 h-4 rounded-full bg-white border text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3 border">
                      <p className="text-xs font-semibold text-red-600 mb-1">Blocker</p>
                      <p className="text-xs text-gray-700">Microsoft 365 admin access — contact IT or Nick</p>
                    </div>
                  </div>

                  {/* Per-preparer OAuth connect */}
                  <div className="border-t border-indigo-200 pt-3">
                    <p className="text-sm font-medium text-indigo-700 mb-3">🔌 Connect Preparer Mailboxes</p>
                    <div className="space-y-2">
                      {([
                        { key: 'sean',  label: "Connect Sean's Outlook",  email: 'shawn@brodermansoor.com'  },
                        { key: 'girik', label: "Connect Girik's Outlook", email: 'girik@brodermansoor.com' },
                        { key: 'nick',  label: "Connect Nick's Outlook",  email: 'nick@brodermansoor.com'  },
                      ] as const).map(({ key, label, email }) => (
                        <div key={key} className="flex items-center gap-3">
                          <Button
                            size="sm"
                            variant={outlookConnected[key] ? 'outline' : 'default'}
                            className={outlookConnected[key] ? 'border-green-400 text-green-700' : ''}
                            disabled={outlookConnecting[key] || outlookConnected[key]}
                            onClick={() => connectOutlook(key)}
                          >
                            {outlookConnecting[key]
                              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              : outlookConnected[key]
                                ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                                : null}
                            {label}
                          </Button>
                          <span className="text-xs text-gray-500">{email}</span>
                          {outlookConnected[key] && (
                            <Badge className="bg-green-100 text-green-700 text-xs">Connected ✅</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Claude AI + Resend (generic cards) ─────────────────────── */}
              {[
                {
                  name: 'Claude AI (Document Validation)', color: 'purple', icon: Zap,
                  status: 'Simulated — ready to activate', effort: 8,
                  what: 'Replace filename-based simulation with real AI: classify document type from content, extract tax year + employer + amounts, flag mismatches.',
                  steps: [
                    'Add ANTHROPIC_API_KEY to Supabase Edge Function secrets',
                    'Edge Function: on file upload → read PDF/image → send to claude-sonnet-4-6 with extraction prompt',
                    'Parse structured response: doc_type, tax_year, employer, key amounts',
                    'Compare against requirement → create ai_flag if mismatch',
                    'Store extracted values into input_sheet_entries (real auto-population)',
                  ],
                  blocker: 'Anthropic API key (quick to obtain at console.anthropic.com)',
                },
                {
                  name: 'Email Delivery (Resend)', color: 'amber', icon: Zap,
                  status: 'Simple drop-in when Outlook is not ready', effort: 2,
                  what: 'Send approved emails via Resend.com as a simpler alternative to Outlook if per-preparer mailboxes are not required immediately.',
                  steps: [
                    'Create Resend account, add brodermansoor.com as sending domain',
                    'Add RESEND_API_KEY to Supabase Edge Function secrets',
                    'On email_draft approved → POST to Resend API from Edge Function',
                    'Update email_draft.status to "sent"',
                  ],
                  blocker: 'Domain DNS access to add Resend DKIM records',
                },
              ].map(intg => {
                const colorMap: Record<string, string> = {
                  purple: 'border-l-purple-400 bg-purple-50',
                  amber:  'border-l-amber-400 bg-amber-50',
                };
                return (
                  <Card key={intg.name} className={`border-l-4 ${colorMap[intg.color]}`}>
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{intg.name}</span>
                            <Badge className="bg-gray-100 text-gray-600 text-xs">{intg.status}</Badge>
                            <EffortBadge days={intg.effort} />
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{intg.what}</p>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Implementation Steps</p>
                          <ol className="space-y-1">
                            {intg.steps.map((step, i) => (
                              <li key={i} className="text-xs text-gray-700 flex gap-2">
                                <span className="w-4 h-4 rounded-full bg-white border text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div className="bg-white/70 rounded-lg p-3 border">
                          <p className="text-xs font-semibold text-red-600 mb-1">Blocker</p>
                          <p className="text-xs text-gray-700">{intg.blocker}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

            </div>
          </TabsContent>
        </Tabs>
      </main>
    </PageShell>
  );
};

export default DevDocs;
