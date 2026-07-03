import type { Database } from './database.types';
import { detectDocType } from './aiSimulation';
import { lookupDemoDocument } from './demoTaxDocumentManifest';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR, docTypeLabel } from './taxConfig';
import {
  compareYoYDocuments,
  isUnexpectedNonTaxDocument,
} from './yoyDocumentCompare';

type DocReq = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

export interface ComparisonResult {
  missing: { docType: string; name: string; hadInPriorYear: boolean }[];
  wrongYear: { fileName: string; detectedYear: string; requirementName: string }[];
  wrongType: { fileName: string; expected: string; detected: string }[];
  unexpected: { fileName: string; reason: string }[];
  verified: { docType: string; fileName: string; name: string }[];
  yoyNotes: { docType: string; fileName: string; note: string }[];
}

/** Ensure comparison payloads from edge functions or DB snapshots always have arrays. */
export function normalizeComparisonResult(
  raw: Partial<ComparisonResult> & Record<string, unknown>,
): ComparisonResult {
  const missing = Array.isArray(raw.missing)
    ? raw.missing.map((m: Record<string, unknown>) => ({
      docType: String(m.docType ?? ''),
      name: String(m.name ?? ''),
      hadInPriorYear: Boolean(m.hadInPriorYear ?? m.hadIn2024),
    }))
    : [];

  return {
    missing,
    wrongYear: Array.isArray(raw.wrongYear) ? raw.wrongYear as ComparisonResult['wrongYear'] : [],
    wrongType: Array.isArray(raw.wrongType) ? raw.wrongType as ComparisonResult['wrongType'] : [],
    unexpected: Array.isArray(raw.unexpected) ? raw.unexpected as ComparisonResult['unexpected'] : [],
    verified: Array.isArray(raw.verified) ? raw.verified as ComparisonResult['verified'] : [],
    yoyNotes: Array.isArray(raw.yoyNotes) ? raw.yoyNotes as ComparisonResult['yoyNotes'] : [],
  };
}

/** True when the client must fix uploads (missing, wrong year/type, or unexpected files). */
export function comparisonHasClientIssues(
  result: ComparisonResult | Partial<ComparisonResult>,
): boolean {
  const n = normalizeComparisonResult(result as Partial<ComparisonResult> & Record<string, unknown>);
  return (
    n.missing.length > 0 ||
    n.wrongYear.length > 0 ||
    n.wrongType.length > 0 ||
    n.unexpected.length > 0
  );
}

type ReuploadDocRow = {
  id: string;
  doc_type: string;
  name: string;
  upload?: { file_name: string; ai_status: string } | null;
};

/**
 * Requirement IDs the client must re-upload after preparer unlock.
 * Uses the active correction snapshot when present; otherwise flagged/rejected uploads.
 */
export function getReuploadRequirementIds(
  requiredDocs: ReuploadDocRow[],
  comparison: ComparisonResult | Partial<ComparisonResult> | null | undefined,
): Set<string> {
  const ids = new Set<string>();

  if (comparison && comparisonHasClientIssues(comparison)) {
    const n = normalizeComparisonResult(comparison as Partial<ComparisonResult> & Record<string, unknown>);

    for (const m of n.missing) {
      const doc = requiredDocs.find(d => d.doc_type === m.docType);
      if (doc) ids.add(doc.id);
    }

    const addByFileName = (fileName: string) => {
      const doc = requiredDocs.find(d => d.upload?.file_name === fileName);
      if (doc) ids.add(doc.id);
    };

    for (const w of n.wrongYear) {
      const doc = requiredDocs.find(d => d.name === w.requirementName) ?? requiredDocs.find(d => d.upload?.file_name === w.fileName);
      if (doc) ids.add(doc.id);
      else addByFileName(w.fileName);
    }

    for (const w of n.wrongType) addByFileName(w.fileName);
    for (const u of n.unexpected) addByFileName(u.fileName);

    return ids;
  }

  for (const doc of requiredDocs) {
    const status = doc.upload?.ai_status;
    if (status === 'flagged' || status === 'rejected') {
      ids.add(doc.id);
    }
  }

  return ids;
}

export interface AnalyzeDocumentResult {
  docType: string;
  docTypeSlug: string;
  taxYear: string;
  confidence: number;
  issues: Array<{ type: 'wrong-year' | 'wrong-type' | 'duplicate' | 'unexpected'; message: string }>;
  aiStatus: 'verified' | 'wrong_year' | 'duplicate' | 'unexpected';
  aiMessage: string;
}

/** Normalize detected label or slug to canonical doc_type slug. */
export function normalizeDocTypeSlug(input: string): string {
  const fn = input.toLowerCase();
  if (fn.includes('w2') || fn === 'w-2') return 'w2';
  if (fn.includes('1099-nec') || fn.includes('1099nec')) return '1099-nec';
  if (fn.includes('1099-int') || fn.includes('1099int')) return '1099-int';
  if (fn.includes('1099-div') || fn.includes('1099div')) return '1099-div';
  if (fn.includes('1099-b') || fn.includes('1099b')) return '1099-b';
  if (fn.includes('1098')) return '1098';
  if (fn.includes('k1') || fn.includes('k-1')) return 'k1';
  if (fn.includes('schedule') || fn.includes('schc') || fn.includes('sched')) return 'sched-c';
  return fn;
}

export function detectTaxYearFromFilename(fileName: string): string | null {
  const match = fileName.match(/20\d{2}/);
  return match ? match[0] : null;
}

/** Override stale edge-function wrong-year results using the portal's selected tax year. */
export function reconcileAnalysisForTaxYear(
  result: AnalyzeDocumentResult,
  fileName: string,
  expectedTaxYear: string,
): AnalyzeDocumentResult {
  const yearFromName = detectTaxYearFromFilename(fileName);

  if (yearFromName && yearFromName !== expectedTaxYear) {
    return {
      ...result,
      aiStatus: 'wrong_year',
      taxYear: yearFromName,
      aiMessage: `Tax year ${yearFromName} detected; ${expectedTaxYear} is required.`,
      issues: [{ type: 'wrong-year', message: `Tax year ${yearFromName} detected; ${expectedTaxYear} is required.` }],
    };
  }

  if (result.aiStatus === 'wrong_year' && (!yearFromName || yearFromName === expectedTaxYear)) {
    return {
      ...result,
      aiStatus: 'verified',
      taxYear: expectedTaxYear,
      aiMessage: 'Document verified and stored.',
      issues: result.issues.filter(i => i.type !== 'wrong-year'),
    };
  }

  return result;
}

/** Mock analyzer — used client-side and mirrored in edge function. */
export function analyzeDocumentMock(
  fileName: string,
  requirementDocType: string,
  existingFilenames: string[],
  expectedTaxYear: string = CURRENT_TAX_YEAR,
): AnalyzeDocumentResult {
  const fn = fileName.toLowerCase();
  const detectedLabel = detectDocType(fileName);
  const detectedSlug = normalizeDocTypeSlug(detectedLabel);
  const expectedSlug = normalizeDocTypeSlug(requirementDocType);
  const yearFromName = detectTaxYearFromFilename(fileName);
  const taxYear = yearFromName ?? expectedTaxYear;
  const issues: AnalyzeDocumentResult['issues'] = [];

  if (existingFilenames.some(n => n.toLowerCase() === fn)) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 98,
      issues: [{ type: 'duplicate', message: 'A file with this name was already uploaded.' }],
      aiStatus: 'duplicate',
      aiMessage: 'A file with this name was already uploaded. Remove the existing file before uploading again.',
    };
  }

  if (yearFromName && yearFromName !== expectedTaxYear) {
    issues.push({
      type: 'wrong-year',
      message: `Tax year ${yearFromName} detected; ${expectedTaxYear} is required.`,
    });
  }

  if (/(bank|statement|receipt|paystub|pay-stub)/.test(fn)) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 95,
      issues: [{ type: 'unexpected', message: 'This document is not required for tax filing.' }],
      aiStatus: 'unexpected',
      aiMessage: 'This document is not a required tax form. Please upload the correct tax document.',
    };
  }

  if (detectedSlug !== expectedSlug && detectedSlug !== 'tax document' && !fn.includes(expectedSlug.replace('-', ''))) {
    issues.push({
      type: 'wrong-type',
      message: `Expected ${docTypeLabel(expectedSlug)} but detected ${detectedLabel}.`,
    });
  }

  if (issues.some(i => i.type === 'wrong-year')) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 97,
      issues,
      aiStatus: 'wrong_year',
      aiMessage: `This document appears to be from tax year ${yearFromName}. Tax year ${expectedTaxYear} is required — please re-upload the correct version.`,
    };
  }

  if (issues.some(i => i.type === 'wrong-type')) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 94,
      issues,
      aiStatus: 'unexpected',
      aiMessage: `This file looks like a ${detectedLabel}, not the required ${docTypeLabel(expectedSlug)}. Please upload the correct document.`,
    };
  }

  return {
    docType: detectedLabel,
    docTypeSlug: detectedSlug,
    taxYear: expectedTaxYear,
    confidence: 96,
    issues: [],
    aiStatus: 'verified',
    aiMessage: 'Document verified and stored.',
  };
}

/** Treat prior wrong-year flags as verified when the file matches the selected tax year. */
export function effectiveUploadAiStatus(
  upload: DocUpload | undefined,
  expectedTaxYear: string,
): DocUpload['ai_status'] | 'pending' {
  if (!upload) return 'pending';
  if (upload.ai_status === 'verified') return 'verified';

  const uploadYear = upload.tax_year ?? CURRENT_TAX_YEAR;
  if (uploadYear !== expectedTaxYear) return upload.ai_status;

  const yearFromName = detectTaxYearFromFilename(upload.file_name);
  if (!yearFromName || yearFromName === expectedTaxYear) {
    return 'verified';
  }

  return upload.ai_status;
}

export function compareDocuments(
  currentRequirements: DocReq[],
  currentUploads: DocUpload[],
  priorUploads: DocUpload[],
  priorRequirements: DocReq[],
  expectedTaxYear: string = CURRENT_TAX_YEAR,
  priorTaxYear: string = PRIOR_TAX_YEAR,
): ComparisonResult {
  const result: ComparisonResult = {
    missing: [],
    wrongYear: [],
    wrongType: [],
    unexpected: [],
    verified: [],
    yoyNotes: [],
  };

  const priorDocTypes = new Set(
    priorUploads
      .filter(u => u.ai_status === 'verified')
      .map(u => {
        const req = priorRequirements.find(r => r.id === u.requirement_id);
        return req?.doc_type ?? normalizeDocTypeSlug(u.file_name);
      }),
  );

  const priorUploadByType = new Map<string, DocUpload>();
  for (const u of priorUploads.filter(pu => pu.ai_status === 'verified')) {
    const req = priorRequirements.find(r => r.id === u.requirement_id);
    const docType = req?.doc_type ?? normalizeDocTypeSlug(u.file_name);
    priorUploadByType.set(docType, u);
  }

  const verifiedCurrentByType = new Map<string, DocUpload>();

  for (const req of currentRequirements.filter(r => r.required)) {
    const upload = currentUploads.find(u => u.requirement_id === req.id);
    if (!upload) {
      if (priorDocTypes.has(req.doc_type)) {
        result.missing.push({
          docType: req.doc_type,
          name: req.name,
          hadInPriorYear: true,
        });
      }
      continue;
    }

    const demoMeta = lookupDemoDocument(upload.file_name);
    const yearFromName = detectTaxYearFromFilename(upload.file_name);
    const yearFromMeta = demoMeta?.taxYear ?? null;
    const effectiveYear = yearFromName ?? yearFromMeta;

    if (isUnexpectedNonTaxDocument(upload.file_name)) {
      result.unexpected.push({
        fileName: upload.file_name,
        reason: 'Not a required tax document',
      });
      continue;
    }

    if (upload.ai_status === 'verified') {
      verifiedCurrentByType.set(req.doc_type, upload);
      result.verified.push({
        docType: req.doc_type,
        fileName: upload.file_name,
        name: req.name,
      });
      const priorUpload = priorUploadByType.get(req.doc_type);
      if (priorUpload) {
        const notes = compareYoYDocuments(
          req.doc_type,
          upload.file_name,
          '',
          priorUpload.file_name,
          '',
        );
        for (const note of notes) {
          result.yoyNotes.push({ docType: req.doc_type, fileName: upload.file_name, note });
        }
      }
      continue;
    }

    if (effectiveYear && effectiveYear !== expectedTaxYear) {
      result.wrongYear.push({
        fileName: upload.file_name,
        detectedYear: effectiveYear,
        requirementName: req.name,
      });
      continue;
    }

    const detectedSlug = normalizeDocTypeSlug(detectDocType(upload.file_name));
    if (detectedSlug !== req.doc_type && detectedSlug !== 'tax document') {
      result.wrongType.push({
        fileName: upload.file_name,
        expected: docTypeLabel(req.doc_type),
        detected: detectDocType(upload.file_name),
      });
    } else if (upload.ai_status === 'flagged' || upload.ai_status === 'rejected') {
      if (isUnexpectedNonTaxDocument(upload.file_name)) {
        result.unexpected.push({
          fileName: upload.file_name,
          reason: 'Not a required tax document',
        });
      }
    } else {
      verifiedCurrentByType.set(req.doc_type, upload);
      result.verified.push({
        docType: req.doc_type,
        fileName: upload.file_name,
        name: req.name,
      });
      const priorUpload = priorUploadByType.get(req.doc_type);
      if (priorUpload) {
        const notes = compareYoYDocuments(
          req.doc_type,
          upload.file_name,
          '',
          priorUpload.file_name,
          '',
        );
        for (const note of notes) {
          result.yoyNotes.push({ docType: req.doc_type, fileName: upload.file_name, note });
        }
      }
    }
  }

  for (const docType of priorDocTypes) {
    const hasCurrentReq = currentRequirements.some(r => r.doc_type === docType && r.required);
    const hasVerified = verifiedCurrentByType.has(docType);
    const hasUpload = currentRequirements
      .filter(r => r.doc_type === docType && r.required)
      .some(r => currentUploads.some(u => u.requirement_id === r.id));
    const alreadyListed = result.missing.some(m => m.docType === docType);
    const hasOpenIssue =
      result.wrongYear.some(w => {
        const req = currentRequirements.find(r => r.name === w.requirementName);
        return req?.doc_type === docType;
      }) ||
      result.wrongType.some(w => {
        const upload = currentUploads.find(u => u.file_name === w.fileName);
        const req = currentRequirements.find(r => r.id === upload?.requirement_id);
        return req?.doc_type === docType;
      }) ||
      result.unexpected.some(u => {
        const upload = currentUploads.find(up => up.file_name === u.fileName);
        const req = currentRequirements.find(r => r.id === upload?.requirement_id);
        return req?.doc_type === docType;
      });

    // Missing = empty slot only. Wrong-year/type uploads are not "missing".
    if (hasCurrentReq && !hasVerified && !hasUpload && !hasOpenIssue && !alreadyListed) {
      const req = currentRequirements.find(r => r.doc_type === docType);
      result.missing.push({
        docType,
        name: req?.name ?? docTypeLabel(docType),
        hadInPriorYear: true,
      });
    }
  }

  void priorTaxYear;
  return result;
}

/** Map YoY comparison outcome to a single upload's ai_status. */
export function resolveUploadReviewStatus(
  req: DocReq,
  upload: DocUpload,
  result: ComparisonResult,
  expectedTaxYear: string = CURRENT_TAX_YEAR,
): DocUpload['ai_status'] {
  if (result.wrongYear.some(w => w.fileName === upload.file_name)) return 'flagged';
  if (result.wrongType.some(w => w.fileName === upload.file_name)) return 'flagged';
  if (result.unexpected.some(u => u.fileName === upload.file_name)) return 'rejected';
  if (result.verified.some(v => v.fileName === upload.file_name || v.docType === req.doc_type)) {
    return 'verified';
  }

  const yearFromName = detectTaxYearFromFilename(upload.file_name);
  if (yearFromName && yearFromName !== expectedTaxYear) return 'flagged';

  const detectedSlug = normalizeDocTypeSlug(detectDocType(upload.file_name));
  if (detectedSlug !== req.doc_type && detectedSlug !== 'tax document') return 'flagged';
  if (isUnexpectedNonTaxDocument(upload.file_name)) return 'rejected';

  return 'verified';
}

export function comparisonToEmailLabels(
  result: ComparisonResult | Partial<ComparisonResult>,
  expectedTaxYear: string = CURRENT_TAX_YEAR,
  priorTaxYear: string = PRIOR_TAX_YEAR,
): string[] {
  const normalized = normalizeComparisonResult(result as Partial<ComparisonResult> & Record<string, unknown>);
  const labels: string[] = [];
  for (const m of normalized.missing) {
    labels.push(`${expectedTaxYear} ${m.name}${m.hadInPriorYear ? ` (had in ${priorTaxYear})` : ''}`);
  }
  for (const w of normalized.wrongYear) {
    labels.push(`${w.requirementName} — wrong year (${w.detectedYear})`);
  }
  for (const w of normalized.wrongType) {
    labels.push(`${w.expected} — wrong type (${w.detected} uploaded)`);
  }
  for (const u of normalized.unexpected) {
    labels.push(`${u.fileName} — unexpected`);
  }
  for (const y of normalized.yoyNotes) {
    labels.push(`${docTypeLabel(y.docType)} — ${y.note}`);
  }
  return labels;
}
