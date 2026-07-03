import type { ComparisonResult } from './documentComparison';
import { getReuploadRequirementIds } from './documentComparison';
import type { Database } from './database.types';
import { CURRENT_TAX_YEAR, isValidPortalTaxYear } from './taxConfig';

type Client = Database['public']['Tables']['clients']['Row'];
type DocReq = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

export interface PortalDocRow extends DocReq {
  upload?: DocUpload;
}

export interface ClientPortalDocumentStateInput {
  requiredDocs: PortalDocRow[];
  clientRecord: Client | null;
  selectedTaxYear: string;
  yearLocked: boolean;
  yearSubmitted: boolean;
  activeCorrectionComparison?: ComparisonResult | null;
  pendingFiles: Record<string, File>;
  replaceIntentIds: Set<string>;
}

export interface ClientPortalDocumentState {
  totalCount: number;
  dbUploadedCount: number;
  yearUnlockedForResubmit: boolean;
  reuploadIds: Set<string>;
  isCorrectionResubmitMode: boolean;
  alreadySubmitted: boolean;
  slotNeedsCorrection: (docId: string) => boolean;
  selectedCount: number;
  satisfiedCount: number;
  progressDenominator: number;
  progressNumerator: number;
  filledCount: number;
  progress: number;
  allSlotsFilled: boolean;
  canSubmitCorrections: boolean;
  canSubmitOptionalReplaces: boolean;
  canSubmitUnlocked: boolean;
  canSubmitInitial: boolean;
  canSubmit: boolean;
  missingDocs: string[];
}

export function isPortalTaxYearEnabled(client: Client, year: string): boolean {
  if (year === CURRENT_TAX_YEAR) return true;
  const enabled = client.portal_enabled_years ?? [];
  if (enabled.length > 0) return enabled.includes(year);
  return client.prior_year_upload_enabled === true && year === '2024';
}

export function computePortalYearLock(
  client: Client,
  taxYear: string,
  yearSubmitted: boolean,
): { locked: boolean; reason?: string } {
  if (taxYear !== CURRENT_TAX_YEAR && !isPortalTaxYearEnabled(client, taxYear)) {
    return {
      locked: true,
      reason: `Uploads for ${taxYear} are disabled. Ask your preparer to enable prior-year uploads.`,
    };
  }
  if (!yearSubmitted) return { locked: false };

  const unlocks: string[] = client.year_upload_unlocks ?? [];
  if (unlocks.includes(taxYear)) return { locked: false };

  return {
    locked: true,
    reason: `Your ${taxYear} documents were already submitted. Contact your preparer if you need to upload again.`,
  };
}

/** Fallback when magic-link RPC has not returned year_submitted yet. */
export function inferYearSubmittedFromClient(
  client: Client,
  taxYear: string,
  requiredDocs: PortalDocRow[],
): boolean {
  const total = requiredDocs.length;
  const uploaded = requiredDocs.filter(d => d.upload).length;
  if (total === 0 || uploaded < total) return false;
  if (taxYear === CURRENT_TAX_YEAR && client.status === 'complete') return true;
  return false;
}

export function computeClientPortalDocumentState(
  input: ClientPortalDocumentStateInput,
): ClientPortalDocumentState {
  const {
    requiredDocs,
    clientRecord,
    selectedTaxYear,
    yearLocked,
    yearSubmitted,
    activeCorrectionComparison,
    pendingFiles,
    replaceIntentIds,
  } = input;

  const totalCount = requiredDocs.length;
  const dbUploadedCount = requiredDocs.filter(d => d.upload).length;

  const yearUnlockedForResubmit =
    !yearLocked
    && yearSubmitted
    && (clientRecord?.year_upload_unlocks ?? []).includes(selectedTaxYear);

  const reuploadIds = yearUnlockedForResubmit
    ? getReuploadRequirementIds(requiredDocs, activeCorrectionComparison ?? undefined)
    : new Set<string>();

  const isCorrectionResubmitMode = yearUnlockedForResubmit && reuploadIds.size > 0;

  const alreadySubmitted =
    !isCorrectionResubmitMode
    && yearLocked
    && (yearSubmitted || clientRecord?.status === 'complete')
    && dbUploadedCount === totalCount
    && totalCount > 0;

  const slotNeedsCorrection = (docId: string) => isCorrectionResubmitMode && reuploadIds.has(docId);

  const slotIsSatisfied = (doc: PortalDocRow) => {
    if (isCorrectionResubmitMode) {
      if (!reuploadIds.has(doc.id)) return Boolean(doc.upload);
      return Boolean(pendingFiles[doc.id]);
    }
    if (alreadySubmitted) return Boolean(doc.upload);
    return Boolean(pendingFiles[doc.id]);
  };

  const selectedCount = requiredDocs.filter(d => pendingFiles[d.id]).length;
  const satisfiedCount = requiredDocs.filter(slotIsSatisfied).length;
  const progressDenominator = isCorrectionResubmitMode ? reuploadIds.size : totalCount;
  const progressNumerator = isCorrectionResubmitMode
    ? [...reuploadIds].filter(id => pendingFiles[id]).length
    : (alreadySubmitted ? dbUploadedCount : selectedCount);
  const filledCount = satisfiedCount;
  const progress = progressDenominator > 0 ? (progressNumerator / progressDenominator) * 100 : 0;
  const allSlotsFilled = totalCount > 0 && satisfiedCount === totalCount;
  const canSubmitCorrections = isCorrectionResubmitMode && [...reuploadIds].every(id => pendingFiles[id]);
  const canSubmitOptionalReplaces =
    yearUnlockedForResubmit
    && !isCorrectionResubmitMode
    && Object.keys(pendingFiles).length > 0;
  const canSubmitUnlocked = canSubmitCorrections || canSubmitOptionalReplaces;
  const canSubmitInitial = !yearUnlockedForResubmit && !alreadySubmitted && selectedCount === totalCount;
  const canSubmit = canSubmitUnlocked || canSubmitInitial;

  const missingDocs = isCorrectionResubmitMode
    ? requiredDocs
      .filter(d => reuploadIds.has(d.id) && !pendingFiles[d.id])
      .map(d => `${d.tax_year} ${d.name}`)
    : alreadySubmitted
      ? []
      : requiredDocs.filter(d => !pendingFiles[d.id]).map(d => `${d.tax_year} ${d.name}`);

  return {
    totalCount,
    dbUploadedCount,
    yearUnlockedForResubmit,
    reuploadIds,
    isCorrectionResubmitMode,
    alreadySubmitted,
    slotNeedsCorrection,
    selectedCount,
    satisfiedCount,
    progressDenominator,
    progressNumerator,
    filledCount,
    progress,
    allSlotsFilled,
    canSubmitCorrections,
    canSubmitOptionalReplaces,
    canSubmitUnlocked,
    canSubmitInitial,
    canSubmit,
    missingDocs,
  };
}

export function isValidPortalTaxYearForClient(client: Client, year: string): boolean {
  if (year === CURRENT_TAX_YEAR) return true;
  return isPortalTaxYearEnabled(client, year) && isValidPortalTaxYear(year);
}
