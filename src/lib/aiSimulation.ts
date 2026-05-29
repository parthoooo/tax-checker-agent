export type ValidationOutcome = 'verified' | 'wrong-year' | 'duplicate' | 'unexpected' | 'too-small';

export interface ValidationResult {
  outcome: ValidationOutcome;
  title: string;
  detail: string;
  aiStatus: 'verified' | 'flagged' | 'rejected';
}

const TAX_YEAR = '2024';

export function simulateValidation(
  file: File,
  existingFileNames: string[],
  requirementDocType?: string
): ValidationResult {
  const fn = file.name.toLowerCase();

  // Duplicate check — same filename already uploaded
  const isDuplicate = existingFileNames
    .filter(n => n !== file.name)
    .some(n => n.toLowerCase() === fn);
  if (isDuplicate) {
    return {
      outcome: 'duplicate',
      title: 'Duplicate Detected',
      detail: `A file named "${file.name}" was already uploaded. Remove the older copy or upload a different file.`,
      aiStatus: 'flagged',
    };
  }

  // Wrong year — filename contains a 4-digit year that isn't the tax year
  const yearMatch = file.name.match(/20\d{2}/);
  if (yearMatch && yearMatch[0] !== TAX_YEAR) {
    return {
      outcome: 'wrong-year',
      title: 'Wrong Tax Year',
      detail: `Your file appears to be for tax year ${yearMatch[0]}. We need your ${TAX_YEAR} document. Please re-upload the correct year.`,
      aiStatus: 'flagged',
    };
  }

  // Suspiciously small — likely a screenshot or wrong file
  if (file.size < 20_000 && file.type !== 'text/plain') {
    return {
      outcome: 'too-small',
      title: 'File Too Small',
      detail: `This file (${Math.round(file.size / 1024)} KB) appears incomplete. Tax documents are typically larger. Please verify you uploaded the full document.`,
      aiStatus: 'flagged',
    };
  }

  // Unexpected file type for the requirement
  if (requirementDocType) {
    const typeMap: Record<string, string[]> = {
      w2:       ['w2', 'w-2', 'wage'],
      '1099-nec': ['1099', 'nec'],
      '1099-int': ['1099', 'int'],
      '1099-div': ['1099', 'div'],
      '1099-b':   ['1099', '1099b'],
      '1098':     ['1098', 'mortgage'],
      'sched-c':  ['schedule', 'sched', 'schc'],
      'k1':       ['k1', 'k-1'],
    };
    const keywords = typeMap[requirementDocType] ?? [];
    if (keywords.length > 0 && !keywords.some(k => fn.includes(k))) {
      return {
        outcome: 'unexpected',
        title: 'Possible Wrong Document Type',
        detail: `The filename doesn't match the expected document type. Please confirm this is the correct file.`,
        aiStatus: 'flagged',
      };
    }
  }

  return {
    outcome: 'verified',
    title: 'Document Verified',
    detail: `AI analysis complete. Your ${TAX_YEAR} document looks correct.`,
    aiStatus: 'verified',
  };
}

export function buildFlagDescription(result: ValidationResult, fileName: string): string {
  switch (result.outcome) {
    case 'wrong-year': {
      const y = fileName.match(/20\d{2}/)?.[0] ?? 'unknown';
      return `Uploaded ${fileName} — tax year ${y} detected, ${TAX_YEAR} required.`;
    }
    case 'duplicate':
      return `Duplicate upload detected: ${fileName}. Identical file already exists.`;
    case 'too-small':
      return `${fileName} appears incomplete (< 20 KB). Client should re-upload the full document.`;
    case 'unexpected':
      return `${fileName} may not match the required document type for this slot.`;
    default:
      return `Issue detected with ${fileName}.`;
  }
}

export function buildEmailDraftBody(
  clientName: string,
  result: ValidationResult,
  fileName: string,
  preparer: string
): { subject: string; body: string } {
  const firstName = clientName.split(' ')[0];

  switch (result.outcome) {
    case 'wrong-year': {
      const y = fileName.match(/20\d{2}/)?.[0] ?? 'unknown';
      return {
        subject: `Action Required: Wrong Tax Year — ${fileName}`,
        body: `Hi ${firstName},\n\nThank you for submitting your documents. Our system detected an issue:\n\n• File uploaded: ${fileName}\n• Issue: This document is for tax year ${y}. We need your ${TAX_YEAR} document.\n\nPlease log back in using your secure link and re-upload the correct version at your earliest convenience.\n\nIf you have any questions, please reply to this email.\n\nThank you,\n${preparer}\nBroder-Mansoor & Associates`,
      };
    }
    case 'duplicate':
      return {
        subject: `Heads Up: Duplicate Document Uploaded`,
        body: `Hi ${firstName},\n\nWe noticed you uploaded "${fileName}" twice. We've kept the most recent copy and removed the older one — no action needed on your end.\n\nIf you intended to upload a different document, please use your secure link to upload the correct file.\n\nThank you,\n${preparer}\nBroder-Mansoor & Associates`,
      };
    case 'too-small':
      return {
        subject: `Please Re-Upload: Incomplete Document`,
        body: `Hi ${firstName},\n\nThe file "${fileName}" you uploaded appears to be incomplete or may be a screenshot rather than the full document.\n\nPlease re-upload the complete PDF version using your secure link.\n\nThank you,\n${preparer}\nBroder-Mansoor & Associates`,
      };
    default:
      return {
        subject: `Document Issue: ${fileName}`,
        body: `Hi ${firstName},\n\nWe detected an issue with "${fileName}" that requires your attention. Please log back in and review.\n\nThank you,\n${preparer}\nBroder-Mansoor & Associates`,
      };
  }
}
