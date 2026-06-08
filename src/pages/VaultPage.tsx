import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileText, Download, Eye, Trash2, FolderOpen, Loader2,
  AlertTriangle, Clock, CheckCircle2, Link2, Archive,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { fetchClients, fetchDocumentRequirements, fetchDocumentUploads } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type FileAiStatus = 'verified' | 'wrong_year' | 'duplicate' | 'unexpected' | 'pending' | 'flagged' | 'rejected';

interface VaultFile {
  id: string;
  clientId: string;
  docType: string;
  taxYear: number;
  filename: string;
  size: number;
  aiStatus: FileAiStatus;
  uploadedAt: string;
  storagePath: string;
}

interface MockClient {
  slug: string;
  name: string;
  email: string;
  docsSubmitted: number;
  docsRequired: number;
  clientStatus: 'complete' | 'in_progress' | 'overdue';
  supabaseId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_DOC_TYPES = ['W-2', '1099-NEC', '1098', 'Schedule C'];

const MOCK_CLIENTS: MockClient[] = [
  { slug: 'jsmith',     name: 'John Smith',      email: 'john.smith@email.com',      docsSubmitted: 3, docsRequired: 4, clientStatus: 'in_progress' },
  { slug: 'mbrown',     name: 'Michael Brown',   email: 'michael.brown@email.com',   docsSubmitted: 1, docsRequired: 4, clientStatus: 'in_progress' },
  { slug: 'sjohnson',   name: 'Sarah Johnson',   email: 'sarah.johnson@email.com',   docsSubmitted: 0, docsRequired: 4, clientStatus: 'overdue' },
  { slug: 'rchen',      name: 'Robert Chen',     email: 'robert.chen@email.com',     docsSubmitted: 4, docsRequired: 4, clientStatus: 'complete' },
  { slug: 'mrodriguez', name: 'Maria Rodriguez', email: 'maria.rodriguez@email.com', docsSubmitted: 2, docsRequired: 4, clientStatus: 'in_progress' },
];

const MOCK_FILES: VaultFile[] = [
  { id: 'm1', clientId: 'jsmith',     docType: 'W-2',       taxYear: 2024, filename: 'W2_2024_JohnSmith.pdf',         size: 245000, aiStatus: 'verified',   uploadedAt: '2024-01-15T10:23:00Z', storagePath: 'clients/jsmith/2024/W-2/W2_2024_JohnSmith.pdf' },
  { id: 'm2', clientId: 'jsmith',     docType: '1099-NEC',  taxYear: 2024, filename: 'W2_2023_JohnSmith.pdf',         size: 189000, aiStatus: 'wrong_year', uploadedAt: '2024-01-14T14:11:00Z', storagePath: 'clients/jsmith/2024/1099-NEC/W2_2023_JohnSmith.pdf' },
  { id: 'm3', clientId: 'mbrown',     docType: 'W-2',       taxYear: 2024, filename: 'W2_2023_MichaelBrown.pdf',      size: 312000, aiStatus: 'wrong_year', uploadedAt: '2024-01-13T09:45:00Z', storagePath: 'clients/mbrown/2024/W-2/W2_2023_MichaelBrown.pdf' },
  { id: 'm4', clientId: 'sjohnson',   docType: '1098',      taxYear: 2024, filename: 'BankStatement_Sarah.pdf',       size: 521000, aiStatus: 'unexpected', uploadedAt: '2024-01-12T16:30:00Z', storagePath: 'clients/sjohnson/2024/1098/BankStatement_Sarah.pdf' },
  { id: 'm5', clientId: 'rchen',      docType: '1098',      taxYear: 2024, filename: '1098_2024_RobertChen.pdf',      size: 198000, aiStatus: 'verified',   uploadedAt: '2024-01-11T11:00:00Z', storagePath: 'clients/rchen/2024/1098/1098_2024_RobertChen.pdf' },
  { id: 'm6', clientId: 'mrodriguez', docType: 'W-2',       taxYear: 2024, filename: 'W2_2024_MariaRodriguez.pdf',    size: 267000, aiStatus: 'verified',   uploadedAt: '2024-01-10T08:15:00Z', storagePath: 'clients/mrodriguez/2024/W-2/W2_2024_MariaRodriguez.pdf' },
];

// Additional mock files for populated clients
const EXTRA_MOCK_FILES: VaultFile[] = [
  { id: 'e1', clientId: 'rchen',  docType: 'W-2',      taxYear: 2024, filename: 'W2_2024_RobertChen.pdf',       size: 231000, aiStatus: 'verified', uploadedAt: '2024-01-11T09:00:00Z', storagePath: 'clients/rchen/2024/W-2/W2_2024_RobertChen.pdf' },
  { id: 'e2', clientId: 'rchen',  docType: '1099-NEC', taxYear: 2024, filename: '1099_2024_RobertChen.pdf',     size: 157000, aiStatus: 'verified', uploadedAt: '2024-01-11T09:05:00Z', storagePath: 'clients/rchen/2024/1099-NEC/1099_2024_RobertChen.pdf' },
  { id: 'e3', clientId: 'rchen',  docType: 'Schedule C', taxYear: 2024, filename: 'ScheduleC_2024_RobertChen.pdf', size: 310000, aiStatus: 'verified', uploadedAt: '2024-01-11T09:10:00Z', storagePath: 'clients/rchen/2024/Schedule C/ScheduleC_2024_RobertChen.pdf' },
  { id: 'e4', clientId: 'mrodriguez', docType: '1099-NEC', taxYear: 2024, filename: '1099_2024_MariaRodriguez.pdf', size: 192000, aiStatus: 'verified', uploadedAt: '2024-01-10T08:20:00Z', storagePath: 'clients/mrodriguez/2024/1099-NEC/1099_2024_MariaRodriguez.pdf' },
  { id: 'e5', clientId: 'jsmith', docType: '1098', taxYear: 2024, filename: '1098_2024_JohnSmith.pdf', size: 204000, aiStatus: 'verified', uploadedAt: '2024-01-15T10:30:00Z', storagePath: 'clients/jsmith/2024/1098/1098_2024_JohnSmith.pdf' },
];

const ALL_MOCK_FILES = [...MOCK_FILES, ...EXTRA_MOCK_FILES];

const MOCK_UPLOAD_BASE = window.location.origin + '/upload/demo-token-';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtSize = (bytes: number) => {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const fileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileText className="w-8 h-8 text-red-500" />;
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext ?? '')) return <FileText className="w-8 h-8 text-blue-400" />;
  return <FileText className="w-8 h-8 text-gray-400" />;
};

const AiStatusBadge: React.FC<{ status: FileAiStatus }> = ({ status }) => {
  const map: Record<string, { label: string; className: string }> = {
    verified:   { label: 'Verified',   className: 'bg-green-100 text-green-700 border-green-200' },
    wrong_year: { label: 'Wrong Year', className: 'bg-red-100 text-red-700 border-red-200' },
    duplicate:  { label: 'Duplicate',  className: 'bg-orange-100 text-orange-700 border-orange-200' },
    unexpected: { label: 'Unexpected', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    pending:    { label: 'Pending',    className: 'bg-gray-100 text-gray-500 border-gray-200' },
    flagged:    { label: 'Flagged',    className: 'bg-orange-100 text-orange-700 border-orange-200' },
    rejected:   { label: 'Rejected',   className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, className } = map[status] ?? map.pending;
  return <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>;
};

const StatusDot: React.FC<{ status: MockClient['clientStatus'] }> = ({ status }) => {
  const color =
    status === 'complete'    ? 'bg-green-500' :
    status === 'overdue'     ? 'bg-red-500' :
    'bg-amber-400';
  return <span className={`w-2 h-2 rounded-full shrink-0 inline-block ${color}`} />;
};

// ─── File Card ────────────────────────────────────────────────────────────────

interface FileCardProps {
  file: VaultFile;
  onDelete: (file: VaultFile) => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onDelete }) => {
  const [busy, setBusy] = useState(false);

  const getSignedUrl = async (): Promise<string | null> => {
    try {
      const { data, error } = await (supabase as any).storage
        .from('documents')
        .createSignedUrl(file.storagePath, 3600);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    } catch { return null; }
  };

  const handleDownload = async () => {
    setBusy(true);
    toast('Preparing download…');
    const url = await getSignedUrl();
    setBusy(false);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
    } else {
      toast.error('Download unavailable — file may not be in Storage yet.');
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    toast('Opening preview…');
    const url = await getSignedUrl();
    setBusy(false);
    if (url) window.open(url, '_blank');
    else toast.error('Preview unavailable — file may not be in Storage yet.');
  };

  return (
    <Card className="border border-gray-200 hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{fileIcon(file.filename)}</div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="font-medium text-sm text-gray-900 truncate" title={file.filename}>{file.filename}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50">{file.docType}</Badge>
              <Badge variant="outline" className="text-xs text-gray-500">{file.taxYear}</Badge>
              <AiStatusBadge status={file.aiStatus} />
            </div>
            <p className="text-xs text-gray-400">{fmtDate(file.uploadedAt)} · {fmtSize(file.size)}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleDownload} disabled={busy}>
            <Download className="w-3 h-3 mr-1" /> Download
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handlePreview} disabled={busy}>
            <Eye className="w-3 h-3 mr-1" /> Preview
          </Button>
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50 text-xs" onClick={() => onDelete(file)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Empty state placeholder card ────────────────────────────────────────────

const PlaceholderCard: React.FC<{ docType: string; clientSlug: string }> = ({ docType, clientSlug }) => {
  const copyLink = () => {
    navigator.clipboard.writeText(`${MOCK_UPLOAD_BASE}${clientSlug}`)
      .then(() => toast.success('Upload link copied'))
      .catch(() => toast.error('Failed to copy link'));
  };

  return (
    <Card className="border-2 border-dashed border-gray-200 bg-gray-50">
      <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[120px]">
        <Clock className="w-6 h-6 text-gray-300" />
        <div>
          <p className="font-medium text-sm text-gray-500">{docType}</p>
          <p className="text-xs text-gray-400">Not yet uploaded</p>
        </div>
        <Button size="sm" variant="outline" className="text-xs mt-1" onClick={copyLink}>
          <Link2 className="w-3 h-3 mr-1" /> Send Upload Link
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const VaultPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients]       = useState<MockClient[]>(MOCK_CLIENTS);
  const [selected, setSelected]     = useState<MockClient>(MOCK_CLIENTS[0]);
  const [files, setFiles]           = useState<VaultFile[]>([]);
  const [loading, setLoading]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VaultFile | null>(null);
  const [deleting, setDeleting]     = useState(false);

  // Resolve ?client= query param
  useEffect(() => {
    const param = searchParams.get('client');
    if (!param) return;
    const match = MOCK_CLIENTS.find(c => c.slug === param || c.supabaseId === param);
    if (match) setSelected(match);
  }, [searchParams]);

  // Enrich mock clients with real Supabase IDs when possible
  useEffect(() => {
    fetchClients().then(realClients => {
      setClients(prev => prev.map(mc => {
        const real = realClients.find(rc => rc.name === mc.name);
        return real ? { ...mc, supabaseId: real.id } : mc;
      }));
    }).catch(() => {});
  }, []);

  // Load files for the selected client
  const loadFiles = useCallback(async (client: MockClient) => {
    setLoading(true);
    let realFiles: VaultFile[] = [];

    try {
      // Try to fetch real uploads via Supabase DB (match by name if we have supabaseId)
      const idToQuery = client.supabaseId ?? client.slug;
      const [reqs, uploads] = await Promise.all([
        fetchDocumentRequirements(idToQuery),
        fetchDocumentUploads(idToQuery),
      ]);

      if (uploads.length > 0) {
        realFiles = uploads.map(u => ({
          id: u.id,
          clientId: client.slug,
          docType: reqs.find(r => r.id === u.requirement_id)?.name ?? inferDocType(u.storage_path),
          taxYear: 2024,
          filename: u.file_name,
          size: u.file_size ?? 0,
          aiStatus: mapDbAiStatus(u.ai_status),
          uploadedAt: u.uploaded_at,
          storagePath: u.storage_path,
        }));
      }
    } catch { /* fall through to mock */ }

    // Merge real files with mocks (real takes precedence)
    const mockForClient = ALL_MOCK_FILES.filter(f => f.clientId === client.slug);
    const merged = realFiles.length > 0
      ? [
          ...realFiles,
          ...mockForClient.filter(m => !realFiles.some(r => r.filename === m.filename)),
        ]
      : mockForClient;

    setFiles(merged);
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(selected); }, [selected, loadFiles]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await (supabase as any).storage.from('documents').remove([deleteTarget.storagePath]);
    } catch { /* ignore if not in storage */ }
    setFiles(prev => prev.filter(f => f.id !== deleteTarget.id));
    toast.success('File deleted');
    setDeleteTarget(null);
    setDeleting(false);
  };

  // Group files by doc type, then build a grid entry per required type
  const grouped = REQUIRED_DOC_TYPES.map(dt => ({
    docType: dt,
    files: files.filter(f => f.docType === dt || f.docType.toLowerCase() === dt.toLowerCase()),
  }));

  // Mobile client selector
  const MobileSelector = (
    <div className="md:hidden mb-4">
      <Select
        value={selected.slug}
        onValueChange={slug => {
          const c = clients.find(x => x.slug === slug);
          if (c) setSelected(c);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select client" />
        </SelectTrigger>
        <SelectContent>
          {clients.map(c => (
            <SelectItem key={c.slug} value={c.slug}>
              {c.name} — {c.docsSubmitted}/{c.docsRequired} docs
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 border-b bg-white shrink-0">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <Archive className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Vault</h1>
            <p className="text-sm text-gray-500">All client-uploaded files with AI validation status</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 gap-4">
        {MobileSelector}

        {/* Left panel — client list (desktop) */}
        <div className="hidden md:flex flex-col w-[280px] shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Clients</p>
          <ScrollArea className="flex-1 border rounded-lg bg-white">
            <div className="p-2 space-y-1">
              {clients.map(c => (
                <button
                  key={c.slug}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-3 py-3 rounded-md transition-colors ${
                    selected.slug === c.slug
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusDot status={c.clientStatus} />
                    <span className="font-medium text-sm text-gray-900 truncate">{c.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 pl-4">
                    {c.docsSubmitted} / {c.docsRequired} docs
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel — file grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Client header */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{selected.name}</h2>
              <p className="text-sm text-gray-500">{selected.email}</p>
            </div>
            <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50 shrink-0">Tax Year 2024</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast('Preparing zip download…')}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download All
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/reminders')}
            >
              Request Missing Docs
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/signatures?client=${selected.slug}`)}
            >
              Request Signature
            </Button>
          </div>

          {/* File grid */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-6 pr-2">
                {grouped.map(({ docType, files: dtFiles }) => (
                  <div key={docType}>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-gray-400" />
                      {docType}
                      {dtFiles.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{dtFiles.length}</Badge>
                      )}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dtFiles.map(f => (
                        <FileCard key={f.id} file={f} onDelete={setDeleteTarget} />
                      ))}
                      {dtFiles.length === 0 && (
                        <PlaceholderCard docType={docType} clientSlug={selected.slug} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" /> Delete File?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <span className="font-medium">{deleteTarget?.filename}</span>? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferDocType(storagePath: string): string {
  const parts = storagePath.split('/');
  if (parts.length >= 4) return parts[3];
  return 'General';
}

function mapDbAiStatus(status: string): FileAiStatus {
  if (status === 'verified') return 'verified';
  if (status === 'flagged')  return 'flagged';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

export default VaultPage;
