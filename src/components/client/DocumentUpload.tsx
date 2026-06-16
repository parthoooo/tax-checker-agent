import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, Loader2, AlertTriangle, CheckCircle2, Copy, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import {
  createDocumentUpload,
  replaceDocumentUpload,
  createAiFlag,
  createEmailDraft,
  logActivity,
} from '@/lib/db';
import { uploadDocumentToStorage } from '@/utils/uploadDocument';
import { analyzeDocument } from '@/utils/analyzeDocument';
import { buildEmailDraftBody } from '@/lib/aiSimulation';
import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';
import { useAuth } from '@/contexts/AuthContext';

interface DocumentUploadProps {
  documentId: string;
  documentName: string;
  docType: string;
  clientId: string;
  clientEmail?: string;
  clientName?: string;
  existingFilenames: string[];
  onUpload: (documentId: string, file: File) => void;
  onAnalysisComplete?: () => void;
  replaceMode?: boolean;
  existingUploadId?: string;
  taxYear?: string;
  uploadDisabled?: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentId,
  documentName,
  docType,
  clientId,
  clientEmail,
  clientName,
  existingFilenames,
  onUpload,
  onAnalysisComplete,
  replaceMode = false,
  existingUploadId,
  taxYear = CURRENT_TAX_YEAR,
  uploadDisabled = false,
}) => {
  const taxYearNum = parseInt(taxYear, 10);
  const { user, session } = useAuth();
  const [isDragOver, setIsDragOver]     = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [outcome, setOutcome]           = useState<string | null>(null);
  const [message, setMessage]           = useState('');

  const handleFile = async (file: File) => {
    if (uploadDisabled) {
      toast.error('Uploads locked', { description: 'This tax year is locked. Contact your preparer to unlock.' });
      return;
    }
    setSelectedFile(file);
    setOutcome(null);
    setIsAnalyzing(true);

    const analysis = await analyzeDocument({
      fileName: file.name,
      mimeType: file.type,
      requirementDocType: docType,
      clientId,
      existingFilenames,
    });

    setIsAnalyzing(false);
    setOutcome(analysis.aiStatus);
    setMessage(analysis.aiMessage || '');

    const aiDbStatus = analysis.aiStatus === 'verified' ? 'verified' : 'flagged';
    const storagePath = `clients/${clientId}/${taxYear}/${docType}/${file.name.replace(/\s+/g, '_')}`;

    if (analysis.aiStatus === 'verified') {
      const stored = await uploadDocumentToStorage(
        file, clientId, docType, taxYearNum, replaceMode,
      );
      if (!stored.success) {
        toast.error('Upload failed', { description: stored.error });
        setOutcome(null);
        setSelectedFile(null);
        return;
      }

      const uploadPayload = {
        client_id:      clientId,
        requirement_id: documentId,
        file_name:      file.name,
        storage_path:   stored.storagePath ?? storagePath,
        file_size:      file.size,
        mime_type:      file.type || null,
        ai_status:      'verified' as const,
        tax_year:       taxYear,
        is_prior_year:  false,
        uploaded_by:    session?.user?.id ?? null,
      };

      try {
        if (replaceMode && existingUploadId) {
          await replaceDocumentUpload(existingUploadId, uploadPayload);
        } else {
          await createDocumentUpload(uploadPayload);
        }

        await logActivity({
          client_id:  clientId,
          actor:      user?.name ?? 'Client',
          actor_type: 'client',
          action:     `Uploaded ${file.name}`,
        });

        onUpload(documentId, file);
        onAnalysisComplete?.();
        toast.success('Document uploaded', { description: `${documentName} verified and filed.` });
      } catch (err: any) {
        toast.error('Upload failed', { description: err?.message ?? 'Please try again.' });
        setOutcome(null);
        setSelectedFile(null);
      }
    } else {
      try {
        const stored = await uploadDocumentToStorage(
          file, clientId, docType, taxYearNum, replaceMode,
        );
        if (!stored.success && replaceMode) {
          toast.error('Upload failed', { description: stored.error });
          setOutcome(null);
          setSelectedFile(null);
          return;
        }

        const uploadPayload = {
          client_id:      clientId,
          requirement_id: documentId,
          file_name:      file.name,
          storage_path:   stored.storagePath ?? storagePath,
          file_size:      file.size,
          mime_type:      file.type || null,
          ai_status:      aiDbStatus as 'verified' | 'flagged',
          tax_year:       CURRENT_TAX_YEAR,
          is_prior_year:  false,
          uploaded_by:    session?.user?.id ?? null,
        };

        const upload = replaceMode && existingUploadId
          ? await replaceDocumentUpload(existingUploadId, uploadPayload)
          : await createDocumentUpload(uploadPayload);

        const flagTypeMap: Record<string, 'wrong-year' | 'duplicate' | 'unexpected'> = {
          wrong_year: 'wrong-year',
          duplicate:  'duplicate',
          unexpected: 'unexpected',
        };
        const ft = flagTypeMap[analysis.aiStatus] ?? 'unexpected';
        try {
          await createAiFlag({
          client_id:   clientId,
          upload_id:   upload.id,
          flag_type:   ft,
          severity:    ft === 'wrong-year' ? 'HIGH' : 'MEDIUM',
          description: analysis.aiMessage,
          detected_by: 'Doc Classifier Agent',
        });
        } catch {
          // flag insert is best-effort
        }

        if (clientEmail && clientName) {
          try {
            const draftResult = {
              outcome: ft,
              title: 'Issue Detected',
              detail: analysis.aiMessage,
              aiStatus: 'flagged' as const,
              confidence: analysis.confidence,
            };
            const emailContent = buildEmailDraftBody(
              clientName,
              draftResult as any,
              file.name,
              'Your Tax Preparer',
            );
            await createEmailDraft({
              client_id:  clientId,
              to_email:   clientEmail,
              from_label: 'Your Tax Preparer',
              subject:    emailContent.subject,
              body:       emailContent.body,
              status:     'pending',
              type:       'outbox',
            });
          } catch {
            // draft insert is best-effort
          }
        }

        onUpload(documentId, file);
        onAnalysisComplete?.();
      } catch (err: any) {
        toast.error('Upload failed', { description: err?.message ?? 'Could not save document record.' });
        setOutcome(null);
        setSelectedFile(null);
      }
    }
  };

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFile(files[0]);
  }, [clientId, docType, existingFilenames]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFile(files[0]);
  };

  const reset = () => { setSelectedFile(null); setOutcome(null); setIsAnalyzing(false); };

  return (
    <div className="space-y-3">
      {uploadDisabled && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Uploads for this tax year are locked. Contact your preparer if you need to make changes.
        </p>
      )}
      {!selectedFile && !uploadDisabled && (
        <>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              {replaceMode
                ? `Replace your ${documentName} — upload a new file below`
                : `Drag and drop your ${documentName} here, or click to browse`}
            </p>
            <input
              type="file"
              id={`file-${documentId}`}
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <Button variant="outline" size="sm" onClick={() => document.getElementById(`file-${documentId}`)?.click()}>
              {replaceMode ? 'Replace File' : 'Browse Files'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">Supported: PDF, JPG, PNG, DOC, DOCX</p>
          </div>
        </>
      )}

      {selectedFile && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}><X className="w-4 h-4" /></Button>
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 border border-blue-200">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-800 font-medium">AI analyzing document…</span>
            </div>
          )}

          {outcome === 'wrong_year' && (
            <div className="p-3 rounded-md bg-red-50 border border-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900 text-sm">Wrong Tax Year Detected</p>
                  <p className="text-sm text-red-800 mt-1">{message}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-red-300" onClick={reset}>Re-upload</Button>
                </div>
              </div>
            </div>
          )}

          {outcome === 'duplicate' && (
            <div className="p-3 rounded-md bg-orange-50 border border-orange-300">
              <div className="flex items-start gap-2">
                <Copy className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-900 text-sm">Duplicate Detected</p>
                  <p className="text-sm text-orange-800 mt-1">{message}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-orange-300" onClick={reset}>Dismiss</Button>
                </div>
              </div>
            </div>
          )}

          {outcome === 'unexpected' && (
            <div className="p-3 rounded-md bg-yellow-50 border border-yellow-300">
              <div className="flex items-start gap-2">
                <FileWarning className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900 text-sm">Unexpected Document</p>
                  <p className="text-sm text-yellow-800 mt-1">{message}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-yellow-400" onClick={reset}>Remove</Button>
                </div>
              </div>
            </div>
          )}

          {outcome === 'verified' && (
            <div className="p-3 rounded-md bg-green-50 border border-green-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900 text-sm">Document Verified</p>
                  <p className="text-sm text-green-800 mt-1">{message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
