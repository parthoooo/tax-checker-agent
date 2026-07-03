import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Eye, FileText, Loader2, RefreshCw } from 'lucide-react';
import { getDocumentSignedUrl } from '@/lib/db';
import { toast } from 'sonner';

interface Props {
  fileName: string;
  uploadedAt: string;
  aiStatus?: string | null;
  storagePath: string;
  onReplace?: () => void;
  allowReplace?: boolean;
  getSignedUrl?: (storagePath: string) => Promise<string | null>;
}

function statusBadge(aiStatus?: string | null) {
  switch (aiStatus) {
    case 'verified':
      return { label: 'Verified', className: 'bg-green-600 hover:bg-green-600' };
    case 'flagged':
      return { label: 'Needs correction', variant: 'destructive' as const };
    case 'rejected':
      return { label: 'Rejected', variant: 'destructive' as const };
    case 'pending':
      return { label: 'Pending review', variant: 'secondary' as const };
    default:
      return { label: 'Submitted', variant: 'secondary' as const };
  }
}

const UploadedDocumentCard: React.FC<Props> = ({
  fileName,
  uploadedAt,
  aiStatus,
  storagePath,
  onReplace,
  allowReplace = true,
  getSignedUrl,
}) => {
  const [loadingAction, setLoadingAction] = useState<'preview' | 'download' | null>(null);
  const badge = statusBadge(aiStatus);
  const resolveSignedUrl = getSignedUrl ?? getDocumentSignedUrl;

  const openSignedUrl = async (mode: 'preview' | 'download') => {
    setLoadingAction(mode);
    try {
      const url = await resolveSignedUrl(storagePath);
      if (!url) {
        toast.error('File unavailable', {
          description: 'Could not load this document. If this keeps happening, ask your preparer to refresh your upload link.',
        });
        return;
      }
      if (mode === 'preview') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('Could not open file', { description: 'Please try again or contact your preparer.' });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{fileName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uploaded {new Date(uploadedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {'variant' in badge ? (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        ) : (
          <Badge className={badge.className}>{badge.label}</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingAction !== null}
          onClick={() => openSignedUrl('preview')}
        >
          {loadingAction === 'preview' ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Eye className="w-4 h-4 mr-1" />
          )}
          Preview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingAction !== null}
          onClick={() => openSignedUrl('download')}
        >
          {loadingAction === 'download' ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-1" />
          )}
          Download
        </Button>
        {allowReplace && onReplace && (
          <Button type="button" size="sm" variant="ghost" onClick={onReplace}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Replace file
          </Button>
        )}
      </div>
    </div>
  );
};

export default UploadedDocumentCard;
