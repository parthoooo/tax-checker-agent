import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, AlertCircle, Clock, Upload, FileText, Loader2, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveMagicLink, submitDocumentsViaMagicLink } from '@/lib/magicLinkDb';
import {
  createDocumentUpload,
  replaceDocumentUpload,
  createAiFlag,
  createEmailDraft,
  logActivity,
  notifyPreparerOfSubmission,
} from '@/lib/db';
import { buildEmailDraftBody } from '@/lib/aiSimulation';
import { uploadDocumentToStorage } from '@/utils/uploadDocument';
import { analyzeDocument } from '@/utils/analyzeDocument';
import { runDocumentAnalysis } from '@/lib/runDocumentAnalysis';
import AnalysisSummary from '@/components/client/AnalysisSummary';
import type { ComparisonResult } from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR, CURRENT_TAX_YEAR_NUM } from '@/lib/taxConfig';
import type { Database } from '@/lib/database.types';
type DocReq    = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'done';

interface ReqWithUpload extends DocReq {
  upload?: DocUpload;
  uploadState?: UploadState;
  validationResult?: { title: string; detail: string; aiStatus: DocUpload['ai_status'] };
}

const MagicLinkPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<any>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<ReqWithUpload[]>([]);
  const [analysisResult, setAnalysisResult] = useState<ComparisonResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const refreshAnalysis = useCallback(async () => {
    if (!client) return;
    setAnalysisLoading(true);
    try {
      const result = await runDocumentAnalysis(
        client.id,
        client.name,
        client.email,
        client.assigned_preparer ?? 'Your Tax Preparer',
      );
      setAnalysisResult(result);
    } finally {
      setAnalysisLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    resolveMagicLink(token).then(result => {
      if (result === null) { setTokenExpired(true); setLoading(false); return; }
      if (result === 'expired') { setTokenExpired(true); setLoading(false); return; }
      setClient(result.client);
      setSubmitted(result.client.status === 'complete');
      const uploadsByReq = new Map(result.uploads.map(u => [u.requirement_id, u]));
      setRequirements(result.requirements.map(req => ({
        ...req,
        upload: uploadsByReq.get(req.id),
      })));
    }).catch(() => setTokenExpired(true)).finally(() => setLoading(false));
  }, [token]);

  const handleFileChange = useCallback(async (req: ReqWithUpload, file: File) => {
    if (!client) return;

    setRequirements(prev => prev.map(r =>
      r.id === req.id ? { ...r, uploadState: 'uploading' } : r
    ));

    await new Promise(r => setTimeout(r, 600));

    setRequirements(prev => prev.map(r =>
      r.id === req.id ? { ...r, uploadState: 'analyzing' } : r
    ));

    const existingNames = requirements
      .filter(r => r.upload && r.id !== req.id)
      .map(r => r.upload!.file_name);

    const analysis = await analyzeDocument({
      fileName: file.name,
      mimeType: file.type,
      requirementDocType: req.doc_type,
      clientId: client.id,
      existingFilenames: existingNames,
    });

    const aiDbStatus = analysis.aiStatus === 'verified' ? 'verified' : 'flagged';
    let storagePath = `clients/${client.id}/${CURRENT_TAX_YEAR}/${req.doc_type}/${file.name.replace(/\s+/g, '_')}`;

    if (analysis.aiStatus === 'verified') {
      const stored = await uploadDocumentToStorage(
        file, client.id, req.doc_type, CURRENT_TAX_YEAR_NUM, !!req.upload,
      );
      if (stored.storagePath) storagePath = stored.storagePath;
    } else if (req.upload) {
      const stored = await uploadDocumentToStorage(
        file, client.id, req.doc_type, CURRENT_TAX_YEAR_NUM, true,
      );
      if (!stored.success) {
        setRequirements(prev => prev.map(r =>
          r.id === req.id ? { ...r, uploadState: 'idle' } : r
        ));
        toast.error('Upload failed', { description: stored.error });
        return;
      }
      if (stored.storagePath) storagePath = stored.storagePath;
    }

    try {
      const uploadPayload = {
        client_id: client.id,
        requirement_id: req.id,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        ai_status: aiDbStatus as 'verified' | 'flagged',
        tax_year: CURRENT_TAX_YEAR,
        is_prior_year: false,
        uploaded_by: null,
      };

      const upload = req.upload
        ? await replaceDocumentUpload(req.upload.id, uploadPayload)
        : await createDocumentUpload(uploadPayload);

      if (analysis.aiStatus !== 'verified') {
        const flagTypeMap: Record<string, 'wrong-year' | 'duplicate' | 'unexpected'> = {
          wrong_year: 'wrong-year',
          duplicate:  'duplicate',
          unexpected: 'unexpected',
        };
        const ft = flagTypeMap[analysis.aiStatus] ?? 'unexpected';
        await createAiFlag({
          client_id:   client.id,
          upload_id:   upload.id,
          flag_type:   ft,
          severity:    ft === 'wrong-year' ? 'HIGH' : 'MEDIUM',
          description: analysis.aiMessage,
          detected_by: 'Doc Classifier Agent',
        });

        const draftResult = {
          outcome: ft === 'wrong-year' ? 'wrong-year' : ft === 'duplicate' ? 'duplicate' : 'unexpected',
          title: 'Issue Detected',
          detail: analysis.aiMessage,
          aiStatus: 'flagged' as const,
          confidence: analysis.confidence,
        };
        const emailContent = buildEmailDraftBody(
          client.name,
          draftResult as any,
          file.name,
          client.assigned_preparer ?? 'Your Tax Preparer'
        );
        await createEmailDraft({
          client_id:  client.id,
          to_email:   client.email,
          from_label: client.assigned_preparer ?? 'Your Tax Preparer',
          subject:    emailContent.subject,
          body:       emailContent.body,
          status:     'pending',
          type:       'outbox',
        });
      }

      await logActivity({
        client_id: client.id,
        actor: client.name,
        actor_type: 'client',
        action: `Uploaded ${file.name} via magic link portal`,
      });

      await refreshAnalysis();

      const validationResult = {
        outcome: analysis.aiStatus === 'verified' ? 'verified'
               : analysis.aiStatus === 'wrong_year' ? 'wrong-year'
               : analysis.aiStatus === 'duplicate'  ? 'duplicate'
               : 'unexpected',
        title:     analysis.aiStatus === 'verified' ? 'Document Verified' : 'Issue Detected',
        detail:    analysis.aiMessage || '',
        aiStatus:  aiDbStatus as any,
        confidence: analysis.confidence,
      };
      setRequirements(prev => prev.map(r =>
        r.id === req.id
          ? { ...r, upload, uploadState: 'done', validationResult: validationResult as any }
          : r
      ));
    } catch {
      setRequirements(prev => prev.map(r =>
        r.id === req.id ? { ...r, uploadState: 'idle' } : r
      ));
      toast.error('Upload failed. Please try again.');
    }
  }, [client, requirements, refreshAnalysis]);

  const verifiedCount = requirements.filter(r => r.upload?.ai_status === 'verified').length;
  const totalRequired = requirements.filter(r => r.required).length;
  const allVerified   = totalRequired > 0 && verifiedCount === totalRequired;
  const alreadySubmitted = submitted || (client?.status === 'complete' && allVerified);
  const missingNotVerified = requirements.filter(
    r => r.required && (!r.upload || r.upload.ai_status !== 'verified'),
  );

  const handleSubmitForReview = async () => {
    if (!token || !client || !allVerified || submitting || alreadySubmitted) return;
    setSubmitting(true);
    try {
      const result = await submitDocumentsViaMagicLink(token);
      if (result.error || !result.ok) {
        throw new Error(result.error ?? 'Submission failed');
      }

      await notifyPreparerOfSubmission(client.id, {
        clientName: client.name,
        clientEmail: client.email,
        documentNames: requirements
          .filter(r => r.upload?.ai_status === 'verified')
          .map(r => r.name),
      }).catch(() => {
        toast.warning('Submitted, but preparer notification could not be queued.', {
          description: 'Your documents were still marked as submitted.',
        });
      });

      setSubmitted(true);
      setClient({ ...client, status: 'complete' });
      toast.success('Documents submitted for review', {
        description: 'Your preparer has been notified. Thank you!',
      });
    } catch (err: any) {
      toast.error('Submission failed', { description: err?.message ?? 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (tokenExpired || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-800">Link Expired or Invalid</h2>
            <p className="text-sm text-gray-500">
              This upload link is no longer valid. Please contact your tax preparer to receive a new link.
            </p>
            <p className="text-sm font-medium text-blue-700">sj@brodermansoor.com</p>
            <p className="text-xs text-gray-400 mt-4">Broder Mansoor Muqtadir, Inc. · Powered by SJ Innovation AI</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const verifiedDisplay = verifiedCount;
  const total = totalRequired;
  const pct = total > 0 ? Math.round((verifiedDisplay / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0f1f3d] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Broder Mansoor Muqtadir, Inc.</h1>
            <p className="text-xs text-blue-200/70">Secure Document Upload Portal</p>
          </div>
          <p className="text-xs text-blue-200/60">Powered by SJ Innovation AI</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Hi {client.name.split(' ')[0]},</h2>
          <p className="text-sm text-gray-500 mt-1">
            Please upload your {CURRENT_TAX_YEAR} tax documents below. Each document is instantly verified by AI and compared against your {PRIOR_TAX_YEAR} filings.
          </p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Documents received</span>
              <span className="text-sm text-gray-500">{verifiedDisplay} of {total} verified</span>
            </div>
            <Progress value={pct} className="h-2" />
            {allVerified && !alreadySubmitted && (
              <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> All documents verified — ready to submit
              </p>
            )}
            {alreadySubmitted && (
              <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Submitted for preparer review — thank you!
              </p>
            )}
          </CardContent>
        </Card>

        <AnalysisSummary result={analysisResult} loading={analysisLoading} />

        {/* Document list */}
        <div className="space-y-3">
          {requirements.map(req => (
            <DocumentRow
              key={req.id}
              req={req}
              onFileChange={handleFileChange}
            />
          ))}
        </div>

        {/* Still missing / not verified */}
        {missingNotVerified.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Still needed or has issues:</p>
              <ul className="space-y-1">
                {missingNotVerified.map(r => (
                  <li key={r.id} className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {r.name}
                    {r.upload && r.upload.ai_status !== 'verified' && (
                      <span className="text-xs">(needs replacement)</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            {alreadySubmitted ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
                <h3 className="text-lg font-medium">Submitted for Review</h3>
                <p className="text-sm text-muted-foreground">
                  Your preparer will review your documents and contact you if anything else is needed.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium">Ready to Submit?</h3>
                <p className="text-sm text-muted-foreground">
                  Submit when every document shows <strong>Verified</strong>. Replace any flagged files first.
                </p>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!allVerified || submitting}
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
          </CardContent>
        </Card>

        <p className="text-xs text-center text-gray-400">
          Questions? Contact your preparer at {client.assigned_preparer ?? 'sj@brodermansoor.com'}
        </p>
      </div>
    </div>
  );
};

interface DocumentRowProps {
  req: ReqWithUpload;
  onFileChange: (req: ReqWithUpload, file: File) => void;
}

const DocumentRow: React.FC<DocumentRowProps> = ({ req, onFileChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const state = req.uploadState;
  const upload = req.upload;
  const result = req.validationResult;

  const isAnalyzing = state === 'uploading' || state === 'analyzing';

  const statusLabel =
    state === 'uploading' ? 'Uploading…' :
    state === 'analyzing' ? 'AI analyzing…' :
    upload?.ai_status === 'verified' ? 'Verified' :
    upload?.ai_status === 'flagged'  ? 'Issue detected' :
    upload?.ai_status === 'rejected' ? 'Rejected' :
    'Not uploaded';

  const statusColor =
    upload?.ai_status === 'verified' ? 'bg-green-100 text-green-700' :
    upload?.ai_status === 'flagged'  ? 'bg-red-100 text-red-700' :
    upload?.ai_status === 'rejected' ? 'bg-red-100 text-red-700' :
    isAnalyzing ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-500';

  return (
    <Card className={upload?.ai_status === 'flagged' ? 'border-red-200' : ''}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {isAnalyzing ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            ) : upload?.ai_status === 'verified' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : upload?.ai_status === 'flagged' ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <Clock className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-800">{req.name}</span>
              <Badge variant="outline" className="text-xs">{req.tax_year}</Badge>
              <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
            </div>

            {upload && !isAnalyzing && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {upload.file_name}
              </p>
            )}

            {result && state === 'done' && (
              <div className={`mt-2 p-2 rounded text-xs ${
                result.aiStatus === 'verified' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <p className="font-medium">{result.title}</p>
                <p className="mt-0.5">{result.detail}</p>
              </div>
            )}
          </div>

          {!isAnalyzing && (
            <div className="shrink-0">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onFileChange(req, f);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                variant={upload ? 'outline' : 'default'}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                {upload ? 'Replace' : 'Upload'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MagicLinkPortal;
