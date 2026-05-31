import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X, Loader2, AlertTriangle, CheckCircle2, Copy, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFileToStorage, createDocumentUpload, createAiFlag, logActivity } from '@/lib/db';
import { simulateValidation } from '@/lib/aiSimulation';
import { useAuth } from '@/contexts/AuthContext';

interface DocumentUploadProps {
  documentId: string;
  documentName: string;
  hint?: string;
  clientId: string;
  onUpload: (documentId: string, file: File) => void;
}

import type { ValidationResult } from '@/lib/aiSimulation';

const sessionUploaded = new Set<string>();

const DocumentUpload: React.FC<DocumentUploadProps> = ({ documentId, documentName, hint, clientId, onUpload }) => {
  const { user, session } = useAuth();
  const [isDragOver, setIsDragOver]   = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis]       = useState<ValidationResult | null>(null);

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setAnalysis(null);
    setIsAnalyzing(true);

    const result = await simulateValidation(file, [...sessionUploaded]);
    setAnalysis(result);
    setIsAnalyzing(false);

    if (result.outcome === 'verified') {
      sessionUploaded.add(file.name.toLowerCase());
      try {
        const storagePath = await uploadFileToStorage(clientId, file);

        await createDocumentUpload({
          client_id:      clientId,
          requirement_id: documentId.startsWith('req-') ? documentId.replace('req-', '') : null,
          file_name:      file.name,
          storage_path:   storagePath,
          file_size:      file.size,
          mime_type:      file.type || null,
          ai_status:      'verified',
          uploaded_by:    session?.user?.id ?? null,
        });

        await logActivity({
          client_id:  clientId,
          actor:      user?.name ?? 'Client',
          actor_type: 'client',
          action:     `Uploaded ${file.name}`,
        });

        onUpload(documentId, file);
        toast.success('Document uploaded', { description: `${documentName} verified and filed.` });
      } catch (err: any) {
        toast.error('Upload failed', { description: err?.message ?? 'Please try again.' });
        setAnalysis(null);
        setSelectedFile(null);
      }
    } else {
      const flagTypeMap: Record<string, 'wrong-year' | 'duplicate' | 'unexpected'> = {
        'wrong-year':        'wrong-year',
        'duplicate':         'duplicate',
        'unexpected':        'unexpected',
        'too-small':         'unexpected',
        'page_count_warning':'unexpected',
      };
      const ft = flagTypeMap[result.outcome];
      if (ft && clientId) {
        createAiFlag({
          client_id:   clientId,
          upload_id:   null,
          flag_type:   ft,
          severity:    ft === 'wrong-year' ? 'HIGH' : 'MEDIUM',
          description: result.detail,
          detected_by: 'Doc Classifier Agent',
          resolved:    false,
          resolved_at: null,
        }).catch(() => {});
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
  }, [clientId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFile(files[0]);
  };

  const reset = () => { setSelectedFile(null); setAnalysis(null); setIsAnalyzing(false); };

  return (
    <div className="space-y-3">
      {!selectedFile && (
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
              Drag and drop your {documentName} here, or click to browse
            </p>
            <input
              type="file"
              id={`file-${documentId}`}
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
            <Button variant="outline" size="sm" onClick={() => document.getElementById(`file-${documentId}`)?.click()}>
              Browse Files
            </Button>
            <p className="text-xs text-gray-500 mt-2">Supported: PDF, JPG, PNG, DOC, DOCX</p>
          </div>
          {hint && <p className="text-xs italic text-gray-500 px-1">{hint}</p>}
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
              <span className="text-sm text-blue-800 font-medium">🤖 AI analyzing document…</span>
            </div>
          )}

          {analysis?.outcome === 'wrong-year' && (
            <div className="p-3 rounded-md bg-red-50 border border-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900 text-sm">⚠️ {analysis.title}</p>
                  <p className="text-sm text-red-800 mt-1">{analysis.detail}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-red-300" onClick={reset}>Re-upload</Button>
                </div>
              </div>
            </div>
          )}

          {analysis?.outcome === 'duplicate' && (
            <div className="p-3 rounded-md bg-orange-50 border border-orange-300">
              <div className="flex items-start gap-2">
                <Copy className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-900 text-sm">🔁 {analysis.title}</p>
                  <p className="text-sm text-orange-800 mt-1">{analysis.detail}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-orange-300" onClick={reset}>Dismiss</Button>
                </div>
              </div>
            </div>
          )}

          {(analysis?.outcome === 'unexpected' || analysis?.outcome === 'too-small') && (
            <div className="p-3 rounded-md bg-yellow-50 border border-yellow-300">
              <div className="flex items-start gap-2">
                <FileWarning className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900 text-sm">📂 {analysis.title}</p>
                  <p className="text-sm text-yellow-800 mt-1">{analysis.detail}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-yellow-400" onClick={reset}>Remove</Button>
                </div>
              </div>
            </div>
          )}

          {analysis?.outcome === 'page_count_warning' && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900 text-sm">📄 {analysis.title}</p>
                  <p className="text-sm text-amber-800 mt-1">{analysis.detail}</p>
                  <Button size="sm" variant="outline" className="mt-2 border-amber-400" onClick={reset}>Re-upload</Button>
                </div>
              </div>
            </div>
          )}

          {analysis?.outcome === 'verified' && (
            <div className="p-3 rounded-md bg-green-50 border border-green-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900 text-sm">✅ {analysis.title}</p>
                  <p className="text-sm text-green-800 mt-1">{analysis.detail}</p>
                  <p className="text-xs text-green-600 mt-0.5">Confidence: {analysis.confidence}%</p>
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
