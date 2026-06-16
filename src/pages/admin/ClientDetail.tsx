import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { statusBadge, initials } from '@/lib/mockData';
import { ArrowLeft, Mail, Link2, Loader2, CheckCircle2, AlertCircle, Clock, Copy, Send, RotateCcw, Eye, FolderOpen, Sparkles } from 'lucide-react';
import ReminderModal from '@/components/common/ReminderModal';
import InputSheet from '@/components/client/InputSheet';
import AnalysisSummary from '@/components/client/AnalysisSummary';
import TimeTracker from '@/components/client/TimeTracker';
import MagicLinksPanel from '@/components/admin/MagicLinksPanel';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  fetchClientById,
  fetchDocumentRequirements,
  fetchDocumentUploads,
  fetchAiFlags,
  fetchActivityLog,
  resolveAiFlag,
  generateMagicToken,
  logActivity,
  resetClientDocuments,
  getDocumentSignedUrl,
  updateClientBusinessType,
  seedPriorYearTestBaseline,
} from '@/lib/db';
import { getDocumentComparison } from '@/lib/getDocumentComparison';
import { sendClientCorrection, resolveClientCorrection } from '@/lib/clientCorrections';
import {
  setPriorYearUploadEnabled,
  unlockTaxYearUpload,
  unlockClientProfession,
} from '@/lib/clientPortalSettings';
import { useAuth } from '@/contexts/AuthContext';
import type { ComparisonResult } from '@/lib/documentComparison';
import {
  BUSINESS_TYPE_LABELS,
  CURRENT_TAX_YEAR,
  PRIOR_TAX_YEAR,
  type BusinessType,
} from '@/lib/taxConfig';
import type { Database } from '@/lib/database.types';

type Client    = Database['public']['Tables']['clients']['Row'];
type DocReq    = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];
type AiFlag    = Database['public']['Tables']['ai_flags']['Row'];
type Activity  = Database['public']['Tables']['activity_log']['Row'] & { clients: { name: string } | null };

const ClientDetail: React.FC = () => {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [requirements, setRequirements] = useState<DocReq[]>([]);
  const [uploads, setUploads] = useState<DocUpload[]>([]);
  const [flags, setFlags] = useState<(AiFlag & { clients: { name: string; email: string } | null })[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [note, setNote] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sentReqIds, setSentReqIds] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ComparisonResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [seedingBaseline, setSeedingBaseline] = useState(false);
  const [savingBusinessType, setSavingBusinessType] = useState(false);
  const [portalSaving, setPortalSaving] = useState(false);

  const reloadClientData = async () => {
    const [c, reqs, ups, allFlags, allActivity] = await Promise.all([
      fetchClientById(id),
      fetchDocumentRequirements(id),
      fetchDocumentUploads(id),
      fetchAiFlags(false),
      fetchActivityLog(),
    ]);
    setClient(c);
    setRequirements(reqs);
    setUploads(ups);
    setFlags(allFlags.filter(f => f.client_id === id));
    setActivity(allActivity.filter(a => a.client_id === id));
  };

  useEffect(() => {
    if (!id) return;
    reloadClientData()
      .catch(() => toast.error('Failed to load client'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopyPortalLink = async () => {
    if (!client) return;
    setGeneratingLink(true);
    try {
      const token = await generateMagicToken(client.id);
      const url = `${window.location.origin}/upload/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Portal link copied!', { description: 'Share this link with the client to upload documents.' });
    } catch {
      toast.error('Failed to generate link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleResolveFlag = async (flagId: string) => {
    try {
      await resolveAiFlag(flagId);
      if (client) {
        await logActivity({ client_id: client.id, actor: user?.name ?? 'Staff', actor_type: 'staff', action: 'Resolved AI flag' });
      }
      setFlags(prev => prev.filter(f => f.id !== flagId));
      toast.success('Flag resolved');
    } catch {
      toast.error('Failed to resolve flag');
    }
  };

  const handleRunAiReview = async () => {
    if (!client) return;
    setAnalysisLoading(true);
    try {
      setAnalysisResult(await getDocumentComparison(client.id));
    } catch (err: any) {
      toast.error('AI review failed', { description: err?.message });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleSendCorrection = async () => {
    if (!client || !analysisResult) return;
    setSendingCorrection(true);
    try {
      await sendClientCorrection(client.id, {
        clientName: client.name,
        clientEmail: client.email,
        comparison: analysisResult,
        staffMessage: correctionMessage,
        sentByName: user?.name ?? 'Staff',
        preparerName: client.assigned_preparer ?? 'Your Tax Preparer',
      });
      setCorrectionOpen(false);
      setCorrectionMessage('');
      toast.success('Correction checklist sent', {
        description: 'Client will see it on their portal. Email draft added to Outbox.',
      });
    } catch (err: any) {
      toast.error('Failed to send correction', { description: err?.message });
    } finally {
      setSendingCorrection(false);
    }
  };

  const handleClearCorrection = async () => {
    if (!client) return;
    try {
      await resolveClientCorrection(client.id);
      toast.success('Correction cleared from client portal');
    } catch (err: any) {
      toast.error('Failed to clear correction', { description: err?.message });
    }
  };

  const handleSeedPriorBaseline = async () => {
    if (!client) return;
    setSeedingBaseline(true);
    try {
      const businessType = (client.business_type ?? 'freelancer') as BusinessType;
      await seedPriorYearTestBaseline(client.id, businessType);
      await reloadClientData();
      toast.success(`${PRIOR_TAX_YEAR} test baseline created`, {
        description: 'Admin-only YoY comparison seeds (not client uploads). Client portal is unchanged.',
      });
    } catch (err: any) {
      toast.error('Baseline setup failed', { description: err?.message });
    } finally {
      setSeedingBaseline(false);
    }
  };

  const handleBusinessTypeChange = async (value: BusinessType) => {
    if (!client) return;
    setSavingBusinessType(true);
    try {
      await updateClientBusinessType(client.id, value, CURRENT_TAX_YEAR);
      await reloadClientData();
      toast.success('Profession applied', {
        description: `${CURRENT_TAX_YEAR} checklist updated for ${BUSINESS_TYPE_LABELS[value]}.`,
      });
    } catch (err: any) {
      toast.error('Update failed', { description: err?.message });
    } finally {
      setSavingBusinessType(false);
    }
  };

  const handleTogglePriorYear = async () => {
    if (!client) return;
    setPortalSaving(true);
    try {
      const next = !client.prior_year_upload_enabled;
      await setPriorYearUploadEnabled(client.id, next);
      await reloadClientData();
      toast.success(next ? `${PRIOR_TAX_YEAR} uploads enabled on portal` : `${PRIOR_TAX_YEAR} uploads disabled`);
    } catch (err: any) {
      toast.error('Update failed', { description: err?.message });
    } finally {
      setPortalSaving(false);
    }
  };

  const handleUnlockYear = async (taxYear: string) => {
    if (!client) return;
    setPortalSaving(true);
    try {
      await unlockTaxYearUpload(client.id, taxYear);
      await reloadClientData();
      toast.success(`${taxYear} re-upload unlocked for client`);
    } catch (err: any) {
      toast.error('Unlock failed', { description: err?.message });
    } finally {
      setPortalSaving(false);
    }
  };

  const handleUnlockProfession = async () => {
    if (!client) return;
    setPortalSaving(true);
    try {
      await unlockClientProfession(client.id);
      await reloadClientData();
      toast.success('Client can change profession on portal again');
    } catch (err: any) {
      toast.error('Unlock failed', { description: err?.message });
    } finally {
      setPortalSaving(false);
    }
  };

  const handlePreviewFile = async (storagePath: string) => {
    const url = await getDocumentSignedUrl(storagePath);
    if (url) window.open(url, '_blank');
    else toast.error('Preview unavailable — file may not be in storage yet.');
  };

  const handleResetDocuments = async () => {
    if (!client) return;
    setResetting(true);
    try {
      await resetClientDocuments(client.id);
      await logActivity({
        client_id: client.id,
        actor: 'Staff',
        actor_type: 'staff',
        action: 'Reset all current-year document uploads (admin)',
      });
      await reloadClientData();
      toast.success('Documents reset', {
        description: `${client.name}'s ${CURRENT_TAX_YEAR} checklist is empty and ready for fresh uploads.`,
      });
    } catch (err: any) {
      toast.error('Reset failed', { description: err?.message ?? 'Please try again.' });
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell>
        <div className="text-center py-20 text-gray-400">Client not found.</div>
      </PageShell>
    );
  }

  // Map requirements to upload status
  const docRows = requirements.map(req => {
    const upload = uploads.find(u => u.requirement_id === req.id);
    return { req, upload };
  });

  const clientActivity = activity.filter(a => a.client_id === id);

  return (
    <PageShell>
      <PageHeader
        title={client.name}
        subtitle={`${client.email}${client.phone ? ' · ' + client.phone : ''}`}
        actions={
          <>
            <TimeTracker clientId={client.id} />
            <Button variant="outline" asChild>
              <Link to="/clients"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyPortalLink}
              disabled={generatingLink}
            >
              {generatingLink
                ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                : <Link2 className="w-4 h-4 mr-1" />}
              Copy Portal Link
            </Button>
            <Button onClick={() => setReminderOpen(true)}>
              <Mail className="w-4 h-4 mr-1" /> Send Reminder
            </Button>
          </>
        }
      />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Client info card */}
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center gap-6">
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-lg font-semibold">
              {initials(client.name)}
            </div>
            <div className="flex-1">
              <p className="font-medium">{client.name}</p>
              <p className="text-sm text-gray-500">{client.email}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Badge className={statusBadge(client.status as any)}>{client.status}</Badge>
              {client.assigned_staff && <Badge variant="outline">Assigned: {client.assigned_staff}</Badge>}
              <Badge variant="outline">
                {client.documents_submitted}/{client.documents_required} docs
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="docs">
          <TabsList>
            <TabsTrigger value="docs">Document Checklist</TabsTrigger>
            <TabsTrigger value="input-sheet">
              Input Sheet
              {uploads.length > 0 && (
                <span className="ml-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-1.5 py-0.5">AI</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="flags">
              AI Flags
              {flags.length > 0 && (
                <span className="ml-1.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full px-1.5 py-0.5">{flags.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="notes">Internal Notes</TabsTrigger>
            <TabsTrigger value="magic-links">Magic Links</TabsTrigger>
          </TabsList>

          {/* Document Checklist */}
          <TabsContent value="docs" className="space-y-4">
            <Card>
              <CardContent className="pt-6 flex flex-wrap items-end gap-4">
                <div className="space-y-2 min-w-[220px]">
                  <Label>Business / profession</Label>
                  <Select
                    value={(client.business_type ?? 'freelancer') as BusinessType}
                    onValueChange={(v) => handleBusinessTypeChange(v as BusinessType)}
                    disabled={savingBusinessType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map(key => (
                        <SelectItem key={key} value={key}>{BUSINESS_TYPE_LABELS[key]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleSeedPriorBaseline} disabled={seedingBaseline}>
                  {seedingBaseline ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Set up {PRIOR_TAX_YEAR} test baseline
                </Button>
                <p className="text-xs text-muted-foreground w-full">
                  Seeds verified placeholder {PRIOR_TAX_YEAR} files for YoY AI comparison only — clients do not upload here.
                </p>
                <Button variant="outline" onClick={handleTogglePriorYear} disabled={portalSaving}>
                  {client.prior_year_upload_enabled ? `Disable ${PRIOR_TAX_YEAR} on portal` : `Enable ${PRIOR_TAX_YEAR} on portal`}
                </Button>
                <Button variant="outline" onClick={() => handleUnlockYear(CURRENT_TAX_YEAR)} disabled={portalSaving}>
                  Unlock {CURRENT_TAX_YEAR} re-upload
                </Button>
                <Button variant="outline" onClick={() => handleUnlockYear(PRIOR_TAX_YEAR)} disabled={portalSaving}>
                  Unlock {PRIOR_TAX_YEAR} re-upload
                </Button>
                {client.profession_locked && (
                  <Button variant="outline" onClick={handleUnlockProfession} disabled={portalSaving}>
                    Unlock profession on portal
                  </Button>
                )}
                <Button variant="outline" onClick={handleRunAiReview} disabled={analysisLoading}>
                  {analysisLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Run AI Review
                </Button>
                <Button
                  onClick={() => setCorrectionOpen(true)}
                  disabled={!analysisResult || analysisLoading}
                >
                  <Send className="w-4 h-4 mr-1" /> Send correction to client
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearCorrection}>
                  Clear client checklist
                </Button>
              </CardContent>
            </Card>

            <AnalysisSummary result={analysisResult} loading={analysisLoading} />

            <div className="flex justify-end mb-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={resetting} className="text-red-700 border-red-200 hover:bg-red-50">
                    {resetting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                    Reset {CURRENT_TAX_YEAR} Documents
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset client documents?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes all {CURRENT_TAX_YEAR} uploads, AI flags, and pending email drafts for{' '}
                      <strong>{client.name}</strong>. Storage files are deleted and a fresh empty checklist is created.
                      The client account, magic links, and {PRIOR_TAX_YEAR} baseline are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetDocuments}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Reset documents
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <th className="py-3 px-4">Document</th>
                      <th className="py-3 px-4">Year</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">AI Result</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docRows.map(({ req, upload }) => {
                      const aiStatus = upload?.ai_status;
                      const statusLabel =
                        !upload          ? 'Pending' :
                        aiStatus === 'verified' ? 'Verified' :
                        aiStatus === 'flagged'  ? 'Flagged' :
                        aiStatus === 'rejected' ? 'Rejected' :
                        'Analyzing';
                      const statusCls =
                        !upload          ? 'bg-gray-100 text-gray-500' :
                        aiStatus === 'verified' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700';
                      const aiLabel =
                        !upload          ? '—' :
                        aiStatus === 'verified' ? '✅ Verified' :
                        aiStatus === 'flagged'  ? '⚠️ Flagged' :
                        aiStatus === 'rejected' ? '🔴 Rejected' :
                        '⏳ Analyzing';

                      return (
                        <tr key={req.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{req.name}</td>
                          <td className="py-3 px-4">{req.tax_year}</td>
                          <td className="py-3 px-4">
                            <Badge className={statusCls}>{statusLabel}</Badge>
                          </td>
                          <td className="py-3 px-4 text-sm">{aiLabel}</td>
                          <td className="py-3 px-4 text-gray-600 text-xs">{upload?.file_name ?? '—'}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">
                            {upload ? new Date(upload.uploaded_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4">
                            {upload?.storage_path ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" onClick={() => handlePreviewFile(upload.storage_path)}>
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                                </Button>
                                <Button size="sm" variant="ghost" asChild>
                                  <Link to={`/vault?client=${client.id}`}>
                                    <FolderOpen className="w-3.5 h-3.5 mr-1" /> Vault
                                  </Link>
                                </Button>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {docRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-gray-400">No document requirements set.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Input Sheet */}
          <TabsContent value="input-sheet">
            <InputSheet clientId={client.id} clientName={client.name} />
          </TabsContent>

          {/* AI Flags */}
          <TabsContent value="flags" className="space-y-3">
            {flags.length === 0 && (
              <Card>
                <CardContent className="pt-6 pb-6 flex items-center gap-3 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-sm">No open AI flags for this client.</p>
                </CardContent>
              </Card>
            )}
            {flags.map(flag => (
              <Card key={flag.id} className={`border-l-4 ${flag.severity === 'HIGH' ? 'border-l-red-500' : flag.severity === 'MEDIUM' ? 'border-l-amber-400' : 'border-l-blue-300'}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 mt-0.5 shrink-0 ${flag.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500'}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={flag.severity === 'HIGH' ? 'bg-red-100 text-red-700' : flag.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
                          {flag.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">{flag.flag_type.replace('-', ' ')}</Badge>
                      </div>
                      <p className="text-sm mt-1">{flag.description}</p>
                      <p className="text-xs text-gray-400 mt-1">Detected by {flag.detected_by}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleResolveFlag(flag.id)}>
                      Resolve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Activity Log */}
          <TabsContent value="activity">
            <Card>
              <CardContent className="pt-6 space-y-3">
                {clientActivity.length === 0 && (
                  <p className="text-sm text-gray-400">No activity yet for this client.</p>
                )}
                {clientActivity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 border-b last:border-0 pb-3 last:pb-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      a.actor_type === 'ai'     ? 'bg-purple-100 text-purple-700' :
                      a.actor_type === 'staff'  ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {a.actor_type === 'ai' ? 'AI' : a.actor.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm"><span className="font-medium">{a.actor}</span> — {a.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Internal Notes */}
          <TabsContent value="notes">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="border-l-4 border-l-blue-400 bg-blue-50 p-3 rounded">
                  <p className="text-sm">Client confirmed they will re-upload the correct 2024 W-2 by Friday.</p>
                  <p className="text-xs text-gray-500 mt-1">— {client.assigned_staff ?? 'Staff'}, recent</p>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Add an internal note..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <Button onClick={() => { toast.success('Note saved'); setNote(''); }}>Save Note</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Magic Links */}
          <TabsContent value="magic-links" className="space-y-4">
            <MagicLinksPanel
              client={client}
              requirements={requirements}
              uploads={uploads}
              sentReqIds={sentReqIds}
              setSentReqIds={setSentReqIds}
              onTokenRefresh={(updated) => setClient(updated)}
            />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send correction checklist to client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This posts the AI review checklist to the client&apos;s portal and creates an Outbox email draft for you to approve and send.
          </p>
          <div className="space-y-2">
            <Label htmlFor="correction-note">Optional note to client</Label>
            <Textarea
              id="correction-note"
              rows={3}
              placeholder="e.g. Please re-upload your Schedule C for 2025 — the file looks like a 1099."
              value={correctionMessage}
              onChange={e => setCorrectionMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
            <Button onClick={handleSendCorrection} disabled={sendingCorrection}>
              {sendingCorrection ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Send to client portal + Outbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        clientId={client.id}
        clientName={client.name}
        clientEmail={client.email}
      />
    </PageShell>
  );
};

export default ClientDetail;
