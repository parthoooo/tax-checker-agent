import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Upload, LogOut, Mail, Loader2, Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DocumentUpload from './DocumentUpload';
import AnalysisSummary from './AnalysisSummary';
import PendingAccessScreen from './PendingAccessScreen';
import ClientActionRequired from './ClientActionRequired';
import { fetchActiveClientCorrection } from '@/lib/clientCorrections';
import type { ComparisonResult } from '@/lib/documentComparison';
import { toast } from 'sonner';
import {
  fetchClientByAuthUser,
  fetchDocumentRequirements,
  fetchDocumentUploadsForYear,
  saveReminder,
  logActivity,
  submitDocumentsForReview,
  hasClientSubmittedTaxYear,
} from '@/lib/db';
import {
  clientCanSelectTaxYear,
  isTaxYearUploadLocked,
  setClientProfessionFromPortal,
  syncChecklistToProfession,
} from '@/lib/clientPortalSettings';
import { runDocumentAnalysis } from '@/lib/runDocumentAnalysis';
import {
  BUSINESS_TYPE_LABELS,
  CURRENT_TAX_YEAR,
  PRIOR_TAX_YEAR,
  type BusinessType,
} from '@/lib/taxConfig';
import type { Database } from '@/lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type DocReq    = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

interface DocRow extends DocReq {
  upload?: DocUpload;
}

const ClientDashboard: React.FC = () => {
  const { user, session, logout, refreshUser } = useAuth();
  const [refreshingAccess, setRefreshingAccess] = useState(false);

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState<ComparisonResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [clientRecord, setClientRecord] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCorrection, setActiveCorrection] = useState<Awaited<ReturnType<typeof fetchActiveClientCorrection>>>(null);

  const [selectedTaxYear, setSelectedTaxYear] = useState<string>(CURRENT_TAX_YEAR);
  const [yearLocked, setYearLocked] = useState(false);
  const [yearLockReason, setYearLockReason] = useState<string | undefined>();
  const [pendingProfession, setPendingProfession] = useState<BusinessType>('freelancer');
  const [savingProfession, setSavingProfession] = useState(false);
  const [yearSubmitted, setYearSubmitted] = useState(false);

  const loadData = useCallback(async (taxYear = selectedTaxYear) => {
    if (!session?.user?.id) return;

    const client = await fetchClientByAuthUser(session.user.id);
    if (!client) {
      setLoading(false);
      return;
    }

    setClientId(client.id);
    setClientEmail(client.email);
    setClientName(client.name);
    setClientRecord(client);
    setPendingProfession((client.business_type ?? 'freelancer') as BusinessType);

    const lock = await isTaxYearUploadLocked(client.id, taxYear);
    setYearLocked(lock.locked);
    setYearLockReason(lock.reason);

    let reqs = await fetchDocumentRequirements(client.id, taxYear);
    if (
      reqs.length === 0
      && taxYear === PRIOR_TAX_YEAR
      && client.prior_year_upload_enabled
    ) {
      const businessType = (client.business_type ?? 'freelancer') as BusinessType;
      reqs = await syncChecklistToProfession(client.id, taxYear, businessType, {
        lockProfession: false,
      });
    }

    const [uploads, submitted] = await Promise.all([
      fetchDocumentUploadsForYear(client.id, taxYear),
      hasClientSubmittedTaxYear(client.id, taxYear),
    ]);
    setYearSubmitted(submitted);

    const uploadsByReqId = new Map(uploads.map(u => [u.requirement_id, u]));
    setDocs(reqs.map(r => ({ ...r, upload: uploadsByReqId.get(r.id) })));

    fetchActiveClientCorrection(client.id).then(setActiveCorrection).catch(() => setActiveCorrection(null));
    setLoading(false);
  }, [session?.user?.id, selectedTaxYear]);

  useEffect(() => {
    setLoading(true);
    loadData(selectedTaxYear);
  }, [loadData, selectedTaxYear]);

  const refreshAnalysis = useCallback(async () => {
    if (!clientId || !clientName || !clientEmail) return;
    setAnalysisLoading(true);
    try {
      const result = await runDocumentAnalysis(clientId, clientName, clientEmail);
      setAnalysisResult(result);
      await loadData(selectedTaxYear);
    } catch (err: any) {
      toast.error('Analysis failed', { description: err?.message });
    } finally {
      setAnalysisLoading(false);
    }
  }, [clientId, clientName, clientEmail, loadData, selectedTaxYear]);

  const handleUpload = async () => {
    await loadData(selectedTaxYear);
    await refreshAnalysis();
  };

  const handleConfirmProfession = async () => {
    if (!clientId) return;
    setSavingProfession(true);
    try {
      await setClientProfessionFromPortal(clientId, pendingProfession, CURRENT_TAX_YEAR);
      toast.success('Profession saved', {
        description: `Your ${CURRENT_TAX_YEAR} checklist is set for ${BUSINESS_TYPE_LABELS[pendingProfession]}.`,
      });
      await loadData(CURRENT_TAX_YEAR);
      setSelectedTaxYear(CURRENT_TAX_YEAR);
    } catch (err: any) {
      toast.error('Could not save profession', { description: err?.message });
    } finally {
      setSavingProfession(false);
    }
  };

  const uploadedCount  = docs.filter(d => d.required && d.upload).length;
  const verifiedCount  = docs.filter(d => d.required && d.upload?.ai_status === 'verified').length;
  const totalCount     = docs.filter(d => d.required).length;
  const progress       = totalCount > 0 ? (uploadedCount / totalCount) * 100 : 0;
  const allSlotsFilled = totalCount > 0 && uploadedCount === totalCount;
  const alreadySubmitted =
    selectedTaxYear === CURRENT_TAX_YEAR
      ? clientRecord?.status === 'complete' && allSlotsFilled
      : yearSubmitted && allSlotsFilled;
  const missingDocs    = docs.filter(d => d.required && !d.upload).map(d => `${d.tax_year} ${d.name}`);
  const existingFilenames = docs.filter(d => d.upload).map(d => d.upload!.file_name);

  const availableYears = [CURRENT_TAX_YEAR, PRIOR_TAX_YEAR].filter(
    y => clientRecord && clientCanSelectTaxYear(clientRecord, y),
  );

  const hasChecklist = docs.some(d => d.required);
  const needsProfessionSetup = clientRecord && !clientRecord.profession_locked && !hasChecklist;

  const handleSubmitForReview = async () => {
    if (!clientId || !allSlotsFilled || submitting || alreadySubmitted) return;
    setSubmitting(true);
    try {
      await submitDocumentsForReview(clientId, {
        clientName,
        clientEmail,
        actorName: user?.name ?? 'Client',
        uploadedCount,
        requiredCount: totalCount,
        documentNames: docs.filter(d => d.required && d.upload).map(d => d.name),
        taxYear: selectedTaxYear,
      });
      setYearSubmitted(true);
      if (selectedTaxYear === CURRENT_TAX_YEAR) {
        setClientRecord(prev => prev ? {
          ...prev,
          status: 'complete',
          documents_submitted: uploadedCount,
          documents_required: totalCount,
          last_activity: new Date().toISOString(),
        } : prev);
      } else {
        setClientRecord(prev => prev ? {
          ...prev,
          last_activity: new Date().toISOString(),
        } : prev);
      }
      toast.success('Documents submitted for review', {
        description: `Your ${selectedTaxYear} package was sent to your preparer. Flagged items will be reviewed with your upload.`,
      });
    } catch (err: any) {
      toast.error('Submission failed', { description: err?.message ?? 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const sendSelfReminder = async () => {
    if (!clientId) return;
    try {
      const subject = 'Action Required: Missing Tax Documents';
      const body    = `Hi ${user?.name?.split(' ')[0]},\n\nYou are still missing: ${missingDocs.join(', ')}.\n\nPlease log in to your portal to upload them.\n\n— Broder Mansoor Muqtadir, Inc.`;

      await saveReminder({ client_id: clientId, sent_by: session?.user?.id ?? null, to_email: clientEmail, subject, body });
      await logActivity({ client_id: clientId, actor: user?.name ?? 'Client', actor_type: 'client', action: 'Sent self-reminder for missing documents' });

      toast.success('Reminder sent', { description: `Sent to ${clientEmail}` });
    } catch (err: any) {
      toast.error('Failed to send reminder', { description: err?.message });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (user?.approvalStatus === 'pending' || user?.approvalStatus === 'rejected') {
    return (
      <PendingAccessScreen
        status={user.approvalStatus}
        email={user.email}
        onRefresh={async () => {
          setRefreshingAccess(true);
          try {
            await refreshUser();
          } finally {
            setRefreshingAccess(false);
          }
        }}
        onLogout={logout}
        refreshing={refreshingAccess}
      />
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="text-lg font-semibold">Almost ready</h2>
            <p className="text-sm text-muted-foreground">
              Your account was approved but your document checklist is still loading. Click below or contact your preparer.
            </p>
            <Button variant="default" onClick={() => refreshUser().then(() => loadData())}>
              Refresh
            </Button>
            <Button variant="outline" onClick={logout}>Sign Out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsProfessionSetup) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-blue-900">Broder Mansoor Portal</h1>
            <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2" />Logout</Button>
          </div>
        </header>
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle>What best describes your tax situation?</CardTitle>
              <p className="text-sm text-muted-foreground">
                We will build your document checklist from your profession. You can change this later only if your preparer unlocks it.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={pendingProfession} onValueChange={v => setPendingProfession(v as BusinessType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map(key => (
                    <SelectItem key={key} value={key}>{BUSINESS_TYPE_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleConfirmProfession} disabled={savingProfession} className="w-full">
                {savingProfession ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Continue to document checklist
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-blue-900">Broder Mansoor Muqtadir, Inc. Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome back, {user?.name}</p>
            </div>
            <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2" />Logout</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeCorrection && (
          <ClientActionRequired
            comparison={activeCorrection.comparison}
            staffMessage={activeCorrection.staff_message}
            sentAt={activeCorrection.sent_at}
            sentBy={activeCorrection.sent_by}
          />
        )}

        <Card className="mb-6">
          <CardContent className="pt-6 flex flex-wrap items-end gap-4">
            <div className="space-y-2 min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profession</p>
              <Badge variant="secondary" className="text-sm py-1 px-3">
                {BUSINESS_TYPE_LABELS[(clientRecord?.business_type ?? 'freelancer') as BusinessType]}
              </Badge>
              {clientRecord?.profession_locked && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Locked — contact preparer to change
                </p>
              )}
            </div>
            <div className="space-y-2 min-w-[160px]">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax year</p>
              <Select value={selectedTaxYear} onValueChange={setSelectedTaxYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {yearLocked && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="pt-4 pb-4 flex items-start gap-2">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">{yearLockReason}</p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Document Submission Progress — {selectedTaxYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium">
                  {uploadedCount} of {totalCount} slots filled
                  {verifiedCount < uploadedCount && (
                    <span className="text-muted-foreground"> · {verifiedCount} verified</span>
                  )}
                </span>
                <Badge variant={allSlotsFilled ? 'default' : 'secondary'}>{Math.round(progress)}% Complete</Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {selectedTaxYear === CURRENT_TAX_YEAR && (
          <>
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={refreshAnalysis} disabled={analysisLoading}>
                {analysisLoading ? 'Analyzing…' : 'Run AI Analysis'}
              </Button>
            </div>
            <AnalysisSummary result={analysisResult} loading={analysisLoading} />
          </>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Required Documents — Tax Year {selectedTaxYear}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload each required document. Each file is saved as soon as it uploads. Flagged files can still be submitted — your preparer will review them.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {docs.filter(d => d.required).map((doc) => {
                const hasUpload = !!doc.upload;
                const verified = doc.upload?.ai_status === 'verified';
                return (
                  <div key={doc.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {verified ? <CheckCircle className="w-5 h-5 text-green-500" /> : hasUpload ? <AlertCircle className="w-5 h-5 text-amber-500" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                        <div>
                          <h3 className="font-medium">{doc.name} ({doc.tax_year})</h3>
                          {doc.upload && (
                            <p className="text-sm text-muted-foreground">
                              Uploaded: {doc.upload.file_name} on {new Date(doc.upload.uploaded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={verified ? 'default' : hasUpload ? 'destructive' : 'secondary'}>
                        {verified ? 'Verified' : hasUpload ? 'Flagged' : 'Pending'}
                      </Badge>
                    </div>
                    <DocumentUpload
                      documentId={doc.id}
                      documentName={doc.name}
                      docType={doc.doc_type}
                      clientId={clientId}
                      clientEmail={clientEmail}
                      clientName={clientName}
                      existingFilenames={existingFilenames.filter(n => n !== doc.upload?.file_name)}
                      onUpload={handleUpload}
                      onAnalysisComplete={refreshAnalysis}
                      replaceMode={!!doc.upload}
                      existingUploadId={doc.upload?.id}
                      taxYear={selectedTaxYear}
                      uploadDisabled={yearLocked}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {missingDocs.length > 0 && !yearLocked && (
          <Card className="mb-8 border-yellow-300 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-yellow-900">Still Missing</p>
                  <p className="text-sm text-yellow-800 mt-1">{missingDocs.join(', ')}</p>
                </div>
                <Button variant="outline" className="border-yellow-400" onClick={sendSelfReminder}>
                  <Mail className="w-4 h-4 mr-2" />Email Reminder to Myself
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {totalCount > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {alreadySubmitted ? (
                  <>
                    <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
                    <h3 className="text-lg font-medium">Submitted for Review</h3>
                    <p className="text-muted-foreground">
                      Your {selectedTaxYear} documents were sent to your preparer
                      {clientRecord?.last_activity && (
                        <> on {new Date(clientRecord.last_activity).toLocaleDateString()}</>
                      )}.
                      You will be contacted if anything else is needed.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium">Ready to Submit?</h3>
                    <p className="text-muted-foreground">
                      Uploads are saved immediately. Submit when every required slot has a file — this notifies your preparer to review your {selectedTaxYear} package. Flagged documents are OK.
                    </p>
                    <Button
                      size="lg"
                      disabled={!allSlotsFilled || submitting}
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleSubmitForReview}
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {submitting ? 'Submitting…' : `Submit ${selectedTaxYear} for Review`}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">Powered by SJ Innovation AI</footer>
    </div>
  );
};

export default ClientDashboard;
