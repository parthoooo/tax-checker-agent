import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Upload, LogOut, Mail, Loader2 } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import AnalysisSummary from './AnalysisSummary';
import PendingAccessScreen from './PendingAccessScreen';
import { toast } from 'sonner';
import {
  fetchClientByAuthUser,
  fetchDocumentRequirements,
  fetchDocumentUploads,
  saveReminder,
  logActivity,
  submitDocumentsForReview,
} from '@/lib/db';
import type { Database } from '@/lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
import { runDocumentAnalysis } from '@/lib/runDocumentAnalysis';
import type { ComparisonResult } from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR } from '@/lib/taxConfig';
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

  const loadData = useCallback(async () => {
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

    const [reqs, uploads] = await Promise.all([
      fetchDocumentRequirements(client.id, CURRENT_TAX_YEAR),
      fetchDocumentUploads(client.id, CURRENT_TAX_YEAR),
    ]);

    const uploadsByReqId = new Map(uploads.map(u => [u.requirement_id, u]));
    setDocs(reqs.map(r => ({ ...r, upload: uploadsByReqId.get(r.id) })));
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshAnalysis = useCallback(async () => {
    if (!clientId || !clientName || !clientEmail) return;
    setAnalysisLoading(true);
    try {
      const result = await runDocumentAnalysis(clientId, clientName, clientEmail);
      setAnalysisResult(result);
      await loadData();
    } catch (err: any) {
      toast.error('Analysis failed', { description: err?.message });
    } finally {
      setAnalysisLoading(false);
    }
  }, [clientId, clientName, clientEmail, loadData]);

  const handleUpload = async (_reqId: string, _file: File) => {
    await refreshAnalysis();
  };

  const submittedCount = docs.filter(d => d.upload?.ai_status === 'verified').length;
  const totalCount     = docs.filter(d => d.required).length;
  const progress       = totalCount > 0 ? (submittedCount / totalCount) * 100 : 0;
  const allDone        = totalCount > 0 && submittedCount === totalCount;
  const alreadySubmitted = clientRecord?.status === 'complete' && submittedCount === totalCount;
  const missingDocs    = docs.filter(d => d.required && (!d.upload || d.upload.ai_status !== 'verified')).map(d => `${d.tax_year} ${d.name}`);
  const existingFilenames = docs.filter(d => d.upload).map(d => d.upload!.file_name);

  const handleSubmitForReview = async () => {
    if (!clientId || !allDone || submitting || alreadySubmitted) return;
    setSubmitting(true);
    try {
      await submitDocumentsForReview(clientId, {
        clientName,
        clientEmail,
        actorName: user?.name ?? 'Client',
        verifiedCount: submittedCount,
        requiredCount: totalCount,
        documentNames: docs
          .filter(d => d.required && d.upload?.ai_status === 'verified')
          .map(d => d.name),
      });
      setClientRecord(prev => prev ? {
        ...prev,
        status: 'complete',
        documents_submitted: submittedCount,
        documents_required: totalCount,
        last_activity: new Date().toISOString(),
      } : prev);
      toast.success('Documents submitted for review', {
        description: 'Your preparer has been notified. They will contact you if anything else is needed.',
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
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Document Submission Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{submittedCount} of {totalCount} documents submitted</span>
                <Badge variant={allDone ? 'default' : 'secondary'}>{Math.round(progress)}% Complete</Badge>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end mb-4">
          <Button variant="outline" onClick={refreshAnalysis} disabled={analysisLoading}>
            {analysisLoading ? 'Analyzing…' : 'Run AI Analysis'}
          </Button>
        </div>

        <AnalysisSummary result={analysisResult} loading={analysisLoading} />

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Required Documents — Tax Year {CURRENT_TAX_YEAR}</CardTitle>
            <p className="text-sm text-muted-foreground">Upload your required documents below. Our AI verifies each file and compares against your {PRIOR_TAX_YEAR} filings.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {docs.filter(d => d.required).map((doc) => {
                const submitted = doc.upload?.ai_status === 'verified';
                return (
                  <div key={doc.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {submitted ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                        <div>
                          <h3 className="font-medium">{doc.name} ({doc.tax_year})</h3>
                          {doc.upload && (
                            <p className="text-sm text-muted-foreground">
                              Uploaded: {doc.upload.file_name} on {new Date(doc.upload.uploaded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant={submitted ? 'default' : doc.upload ? 'destructive' : 'secondary'}>
                        {submitted ? 'Verified' : doc.upload ? 'Issue' : 'Pending'}
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
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {missingDocs.length > 0 && (
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

        {analysisResult && (analysisResult.missing.length > 0 || analysisResult.wrongYear.length > 0) && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900">
                A follow-up email has been drafted for your preparer to review. They will contact you if anything else is needed.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {alreadySubmitted ? (
                <>
                  <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
                  <h3 className="text-lg font-medium">Submitted for Review</h3>
                  <p className="text-muted-foreground">
                    Your {CURRENT_TAX_YEAR} documents were sent to your preparer
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
                    Submit unlocks when every required document shows <strong>Verified</strong> (green). Documents with an Issue badge must be replaced first.
                  </p>
                  <Button
                    size="lg"
                    disabled={!allDone || submitting}
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleSubmitForReview}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {submitting ? 'Submitting…' : 'Submit for Review'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">Powered by SJ Innovation AI</footer>
    </div>
  );
};

export default ClientDashboard;
