import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, AlertCircle, Clock, Upload, FileText, Loader2, XCircle, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveMagicLink, submitDocumentsViaMagicLink } from '@/lib/magicLinkDb';
import { persistClientDocumentPackage } from '@/lib/clientDocumentSubmit';
import { clearTaxYearReuploadGrant } from '@/lib/clientPortalSettings';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';
import { APP_NAME, FOOTER_TAGLINE, FIRM_NAME, SUPPORT_EMAIL } from '@/lib/branding';
import type { Database } from '@/lib/database.types';

type DocReq = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

interface ReqWithUpload extends DocReq {
  upload?: DocUpload;
}

const MagicLinkPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<any>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<ReqWithUpload[]>([]);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reloadPortal = useCallback(async () => {
    if (!token) return;
    const result = await resolveMagicLink(token);
    if (result === null || result === 'expired') return;
    setClient(result.client);
    setSubmitted(result.client.status === 'complete');
    const uploadsByReq = new Map(result.uploads.map(u => [u.requirement_id, u]));
    setRequirements(result.requirements.map(req => ({
      ...req,
      upload: uploadsByReq.get(req.id),
    })));
  }, [token]);

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

  const handleFileChange = (req: ReqWithUpload, file: File) => {
    setPendingFiles(prev => ({ ...prev, [req.id]: file }));
  };

  const handleFileClear = (requirementId: string) => {
    setPendingFiles(prev => {
      const next = { ...prev };
      delete next[requirementId];
      return next;
    });
  };

  const requiredDocs = requirements.filter(r => r.required);
  const totalRequired = requiredDocs.length;
  const dbUploadedCount = requiredDocs.filter(r => r.upload).length;
  const selectedCount = requiredDocs.filter(r => pendingFiles[r.id]).length;
  const alreadySubmitted =
    submitted && dbUploadedCount === totalRequired && totalRequired > 0;
  const filledCount = alreadySubmitted ? dbUploadedCount : selectedCount;
  const allSlotsFilled = totalRequired > 0 && (alreadySubmitted ? dbUploadedCount === totalRequired : selectedCount === totalRequired);
  const pct = totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;
  const missingNotSelected = alreadySubmitted
    ? []
    : requiredDocs.filter(r => !pendingFiles[r.id]);

  const handleSubmitForReview = async () => {
    if (!token || !client || !allSlotsFilled || submitting || alreadySubmitted) return;
    setSubmitting(true);
    try {
      const slots = requiredDocs
        .filter(r => pendingFiles[r.id])
        .map(r => ({
          requirementId: r.id,
          docType: r.doc_type,
          documentName: r.name,
          file: pendingFiles[r.id],
          existingUploadId: r.upload?.id,
        }));

      await persistClientDocumentPackage({
        clientId: client.id,
        taxYear: CURRENT_TAX_YEAR,
        slots,
        actorName: client.name,
        magicLinkToken: token,
      });

      const result = await submitDocumentsViaMagicLink(token);
      if (result.error || !result.ok) {
        throw new Error(result.error ?? 'Submission failed');
      }

      await clearTaxYearReuploadGrant(client.id, CURRENT_TAX_YEAR).catch(() => {});

      setPendingFiles({});
      setSubmitted(true);
      setClient({ ...client, status: 'complete' });
      await reloadPortal();
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
            <p className="text-sm font-medium text-blue-700">{SUPPORT_EMAIL}</p>
            <p className="text-xs text-gray-400 mt-4">{FIRM_NAME} · {FOOTER_TAGLINE}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0f1f3d] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{FIRM_NAME}</h1>
            <p className="text-xs text-blue-200/70">Secure Document Upload Portal</p>
          </div>
          <p className="text-xs text-blue-200/60">{FOOTER_TAGLINE}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Hi {client.name.split(' ')[0]},</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select a file for each required {CURRENT_TAX_YEAR} document below, then submit when all slots are filled.
            Files are uploaded when you click Submit for Review.
          </p>
        </div>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Document progress</span>
              <span className="text-sm text-gray-500">
                {filledCount} of {totalRequired} {alreadySubmitted ? 'submitted' : 'selected'}
              </span>
            </div>
            <Progress value={pct} className="h-2" />
            {allSlotsFilled && !alreadySubmitted && (
              <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> All slots filled — ready to submit
              </p>
            )}
            {alreadySubmitted && (
              <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Submitted for preparer review — thank you!
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {requiredDocs.map(req => (
            <DocumentRow
              key={req.id}
              req={req}
              pendingFile={pendingFiles[req.id] ?? null}
              alreadySubmitted={alreadySubmitted}
              onFileChange={handleFileChange}
              onFileClear={handleFileClear}
            />
          ))}
        </div>

        {missingNotSelected.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Still need a file for:</p>
              <ul className="space-y-1">
                {missingNotSelected.map(r => (
                  <li key={r.id} className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {r.name}
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
                  Select a file for every required slot, then submit to send your documents to your preparer.
                </p>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!allSlotsFilled || submitting}
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
          Questions? Contact your preparer at {client.assigned_preparer ?? SUPPORT_EMAIL}
        </p>
      </div>
    </div>
  );
};

interface DocumentRowProps {
  req: ReqWithUpload;
  pendingFile: File | null;
  alreadySubmitted: boolean;
  onFileChange: (req: ReqWithUpload, file: File) => void;
  onFileClear: (requirementId: string) => void;
}

const DocumentRow: React.FC<DocumentRowProps> = ({
  req,
  pendingFile,
  alreadySubmitted,
  onFileChange,
  onFileClear,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const upload = req.upload;

  const slotStatus = alreadySubmitted && upload
    ? 'Submitted'
    : pendingFile
      ? 'Selected'
      : 'Pending';

  const statusColor =
    slotStatus === 'Submitted' ? 'bg-green-100 text-green-700' :
    slotStatus === 'Selected' ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-500';

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {slotStatus === 'Submitted' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : slotStatus === 'Selected' ? (
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            ) : (
              <Clock className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-800">{req.name}</span>
              <Badge variant="outline" className="text-xs">{req.tax_year}</Badge>
              <Badge className={`text-xs ${statusColor}`}>{slotStatus}</Badge>
            </div>

            {alreadySubmitted && upload && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {upload.file_name}
              </p>
            )}
            {!alreadySubmitted && pendingFile && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {pendingFile.name} · ready to submit
              </p>
            )}
          </div>

          {!alreadySubmitted && (
            <div className="shrink-0 flex items-center gap-1">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onFileChange(req, f);
                  e.target.value = '';
                }}
              />
              {pendingFile && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onFileClear(req.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant={pendingFile ? 'outline' : 'default'}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1" />
                {pendingFile ? 'Replace' : 'Select'}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MagicLinkPortal;
