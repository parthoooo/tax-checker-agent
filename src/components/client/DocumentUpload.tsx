import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, X } from 'lucide-react';

interface DocumentUploadProps {
  documentId: string;
  documentName: string;
  selectedFile?: File | null;
  onFileSelected: (documentId: string, file: File) => void;
  onFileClear: (documentId: string) => void;
  uploadDisabled?: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentId,
  documentName,
  selectedFile = null,
  onFileSelected,
  onFileClear,
  uploadDisabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (uploadDisabled) return;
    onFileSelected(documentId, file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!uploadDisabled) setIsDragOver(true);
  }, [uploadDisabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (uploadDisabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFile(files[0]);
  }, [uploadDisabled, documentId, onFileSelected]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFile(files[0]);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {uploadDisabled && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Uploads for this tax year are locked. Contact your preparer if you need to make changes.
        </p>
      )}

      {!selectedFile && !uploadDisabled && (
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(`file-${documentId}`)?.click()}
          >
            Browse Files
          </Button>
          <p className="text-xs text-gray-500 mt-2">Supported: PDF, JPG, PNG, DOC, DOCX</p>
        </div>
      )}

      {selectedFile && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · ready to submit
                </p>
              </div>
            </div>
            {!uploadDisabled && (
              <Button variant="ghost" size="sm" onClick={() => onFileClear(documentId)}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
