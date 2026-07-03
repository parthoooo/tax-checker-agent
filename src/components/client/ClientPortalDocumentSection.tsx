import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle, CheckCircle, Loader2, Lock, Mail, Upload,
} from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import UploadedDocumentCard from './UploadedDocumentCard';
import type { ClientPortalDocumentState, PortalDocRow } from '@/lib/clientPortalDocumentState';
import type { Database } from '@/lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];

export interface ClientPortalDocumentSectionProps {
  selectedTaxYear: string;
  loading: boolean;
  requiredDocs: PortalDocRow[];
  portalState: ClientPortalDocumentState;
  yearLocked: boolean;
  yearLockReason?: string;
  clientRecord: Client | null;
  pendingFiles: Record<string, File>;
  replaceIntentIds: Set<string>;
  submitting: boolean;
  onFileSelected: (documentId: string, file: File) => void;
  onFileClear: (documentId: string) => void;
  onStartReplace: (documentId: string) => void;
  onSubmit: () => void;
  onSelfReminder?: () => void;
  showSelfReminder?: boolean;
  getSignedUrl?: (storagePath: string) => Promise<string | null>;
}

const ClientPortalDocumentSection: React.FC<ClientPortalDocumentSectionProps> = ({
  selectedTaxYear,
  loading,
  requiredDocs,
  portalState,
  yearLocked,
  yearLockReason,
  clientRecord,
  pendingFiles,
  replaceIntentIds,
  submitting,
  onFileSelected,
  onFileClear,
  onStartReplace,
  onSubmit,
  onSelfReminder,
  showSelfReminder = true,
  getSignedUrl,
}) => {
  const {
    totalCount,
    yearUnlockedForResubmit,
    reuploadIds,
    isCorrectionResubmitMode,
    alreadySubmitted,
    slotNeedsCorrection,
    selectedCount,
    progressDenominator,
    progressNumerator,
    filledCount,
    progress,
    allSlotsFilled,
    canSubmitUnlocked,
    canSubmitInitial,
    missingDocs,
  } = portalState;

  return (
    <>
      {yearLocked && yearLockReason && (
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
          {yearUnlockedForResubmit && (
            <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              {isCorrectionResubmitMode
                ? `Your preparer unlocked corrections. Review your files below — re-upload only the ${reuploadIds.size} document${reuploadIds.size === 1 ? '' : 's'} flagged for correction. Verified files can stay as-is or be replaced if you choose.`
                : 'Your preparer unlocked this year for re-upload. Preview or download your files below. Replace any document if you need to upload a new version.'}
            </p>
          )}
          {isCorrectionResubmitMode && !yearUnlockedForResubmit && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Your preparer unlocked corrections. Re-upload only the {reuploadIds.size} document{reuploadIds.size === 1 ? '' : 's'} flagged below — verified files are kept as-is.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium">
                  {isCorrectionResubmitMode
                    ? `${progressNumerator} of ${progressDenominator} correction${progressDenominator === 1 ? '' : 's'} selected`
                    : yearUnlockedForResubmit && selectedCount > 0
                      ? `${selectedCount} file${selectedCount === 1 ? '' : 's'} selected to replace`
                      : `${filledCount} of ${totalCount} slots ${alreadySubmitted ? 'submitted' : 'selected'}`}
                </span>
                <Badge variant={canSubmitUnlocked || (canSubmitInitial && allSlotsFilled) ? 'default' : 'secondary'}>
                  {Math.round(progress)}% Complete
                </Badge>
              </div>
              <Progress
                key={`${selectedTaxYear}-${progressNumerator}-${progressDenominator}`}
                value={progress}
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Required Documents — Tax Year {selectedTaxYear}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {yearUnlockedForResubmit
              ? 'Review your uploaded files below. Preview or download each one, then replace only the documents you need to change.'
              : isCorrectionResubmitMode
                ? 'Upload a corrected file only for documents marked below. Other documents are already verified.'
                : 'Select a file for each required document below, then submit when all slots are filled. Files are uploaded when you click Submit for Review. Refreshing the page before submitting will clear your selections.'}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : requiredDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No documents are required for {selectedTaxYear} yet. Contact your preparer if you expected a checklist here.
            </p>
          ) : (
            <div className="grid gap-4">
              {requiredDocs.map((doc) => {
                const pendingFile = pendingFiles[doc.id];
                const hasSubmittedUpload = !!doc.upload;
                const needsCorrection = slotNeedsCorrection(doc.id);
                const isVerifiedUpload = doc.upload?.ai_status === 'verified';
                const isReplacing = replaceIntentIds.has(doc.id);
                const showExistingFileCard =
                  yearUnlockedForResubmit
                  && hasSubmittedUpload
                  && (!isReplacing || needsCorrection);
                const showUploadZone =
                  !alreadySubmitted
                  && (
                    !yearUnlockedForResubmit
                    || needsCorrection
                    || isReplacing
                    || !hasSubmittedUpload
                  );
                const verifiedNoChange =
                  isCorrectionResubmitMode && hasSubmittedUpload && !needsCorrection && !isReplacing;
                const slotStatus = verifiedNoChange || (yearUnlockedForResubmit && isVerifiedUpload && !isReplacing && !pendingFile)
                  ? 'Verified'
                  : alreadySubmitted && hasSubmittedUpload
                    ? 'Submitted'
                    : pendingFile
                      ? 'Selected'
                      : needsCorrection
                        ? 'Needs correction'
                        : 'Pending';

                return (
                  <div
                    key={doc.id}
                    className={`border rounded-lg p-4 ${needsCorrection ? 'border-amber-300 bg-amber-50/40' : yearUnlockedForResubmit && isVerifiedUpload && !isReplacing ? 'border-green-200 bg-green-50/30' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {slotStatus === 'Verified' || slotStatus === 'Submitted' ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : slotStatus === 'Selected' ? (
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                        ) : (
                          <AlertCircle className={`w-5 h-5 ${needsCorrection ? 'text-amber-600' : 'text-gray-400'}`} />
                        )}
                        <div>
                          <h3 className="font-medium">{doc.name} ({doc.tax_year})</h3>
                          {(verifiedNoChange || (yearUnlockedForResubmit && isVerifiedUpload && !isReplacing && !pendingFile)) && doc.upload && (
                            <p className="text-sm text-green-700">
                              Verified — {doc.upload.file_name}
                              {!needsCorrection && !isReplacing ? ' (optional: replace if you need a new file)' : ''}
                            </p>
                          )}
                          {alreadySubmitted && doc.upload && !verifiedNoChange && !yearUnlockedForResubmit && (
                            <p className="text-sm text-muted-foreground">
                              Submitted: {doc.upload.file_name} on {new Date(doc.upload.uploaded_at).toLocaleDateString()}
                            </p>
                          )}
                          {needsCorrection && !pendingFile && (
                            <p className="text-sm text-amber-800">Please upload the corrected file for this slot.</p>
                          )}
                          {isReplacing && !pendingFile && !needsCorrection && (
                            <p className="text-sm text-muted-foreground">Choose a new file below to replace your current upload.</p>
                          )}
                          {!alreadySubmitted && !verifiedNoChange && pendingFile && (
                            <p className="text-sm text-muted-foreground">
                              Selected: {pendingFile.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          slotStatus === 'Verified' || slotStatus === 'Submitted' ? 'default'
                            : slotStatus === 'Selected' ? 'secondary'
                              : needsCorrection ? 'destructive'
                                : 'outline'
                        }
                        className={slotStatus === 'Verified' ? 'bg-green-600 hover:bg-green-600' : undefined}
                      >
                        {slotStatus}
                      </Badge>
                    </div>

                    {showExistingFileCard && doc.upload && (
                      <div className="mb-3">
                        <UploadedDocumentCard
                          fileName={doc.upload.file_name}
                          uploadedAt={doc.upload.uploaded_at}
                          aiStatus={doc.upload.ai_status}
                          storagePath={doc.upload.storage_path}
                          allowReplace={!needsCorrection}
                          onReplace={needsCorrection ? undefined : () => onStartReplace(doc.id)}
                          getSignedUrl={getSignedUrl}
                        />
                      </div>
                    )}

                    {showUploadZone && (
                      <DocumentUpload
                        key={`${doc.id}-${selectedTaxYear}-${isReplacing ? 'replace' : 'new'}`}
                        documentId={doc.id}
                        documentName={doc.name}
                        selectedFile={pendingFile ?? null}
                        onFileSelected={onFileSelected}
                        onFileClear={onFileClear}
                        uploadDisabled={yearLocked}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {missingDocs.length > 0 && !yearLocked && !loading && (
        <Card className="mb-8 border-yellow-300 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-yellow-900">
                  {isCorrectionResubmitMode ? 'Still need correction' : 'Still Missing'}
                </p>
                <p className="text-sm text-yellow-800 mt-1">{missingDocs.join(', ')}</p>
              </div>
              {showSelfReminder && !isCorrectionResubmitMode && onSelfReminder && (
                <Button variant="outline" className="border-yellow-400" onClick={onSelfReminder}>
                  <Mail className="w-4 h-4 mr-2" />Email Reminder to Myself
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {totalCount > 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {alreadySubmitted && !yearUnlockedForResubmit ? (
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
              ) : yearUnlockedForResubmit ? (
                <>
                  <h3 className="text-lg font-medium">
                    {isCorrectionResubmitMode ? 'Ready to resubmit corrections?' : 'Ready to submit updates?'}
                  </h3>
                  <p className="text-muted-foreground">
                    {isCorrectionResubmitMode
                      ? `Upload the corrected file${reuploadIds.size === 1 ? '' : 's'} above, then submit. Verified documents stay on file unless you chose to replace them.`
                      : 'Preview your files above. Submit only if you selected new files to replace existing uploads.'}
                  </p>
                  <Button
                    size="lg"
                    disabled={!canSubmitUnlocked || submitting}
                    className="bg-green-600 hover:bg-green-700"
                    onClick={onSubmit}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {submitting
                      ? 'Submitting…'
                      : isCorrectionResubmitMode
                        ? `Submit ${selectedTaxYear} corrections`
                        : `Submit ${selectedTaxYear} updates`}
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium">Ready to Submit?</h3>
                  <p className="text-muted-foreground">
                    Select a file for every required slot, then submit to send your {selectedTaxYear} package to your preparer for review.
                  </p>
                  <Button
                    size="lg"
                    disabled={!canSubmitInitial || submitting}
                    className="bg-green-600 hover:bg-green-700"
                    onClick={onSubmit}
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
    </>
  );
};

export default ClientPortalDocumentSection;
