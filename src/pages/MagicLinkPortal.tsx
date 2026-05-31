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
import {
  fetchClientByToken,
  fetchDocumentRequirements,
  fetchDocumentUploads,
  createDocumentUpload,
  createAiFlag,
  createEmailDraft,
  logActivity,
} from '@/lib/db';
import { simulateValidation, buildFlagDescription, buildEmailDraftBody } from '@/lib/aiSimulation';
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

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchClientByToken(token).then(c => {
      if (!c) { setTokenExpired(true); setLoading(false); return; }
      if (new Date(c.token_expires_at) < new Date()) { setTokenExpired(true); setLoading(false); return; }
      setClient(c);
      return Promise.all([
        fetchDocumentRequirements(c.id),
        fetchDocumentUploads(c.id),
      ]).then(([reqs, uploads]) => {
        const merged: ReqWithUpload[] = reqs.map(req => {
          const up = uploads.find(u => u.requirement_id === req.id);
          return { ...req, upload: up };
        });
        setRequirements(merged);
      });
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

    const result = await simulateValidation(file, existingNames, req.doc_type);

    // Create a fake storage path for demo (no real Supabase storage in demo)
    const storagePath = `clients/${client.id}/${Date.now()}_${file.name}`;

    try {
      const upload = await createDocumentUpload({
        client_id: client.id,
        requirement_id: req.id,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        ai_status: result.aiStatus,
        uploaded_by: null,
      });

      if (result.aiStatus === 'flagged' || result.aiStatus === 'rejected') {
        await createAiFlag({
          client_id: client.id,
          upload_id: upload.id,
          flag_type: result.outcome === 'wrong-year' ? 'wrong-year' :
                     result.outcome === 'duplicate'  ? 'duplicate'  :
                     result.outcome === 'too-small'  ? 'unexpected' : 'unexpected',
          severity: result.outcome === 'wrong-year' ? 'HIGH' : 'MEDIUM',
          description: buildFlagDescription(result, file.name),
          detected_by: 'Doc Classifier Agent',
        });

        const emailContent = buildEmailDraftBody(
          client.name,
          result,
          file.name,
          client.assigned_preparer ?? 'sj@brodermansoor.com'
        );
        await createEmailDraft({
          client_id: client.id,
          to_email: client.email,
          from_label: client.assigned_preparer ?? 'sj@brodermansoor.com',
          subject: emailContent.subject,
          body: emailContent.body,
          status: 'pending',
        });
      }

      await logActivity({
        client_id: client.id,
        actor: client.name,
        actor_type: 'client',
        action: `Uploaded ${file.name} via magic link portal`,
      });

      setRequirements(prev => prev.map(r =>
        r.id === req.id
          ? { ...r, upload, uploadState: 'done', validationResult: result }
          : r
      ));
    } catch {
      setRequirements(prev => prev.map(r =>
        r.id === req.id ? { ...r, uploadState: 'idle' } : r
      ));
      toast.error('Upload failed. Please try again.');
    }
  }, [client, requirements]);

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
            <p className="text-xs text-gray-400 mt-4">Broder-Mansoor & Associates · Powered by SJ Innovation AI</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submitted = requirements.filter(r => r.upload?.ai_status === 'verified').length;
  const total = requirements.length;
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const missing = requirements.filter(r => !r.upload);
  const allDone = missing.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0f1f3d] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Broder-Mansoor & Associates</h1>
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
            Please upload your 2024 tax documents below. Each document is instantly verified by AI — you'll see the result immediately.
          </p>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Documents received</span>
              <span className="text-sm text-gray-500">{submitted} of {total}</span>
            </div>
            <Progress value={pct} className="h-2" />
            {allDone && (
              <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> All documents received — thank you!
              </p>
            )}
          </CardContent>
        </Card>

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

        {/* Still missing */}
        {!allDone && missing.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-amber-800 mb-2">Still needed:</p>
              <ul className="space-y-1">
                {missing.map(r => (
                  <li key={r.id} className="text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {r.name}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

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
