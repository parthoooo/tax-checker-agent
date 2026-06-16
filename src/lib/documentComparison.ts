import type { Database } from './database.types';
import { detectDocType } from './aiSimulation';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR, docTypeLabel } from './taxConfig';

type DocReq = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

export interface ComparisonResult {
  missing: { docType: string; name: string; hadIn2024: boolean }[];
  wrongYear: { fileName: string; detectedYear: string; requirementName: string }[];
  wrongType: { fileName: string; expected: string; detected: string }[];
  unexpected: { fileName: string; reason: string }[];
  verified: { docType: string; fileName: string; name: string }[];
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

/** Mock analyzer — used client-side and mirrored in edge function. */
export function analyzeDocumentMock(
  fileName: string,
  requirementDocType: string,
  existingFilenames: string[],
): AnalyzeDocumentResult {
  const fn = fileName.toLowerCase();
  const detectedLabel = detectDocType(fileName);
  const detectedSlug = normalizeDocTypeSlug(detectedLabel);
  const expectedSlug = normalizeDocTypeSlug(requirementDocType);
  const yearFromName = detectTaxYearFromFilename(fileName);
  const taxYear = yearFromName ?? CURRENT_TAX_YEAR;
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

  if (yearFromName && yearFromName !== CURRENT_TAX_YEAR) {
    issues.push({
      type: 'wrong-year',
      message: `Tax year ${yearFromName} detected; ${CURRENT_TAX_YEAR} is required.`,
    });
  }

  if (/(bank|statement)/.test(fn)) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 95,
      issues: [{ type: 'unexpected', message: 'Bank statements are not required for tax filing.' }],
      aiStatus: 'unexpected',
      aiMessage: 'Bank statements are not required for your tax filing. Please upload the correct tax document.',
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
      aiMessage: `This document appears to be from tax year ${yearFromName}. Tax year ${CURRENT_TAX_YEAR} is required — please re-upload the correct version.`,
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
    taxYear: CURRENT_TAX_YEAR,
    confidence: 96,
    issues: [],
    aiStatus: 'verified',
    aiMessage: 'Document verified and stored.',
  };
}

export function compareDocuments(
  currentRequirements: DocReq[],
  currentUploads: DocUpload[],
  priorUploads: DocUpload[],
  priorRequirements: DocReq[],
): ComparisonResult {
  const result: ComparisonResult = {
    missing: [],
    wrongYear: [],
    wrongType: [],
    unexpected: [],
    verified: [],
  };

  const priorDocTypes = new Set(
    priorUploads
      .filter(u => u.ai_status === 'verified')
      .map(u => {
        const req = priorRequirements.find(r => r.id === u.requirement_id);
        return req?.doc_type ?? normalizeDocTypeSlug(u.file_name);
      }),
  );

  const verifiedCurrentByType = new Map<string, DocUpload>();

  for (const req of currentRequirements.filter(r => r.required)) {
    const upload = currentUploads.find(u => u.requirement_id === req.id);
    if (!upload) {
      if (priorDocTypes.has(req.doc_type)) {
        result.missing.push({
          docType: req.doc_type,
          name: req.name,
          hadIn2024: true,
        });
      }
      continue;
    }

    if (upload.ai_status === 'verified') {
      verifiedCurrentByType.set(req.doc_type, upload);
      result.verified.push({
        docType: req.doc_type,
        fileName: upload.file_name,
        name: req.name,
      });
      continue;
    }

    const yearFromName = detectTaxYearFromFilename(upload.file_name);
    if (yearFromName && yearFromName !== CURRENT_TAX_YEAR) {
      result.wrongYear.push({
        fileName: upload.file_name,
        detectedYear: yearFromName,
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
      if (/(bank|statement)/.test(upload.file_name.toLowerCase())) {
        result.unexpected.push({
          fileName: upload.file_name,
          reason: 'Not a required tax document',
        });
      }
    }
  }

  // Missing docs expected from prior year but not in current checklist uploads
  for (const docType of priorDocTypes) {
    const hasCurrentReq = currentRequirements.some(r => r.doc_type === docType && r.required);
    const hasVerified = verifiedCurrentByType.has(docType);
    if (hasCurrentReq && !hasVerified && !result.missing.some(m => m.docType === docType)) {
      const req = currentRequirements.find(r => r.doc_type === docType);
      result.missing.push({
        docType,
        name: req?.name ?? docTypeLabel(docType),
        hadIn2024: true,
      });
    }
  }

  return result;
}

export function comparisonToEmailLabels(result: ComparisonResult): string[] {
  const labels: string[] = [];
  for (const m of result.missing) {
    labels.push(`${CURRENT_TAX_YEAR} ${m.name}${m.hadIn2024 ? ` (had in ${PRIOR_TAX_YEAR})` : ''}`);
  }
  for (const w of result.wrongYear) {
    labels.push(`${w.requirementName} — wrong year (${w.detectedYear})`);
  }
  for (const w of result.wrongType) {
    labels.push(`${w.expected} — wrong type (${w.detected} uploaded)`);
  }
  for (const u of result.unexpected) {
    labels.push(`${u.fileName} — unexpected`);
  }
  return labels;
}
