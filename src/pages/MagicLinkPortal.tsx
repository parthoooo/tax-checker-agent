import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  getMagicLinkSignedUrl,
  loadMagicLinkPortalSnapshot,
  submitMagicLinkForReview,
  type MagicLinkActiveCorrection,
} from '@/lib/magicLinkDb';
import { persistClientDocumentPackage } from '@/lib/clientDocumentSubmit';
import { computeClientPortalDocumentState, isValidPortalTaxYearForClient } from '@/lib/clientPortalDocumentState';
import ClientActionRequired from '@/components/client/ClientActionRequired';
import ClientPortalDocumentSection from '@/components/client/ClientPortalDocumentSection';
import {
  APP_NAME,
  FOOTER_TAGLINE,
  FIRM_NAME,
  SUPPORT_EMAIL,
} from '@/lib/branding';
import {
  BUSINESS_TYPE_LABELS,
  CURRENT_TAX_YEAR,
  getClientPortalTaxYears,
  type BusinessType,
} from '@/lib/taxConfig';
import type { Database } from '@/lib/database.types';
import type { PortalDocRow } from '@/lib/clientPortalDocumentState';

type Client = Database['public']['Tables']['clients']['Row'];

const REFRESH_INTERVAL_MS = 15_000;

const MagicLinkPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<PortalDocRow[]>([]);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File>>({});
  const [replaceIntentIds, setReplaceIntentIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [selectedTaxYear, setSelectedTaxYear] = useState<string>(CURRENT_TAX_YEAR);
  const [yearLocked, setYearLocked] = useState(false);
  const [yearLockReason, setYearLockReason] = useState<string | undefined>();
  const [yearSubmitted, setYearSubmitted] = useState(false);
  const [activeCorrection, setActiveCorrection] = useState<MagicLinkActiveCorrection | null>(null);
  const loadRequestRef = useRef(0);
  const selectedTaxYearRef = useRef(selectedTaxYear);

  useEffect(() => {
    selectedTaxYearRef.current = selectedTaxYear;
  }, [selectedTaxYear]);

  const loadPortal = useCallback(async (taxYear: string) => {
    if (!token) return;

    const requestId = ++loadRequestRef.current;
    const isStale = () =>
      requestId !== loadRequestRef.current
      || taxYear !== selectedTaxYearRef.current;

    try {
      const snapshot = await loadMagicLinkPortalSnapshot(token, taxYear);
      if (isStale()) return;

      if (snapshot === null) {
        setTokenExpired(true);
        return;
      }
      if (snapshot === 'expired') {
        setTokenExpired(true);
        return;
      }

      setClient(snapshot.client);
      setDocs(snapshot.docs);
      setYearSubmitted(snapshot.yearSubmitted);
      setYearLocked(snapshot.yearLocked);
      setYearLockReason(snapshot.yearLockReason);
      setActiveCorrection(snapshot.activeCorrection);
    } catch (err: unknown) {
      if (!isStale()) {
        const message = err instanceof Error ? err.message : 'Please try again.';
        toast.error('Could not load portal', { description: message });
      }
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setDocs([]);
    setPendingFiles({});
    setReplaceIntentIds(new Set());
    loadPortal(selectedTaxYear);
  }, [token, selectedTaxYear, loadPortal]);

  useEffect(() => {
    if (!token) return;

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadPortal(selectedTaxYearRef.current);
      }
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [token, loadPortal]);

  const handleFileSelected = (documentId: string, file: File) => {
    setPendingFiles(prev => ({ ...prev, [documentId]: file }));
    setReplaceIntentIds(prev => new Set(prev).add(documentId));
  };

  const handleFileClear = (documentId: string) => {
    setPendingFiles(prev => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
    setReplaceIntentIds(prev => {
      const next = new Set(prev);
      next.delete(documentId);
      return next;
    });
  };

  const handleStartReplace = (documentId: string) => {
    setReplaceIntentIds(prev => new Set(prev).add(documentId));
  };

  const requiredDocs = docs.filter(d => d.required);
  const portalState = useMemo(
    () => computeClientPortalDocumentState({
      requiredDocs,
      clientRecord: client,
      selectedTaxYear,
      yearLocked,
      yearSubmitted,
      activeCorrectionComparison: activeCorrection?.comparison,
      pendingFiles,
      replaceIntentIds,
    }),
    [
      requiredDocs,
      client,
      selectedTaxYear,
      yearLocked,
      yearSubmitted,
      activeCorrection?.comparison,
      pendingFiles,
      replaceIntentIds,
    ],
  );

  const {
    totalCount,
    isCorrectionResubmitMode,
    yearUnlockedForResubmit,
    canSubmit,
  } = portalState;

  const availableYears = client
    ? getClientPortalTaxYears(client).filter(y => isValidPortalTaxYearForClient(client, y))
    : [CURRENT_TAX_YEAR];

  const getSignedUrl = useCallback(
    (storagePath: string) => (token ? getMagicLinkSignedUrl(token, storagePath) : Promise.resolve(null)),
    [token],
  );

  const handleSubmitForReview = async () => {
    if (!token || !client || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const slots = requiredDocs
        .filter(d => pendingFiles[d.id])
        .map(d => ({
          requirementId: d.id,
          docType: d.doc_type,
          documentName: d.name,
          file: pendingFiles[d.id],
          existingUploadId: d.upload?.id,
        }));

      const uploadedCountAfter = isCorrectionResubmitMode || yearUnlockedForResubmit
        ? requiredDocs.filter(d => (pendingFiles[d.id] ? true : Boolean(d.upload))).length
        : slots.length;

      const { uploadedCount: persistedCount, documentNames } = await persistClientDocumentPackage({
        clientId: client.id,
        taxYear: selectedTaxYear,
        slots,
        actorName: client.name,
        magicLinkToken: token,
        existingFilenames: requiredDocs
          .map(d => d.upload?.file_name)
          .filter((n): n is string => Boolean(n)),
      });

      await submitMagicLinkForReview(token, {
        taxYear: selectedTaxYear,
        uploadedCount: (isCorrectionResubmitMode || yearUnlockedForResubmit) ? uploadedCountAfter : persistedCount,
        requiredCount: totalCount,
        actorName: client.name,
        clientName: client.name,
        clientEmail: client.email,
        documentNames,
      });

      setPendingFiles({});
      setReplaceIntentIds(new Set());
      setActiveCorrection(null);
      await loadPortal(selectedTaxYear);

      toast.success(
        (isCorrectionResubmitMode || yearUnlockedForResubmit) ? 'Corrections submitted for review' : 'Documents submitted for review',
        {
          description: (isCorrectionResubmitMode || yearUnlockedForResubmit)
            ? `Your updated ${selectedTaxYear} file(s) were sent to your preparer.`
            : `Your ${selectedTaxYear} package was sent to your preparer.`,
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast.error('Submission failed', { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaxYearChange = (year: string) => {
    if (year === selectedTaxYear) return;
    loadRequestRef.current += 1;
    setSelectedTaxYear(year);
  };

  if (loading && !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (tokenExpired || !client || !token) {
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

  const businessType = (client.business_type ?? 'freelancer') as BusinessType;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#0f1f3d] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">{FIRM_NAME}</h1>
            <p className="text-xs text-blue-200/70">{APP_NAME} · Secure Document Upload</p>
          </div>
          <p className="text-xs text-blue-200/60 hidden sm:block">{FOOTER_TAGLINE}</p>
        </div>
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Hi {client.name.split(' ')[0]},</h2>
          <p className="text-sm text-gray-500 mt-1">
            This portal stays in sync with your client account — any changes from your preparer appear here automatically.
          </p>
        </div>

        {activeCorrection && (
          <ClientActionRequired
            comparison={activeCorrection.comparison}
            staffMessage={activeCorrection.staff_message}
            sentAt={activeCorrection.sent_at}
            sentBy={activeCorrection.sent_by}
          />
        )}

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 min-w-[200px]">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Profession</p>
                <Badge variant="secondary" className="text-sm py-1 px-3 h-10 flex items-center">
                  {BUSINESS_TYPE_LABELS[businessType]}
                </Badge>
              </div>
              <div className="space-y-2 min-w-[160px]">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tax year</p>
                <Select value={selectedTaxYear} onValueChange={handleTaxYearChange}>
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
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="w-3 h-3" /> Profession is managed in your full client portal
            </p>
          </CardContent>
        </Card>

        <ClientPortalDocumentSection
          selectedTaxYear={selectedTaxYear}
          loading={loading}
          requiredDocs={requiredDocs}
          portalState={portalState}
          yearLocked={yearLocked}
          yearLockReason={yearLockReason}
          clientRecord={client}
          pendingFiles={pendingFiles}
          replaceIntentIds={replaceIntentIds}
          submitting={submitting}
          onFileSelected={handleFileSelected}
          onFileClear={handleFileClear}
          onStartReplace={handleStartReplace}
          onSubmit={handleSubmitForReview}
          showSelfReminder={false}
          getSignedUrl={getSignedUrl}
        />

        <p className="text-xs text-center text-gray-400 pb-4">
          Questions? Contact your preparer at {client.assigned_preparer ?? SUPPORT_EMAIL}
        </p>
      </main>
    </div>
  );
};

export default MagicLinkPortal;
