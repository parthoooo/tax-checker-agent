import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PenLine, Copy, Mail, XCircle, CheckCircle2, Clock, Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSignatureRequest,
  loadSignatureRequests,
  saveSignatureRequests,
  upsertSignatureRequest,
} from '@/utils/signNowService';
import type { SignatureRequest } from '@/utils/signNowService';
import { DEMO_STAFF, FIRM_NAME, getPortalOrigin } from '@/lib/branding';

// ─── Constants ────────────────────────────────────────────────────────────────

const PREP1 = DEMO_STAFF.preparer1;
const PREP2 = DEMO_STAFF.preparer2;

const MOCK_CLIENTS = [
  { slug: 'jsmith',     name: 'John Smith',      email: 'john.smith@email.com',      preparer: PREP2.fullName, preparerEmail: PREP2.email },
  { slug: 'mbrown',     name: 'Michael Brown',   email: 'michael.brown@email.com',   preparer: PREP2.fullName, preparerEmail: PREP2.email },
  { slug: 'sjohnson',   name: 'Sarah Johnson',   email: 'sarah.johnson@email.com',   preparer: PREP1.fullName, preparerEmail: PREP1.email },
  { slug: 'rchen',      name: 'Robert Chen',     email: 'robert.chen@email.com',     preparer: PREP2.fullName, preparerEmail: PREP2.email },
  { slug: 'mrodriguez', name: 'Maria Rodriguez', email: 'maria.rodriguez@email.com', preparer: PREP1.fullName, preparerEmail: PREP1.email },
];

const DOC_TYPES: { value: SignatureRequest['documentType']; label: string; nameTemplate: string }[] = [
  { value: 'form-8879',         label: 'Form 8879 — IRS e-file Authorization',  nameTemplate: 'Form 8879 — IRS e-file Authorization 2024' },
  { value: 'state-equivalent',  label: 'State e-file Authorization',             nameTemplate: 'NY State IT-370 e-file Authorization 2024' },
  { value: 'engagement-letter', label: 'Engagement Letter',                      nameTemplate: `2024 Engagement Letter — ${FIRM_NAME}` },
  { value: 'poa',               label: 'Power of Attorney',                      nameTemplate: 'IRS Form 2848 — Power of Attorney 2024' },
];

const MOCK_SEED: SignatureRequest[] = [
  {
    id: 'sig-001',
    clientName: 'John Smith',
    clientEmail: 'john.smith@email.com',
    documentName: 'Form 8879 — IRS e-file Authorization 2024',
    documentType: 'form-8879',
    preparer: PREP2.fullName,
    preparerEmail: PREP2.email,
    createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 86400_000).toISOString(),
    status: 'pending',
  },
  {
    id: 'sig-002',
    clientName: 'Maria Rodriguez',
    clientEmail: 'maria.rodriguez@email.com',
    documentName: 'NY State IT-370 e-file Authorization 2024',
    documentType: 'state-equivalent',
    preparer: PREP1.fullName,
    preparerEmail: PREP1.email,
    createdAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
    expiresAt: new Date(Date.now() + 6 * 86400_000).toISOString(),
    status: 'pending',
  },
  {
    id: 'sig-003',
    clientName: 'Robert Chen',
    clientEmail: 'robert.chen@email.com',
    documentName: `2024 Engagement Letter — ${FIRM_NAME}`,
    documentType: 'engagement-letter',
    preparer: PREP2.fullName,
    preparerEmail: PREP2.email,
    createdAt: new Date(Date.now() - 4 * 86400_000).toISOString(),
    expiresAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
    status: 'pending',
  },
  {
    id: 'sig-101',
    clientName: 'Sarah Johnson',
    clientEmail: 'sarah.johnson@email.com',
    documentName: 'Form 8879 — IRS e-file Authorization 2024',
    documentType: 'form-8879',
    preparer: PREP1.fullName,
    preparerEmail: PREP1.email,
    createdAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    expiresAt: new Date(Date.now() + 2 * 86400_000).toISOString(),
    status: 'signed',
    signedAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    signerIp: '73.142.58.201',
    signerName: 'Sarah Johnson',
  },
  {
    id: 'sig-102',
    clientName: 'Michael Brown',
    clientEmail: 'michael.brown@email.com',
    documentName: `2024 Engagement Letter — ${FIRM_NAME}`,
    documentType: 'engagement-letter',
    preparer: PREP2.fullName,
    preparerEmail: PREP2.email,
    createdAt: new Date(Date.now() - 9 * 86400_000).toISOString(),
    expiresAt: new Date(Date.now()).toISOString(),
    status: 'signed',
    signedAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
    signerIp: '98.247.112.44',
    signerName: 'Michael Brown',
  },
  {
    id: 'sig-103',
    clientName: 'John Smith',
    clientEmail: 'john.smith@email.com',
    documentName: 'NY State IT-370 e-file Authorization 2023',
    documentType: 'state-equivalent',
    preparer: PREP1.fullName,
    preparerEmail: PREP1.email,
    createdAt: new Date(Date.now() - 12 * 86400_000).toISOString(),
    expiresAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
    status: 'declined',
    signedAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
    signerIp: '67.180.201.33',
    signerName: 'John Smith',
  },
];

const signingBase = () => `${getPortalOrigin() || ''}/sign/`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const daysAgo = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d === 0 ? 'Today' : d === 1 ? '1 day ago' : `${d} days ago`;
};

const daysUntil = (iso: string) => {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
  if (d < 0) return { text: 'Expired', urgent: true };
  if (d === 0) return { text: 'Expires today', urgent: true };
  if (d === 1) return { text: '1 day left', urgent: true };
  return { text: `${d} days left`, urgent: d < 2 };
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const docTypeBadge = (dt: SignatureRequest['documentType']) => {
  const map: Record<string, { label: string; className: string }> = {
    'form-8879':         { label: 'Form 8879',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
    'state-equivalent':  { label: 'State',      className: 'bg-purple-100 text-purple-700 border-purple-200' },
    'engagement-letter': { label: 'Engagement', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    'poa':               { label: 'POA',        className: 'bg-gray-100 text-gray-700 border-gray-200' },
  };
  const { label, className } = map[dt] ?? { label: dt, className: '' };
  return <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>;
};

// ─── Seed once ────────────────────────────────────────────────────────────────

function ensureSeeded() {
  if (localStorage.getItem('sig_seeded')) return;
  saveSignatureRequests(MOCK_SEED);
  localStorage.setItem('sig_seeded', '1');
}

// ─── Pending Tab ──────────────────────────────────────────────────────────────

const PendingTab: React.FC<{
  requests: SignatureRequest[];
  onVoid: (id: string) => void;
}> = ({ requests, onVoid }) => {
  const [voidTarget, setVoidTarget] = useState<string | null>(null);

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(`${signingBase()}${id}`)
      .then(() => toast.success('Signing link copied to clipboard'))
      .catch(() => toast.error('Failed to copy'));
  };

  const resend = (email: string) => toast.success(`Reminder sent to ${email}`);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-500">
        <CheckCircle2 className="w-10 h-10 mb-3 text-gray-300" />
        <p className="font-medium">No pending signature requests.</p>
        <p className="text-sm text-gray-400 mt-1">Use the "Send Request" tab to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map(r => {
        const expiry = daysUntil(r.expiresAt);
        return (
          <Card key={r.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Left info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="font-semibold text-gray-900">{r.clientName}</div>
                  <div className="text-sm text-gray-500">{r.clientEmail}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {docTypeBadge(r.documentType)}
                    <span className="text-xs text-gray-500">Sent by {r.preparer} · {daysAgo(r.createdAt)}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-700 mt-0.5">{r.documentName}</div>
                  <span className={`text-xs font-medium ${expiry.urgent ? 'text-red-600' : 'text-gray-400'}`}>
                    ⏱ {expiry.text}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap sm:flex-col gap-2 sm:w-40 shrink-0">
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none text-xs" onClick={() => copyLink(r.id)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy Link
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 sm:flex-none text-xs" onClick={() => resend(r.clientEmail)}>
                    <Mail className="w-3.5 h-3.5 mr-1" /> Resend Email
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-600 flex-1 sm:flex-none text-xs"
                    onClick={() => setVoidTarget(r.id)}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Void
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Void Signature Request?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            The client's signing link will stop working immediately. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setVoidTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onVoid(voidTarget!); setVoidTarget(null); }}>
              Void Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Completed Tab ────────────────────────────────────────────────────────────

const CompletedTab: React.FC<{ requests: SignatureRequest[] }> = ({ requests }) => {
  const statusBadge = (s: SignatureRequest['status']) => {
    if (s === 'signed')   return <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">Signed</Badge>;
    if (s === 'declined') return <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Declined</Badge>;
    return <Badge className="bg-gray-100 text-gray-500 border-gray-200" variant="outline">Expired / Voided</Badge>;
  };

  if (requests.length === 0) {
    return <p className="text-center text-gray-500 py-12">No completed signature requests yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-gray-500 text-xs">
            <th className="text-left py-2 pr-4 font-medium">Client</th>
            <th className="text-left py-2 pr-4 font-medium">Document</th>
            <th className="text-left py-2 pr-4 font-medium">Status</th>
            <th className="text-left py-2 pr-4 font-medium">Signer / IP</th>
            <th className="text-left py-2 pr-4 font-medium">Timestamp</th>
            <th className="text-left py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="py-3 pr-4">
                <p className="font-medium text-gray-800">{r.clientName}</p>
                <p className="text-xs text-gray-400">{r.clientEmail}</p>
              </td>
              <td className="py-3 pr-4">
                <p className="text-gray-700 max-w-[220px] truncate" title={r.documentName}>{r.documentName}</p>
                <div className="mt-0.5">{docTypeBadge(r.documentType)}</div>
              </td>
              <td className="py-3 pr-4">{statusBadge(r.status)}</td>
              <td className="py-3 pr-4 text-gray-600">
                {r.signerName && <p>{r.signerName}</p>}
                {r.signerIp && <p className="text-xs text-gray-400">Signed from {r.signerIp}</p>}
              </td>
              <td className="py-3 pr-4 text-gray-500 whitespace-nowrap text-xs">
                {r.signedAt ? fmtDateTime(r.signedAt) : '—'}
              </td>
              <td className="py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => toast('Preparing signature receipt PDF…')}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Receipt
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Send Request Tab ─────────────────────────────────────────────────────────

const SendRequestTab: React.FC<{
  preSelectSlug?: string;
  onRequestSent: (req: SignatureRequest) => void;
}> = ({ preSelectSlug, onRequestSent }) => {
  const preClient = preSelectSlug ? MOCK_CLIENTS.find(c => c.slug === preSelectSlug) : undefined;

  const [clientSlug, setClientSlug]   = useState(preClient?.slug ?? '');
  const [docType, setDocType]         = useState<SignatureRequest['documentType']>('form-8879');
  const [docName, setDocName]         = useState('Form 8879 — IRS e-file Authorization 2024');
  const [delivery, setDelivery]       = useState<'email' | 'link'>('email');
  const [note, setNote]               = useState('');
  const [sending, setSending]         = useState(false);

  // Auto-fill doc name when doc type changes
  const handleDocTypeChange = (v: SignatureRequest['documentType']) => {
    setDocType(v);
    const template = DOC_TYPES.find(d => d.value === v)?.nameTemplate ?? '';
    setDocName(template);
  };

  const selectedClient = MOCK_CLIENTS.find(c => c.slug === clientSlug);

  const handleSend = async () => {
    if (!selectedClient) { toast.error('Please select a client'); return; }
    if (!docName.trim()) { toast.error('Please enter a document name'); return; }

    setSending(true);
    try {
      const req = await createSignatureRequest(
        selectedClient.email,
        selectedClient.name,
        docName,
        docType,
        selectedClient.preparer,
        selectedClient.preparerEmail,
        note || undefined,
      );
      upsertSignatureRequest(req);
      toast.success(`Signature request sent to ${selectedClient.email}`);
      onRequestSent(req);
      // Reset form
      setClientSlug('');
      setDocType('form-8879');
      setDocName('Form 8879 — IRS e-file Authorization 2024');
      setNote('');
    } catch (err: any) {
      toast.error('Failed to send request', { description: err?.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      {/* Client */}
      <div className="space-y-1.5">
        <Label>Client</Label>
        <Select value={clientSlug} onValueChange={setClientSlug}>
          <SelectTrigger>
            <SelectValue placeholder="Select a client…" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_CLIENTS.map(c => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name} — {c.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document type */}
      <div className="space-y-1.5">
        <Label>Document Type</Label>
        <Select value={docType} onValueChange={v => handleDocTypeChange(v as SignatureRequest['documentType'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map(d => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document name */}
      <div className="space-y-1.5">
        <Label>Document Name</Label>
        <Input
          value={docName}
          onChange={e => setDocName(e.target.value)}
          placeholder="e.g. Form 8879 — IRS e-file Authorization 2024"
        />
      </div>

      {/* Assigned preparer */}
      <div className="space-y-1.5">
        <Label>Assigned Preparer</Label>
        <Input
          value={selectedClient?.preparer ?? ''}
          readOnly
          className="bg-gray-50 text-gray-500"
          placeholder="Select a client first"
        />
      </div>

      {/* Delivery method */}
      <div className="space-y-2">
        <Label>Delivery Method</Label>
        <RadioGroup
          value={delivery}
          onValueChange={v => setDelivery(v as 'email' | 'link')}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="email" id="del-email" />
            <Label htmlFor="del-email" className="font-normal cursor-pointer">Email</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="link" id="del-link" />
            <Label htmlFor="del-link" className="font-normal cursor-pointer">Copy Link Only</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Note to client */}
      <div className="space-y-1.5">
        <Label>Note to Client <span className="text-gray-400 font-normal">(optional)</span></Label>
        <Textarea
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Your 2024 tax return is ready for your review and signature. Please sign at your earliest convenience."
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={sending}
        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
      >
        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PenLine className="w-4 h-4 mr-2" />}
        Send Signature Request
      </Button>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const ESignaturePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preClient = searchParams.get('client') ?? undefined;

  const [activeTab, setActiveTab]     = useState<string>(preClient ? 'send' : 'pending');
  const [requests, setRequests]       = useState<SignatureRequest[]>([]);

  useEffect(() => {
    ensureSeeded();
    setRequests(loadSignatureRequests());
  }, []);

  const pending   = requests.filter(r => r.status === 'pending');
  const completed = requests.filter(r => r.status !== 'pending');

  const handleVoid = (id: string) => {
    const updated = requests.map(r =>
      r.id === id ? { ...r, status: 'expired' as const } : r
    );
    saveSignatureRequests(updated);
    setRequests(updated);
    toast.success('Request voided');
  };

  const handleRequestSent = (req: SignatureRequest) => {
    setRequests(loadSignatureRequests());
    setActiveTab('pending');
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <PenLine className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Signatures</h1>
          <p className="text-sm text-gray-500">Request, track, and manage client document signatures</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pending.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] inline-flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="send">Send Request</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingTab requests={pending} onVoid={handleVoid} />
        </TabsContent>

        <TabsContent value="completed">
          <CompletedTab requests={completed} />
        </TabsContent>

        <TabsContent value="send">
          <SendRequestTab preSelectSlug={preClient} onRequestSent={handleRequestSent} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ESignaturePage;
