// ── Types ─────────────────────────────────────────────────────────────────────

export type ValidationOutcome =
  | 'verified'
  | 'wrong-year'
  | 'duplicate'
  | 'unexpected'
  | 'too-small'
  | 'page_count_warning';

export interface ValidationResult {
  outcome: ValidationOutcome;
  title: string;
  detail: string;
  aiStatus: 'verified' | 'flagged' | 'rejected';
  confidence: number;
}

export interface InputSheetField {
  section: string;
  field_name: string;
  field_value: string;
  confidence: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import { CURRENT_TAX_YEAR } from '@/lib/taxConfig';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function detectDocType(filename: string): string {
  const fn = filename.toLowerCase();
  if (fn.includes('w2') || fn.includes('w-2')) return 'W-2';
  if (fn.includes('1099-nec') || fn.includes('1099nec')) return '1099-NEC';
  if (fn.includes('1099-int') || fn.includes('1099int')) return '1099-INT';
  if (fn.includes('1099-div') || fn.includes('1099div')) return '1099-DIV';
  if (fn.includes('1099-b') || fn.includes('1099b')) return '1099-B';
  if (fn.includes('1099')) return '1099';
  if (fn.includes('1098')) return '1098 Mortgage Interest';
  if (fn.includes('k1') || fn.includes('k-1')) return 'K-1';
  if (fn.includes('schedule') || fn.includes('schc') || fn.includes('sched')) return 'Schedule C';
  return 'tax document';
}

const EMPLOYERS = [
  'Acme Corporation', 'Goldman Sachs', 'JPMorgan Chase', 'Deloitte LLP',
  'NYC Department of Education', 'Mount Sinai Health System',
];
const PAYERS_NEC = ['Upwork Global Inc.', 'Fiverr International', 'Stripe Inc.', 'Square Inc.'];
const PAYERS_INT = ['Fidelity Investments', 'Vanguard Group', 'Charles Schwab', 'Ally Bank'];
const LENDERS   = ['Wells Fargo Bank', 'Chase Home Lending', 'Bank of America', 'Rocket Mortgage'];

// ── 1. Document Validation ────────────────────────────────────────────────────

export async function simulateValidation(
  file: File,
  existingFileNames: string[],
  requirementDocType?: string,
): Promise<ValidationResult> {
  await new Promise(r => setTimeout(r, 1200));

  const fn = file.name.toLowerCase();
  const docType = detectDocType(file.name);

  // Duplicate
  const isDuplicate = existingFileNames
    .filter(n => n !== file.name)
    .some(n => n.toLowerCase() === fn);
  if (isDuplicate) {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return {
      outcome: 'duplicate',
      title: 'Duplicate Detected',
      detail: `This file was already uploaded on ${date}. Skipping to avoid duplicates.`,
      aiStatus: 'flagged',
      confidence: randInt(97, 99),
    };
  }

  // Wrong year
  const yearMatch = fn.match(/20\d{2}/);
  if (yearMatch && yearMatch[0] !== CURRENT_TAX_YEAR) {
    return {
      outcome: 'wrong-year',
      title: 'Wrong Tax Year Detected',
      detail: `AI identified this as a ${yearMatch[0]} ${docType}. Tax year ${CURRENT_TAX_YEAR} is required. Please re-upload the correct year.`,
      aiStatus: 'flagged',
      confidence: randInt(97, 99),
    };
  }

  // Bank statement / unexpected
  if (/(bank|statement|chase|wells|citi|bofa)/.test(fn)) {
    return {
      outcome: 'unexpected',
      title: 'Bank Statement Detected',
      detail: `Bank statement detected. This document is not required for your ${CURRENT_TAX_YEAR} tax filing. Please upload the correct tax document instead.`,
      aiStatus: 'flagged',
      confidence: randInt(94, 98),
    };
  }

  // Incomplete / partial page count
  if (/(incomplete|1page|partial|pg1|page1)/.test(fn)) {
    return {
      outcome: 'page_count_warning',
      title: 'Possible Incomplete Document',
      detail: `This ${docType} appears to be missing pages. Standard ${docType}s have 2–3 pages. Please verify you uploaded the complete document.`,
      aiStatus: 'flagged',
      confidence: randInt(94, 97),
    };
  }

  // Too small
  if (file.size < 20_000 && file.type !== 'text/plain') {
    return {
      outcome: 'too-small',
      title: 'File Appears Incomplete',
      detail: `This file (${Math.round(file.size / 1024)} KB) is smaller than expected for a ${docType}. Tax documents are typically larger. Please verify you uploaded the full document.`,
      aiStatus: 'flagged',
      confidence: randInt(94, 97),
    };
  }

  // Unexpected doc type for the requirement slot
  if (requirementDocType) {
    const typeMap: Record<string, string[]> = {
      w2:          ['w2', 'w-2', 'wage'],
      '1099-nec':  ['1099', 'nec'],
      '1099-int':  ['1099', 'int'],
      '1099-div':  ['1099', 'div'],
      '1099-b':    ['1099', '1099b'],
      '1098':      ['1098', 'mortgage'],
      'sched-c':   ['schedule', 'sched', 'schc'],
      'k1':        ['k1', 'k-1'],
    };
    const keywords = typeMap[requirementDocType] ?? [];
    if (keywords.length > 0 && !keywords.some(k => fn.includes(k))) {
      return {
        outcome: 'unexpected',
        title: 'Possible Wrong Document Type',
        detail: `The filename doesn't match the expected document type for this slot. Please confirm this is the correct file.`,
        aiStatus: 'flagged',
        confidence: randInt(91, 95),
      };
    }
  }

  // Verified — realistic message based on doc type
  let detail: string;
  if (docType === 'W-2') {
    detail = `AI analysis complete. ${CURRENT_TAX_YEAR} W-2 from ${pick(EMPLOYERS)} verified — wages and withholding fields detected.`;
  } else if (docType === '1099-NEC') {
    detail = `AI analysis complete. ${CURRENT_TAX_YEAR} 1099-NEC from ${pick(PAYERS_NEC)} verified — nonemployee compensation field detected.`;
  } else if (docType === '1099-INT') {
    detail = `AI analysis complete. ${CURRENT_TAX_YEAR} 1099-INT from ${pick(PAYERS_INT)} verified — interest income field detected.`;
  } else if (docType === '1098 Mortgage Interest') {
    detail = `AI analysis complete. ${CURRENT_TAX_YEAR} 1098 from ${pick(LENDERS)} verified — mortgage interest amount detected.`;
  } else if (docType === 'K-1') {
    detail = `AI analysis complete. ${CURRENT_TAX_YEAR} K-1 verified — partnership income and capital account fields detected.`;
  } else if (docType === 'Schedule C') {
    detail = `AI analysis complete. ${CURRENT_TAX_YEAR} Schedule C verified — gross revenue and expense fields detected.`;
  } else {
    detail = `AI analysis complete. Your ${CURRENT_TAX_YEAR} ${docType} looks correct and has been filed.`;
  }

  return {
    outcome: 'verified',
    title: 'Document Verified',
    detail,
    aiStatus: 'verified',
    confidence: randInt(94, 99),
  };
}

// ── 2. Email Draft Generation ─────────────────────────────────────────────────

export async function generateEmailDraft(
  clientName: string,
  missingDocs: string[],
  preparerName: string,
): Promise<string> {
  await new Promise(r => setTimeout(r, 800));

  const firstName = clientName.split(' ')[0];
  const firm = 'Broder Mansoor Muqtadir, Inc.';
  const count = missingDocs.length;
  const bulletList = count > 0
    ? missingDocs.map(d => `  • ${d}`).join('\n')
    : '  • Additional documentation (please check your portal for details)';

  const variations: string[] = [
    // 1 — friendly
    `Hi ${firstName},\n\nI hope this message finds you well. I'm reaching out regarding your ${CURRENT_TAX_YEAR} tax return preparation. We've received most of your documents, but we're still missing a few items to complete your return:\n\n${bulletList}\n\nPlease upload these at your earliest convenience using your secure portal link. Don't hesitate to reach out if you have any questions.\n\nBest regards,\n${preparerName} | ${firm}`,

    // 2 — professional
    `Dear ${firstName},\n\nThank you for the documents submitted so far for your ${CURRENT_TAX_YEAR} tax return. To proceed with your filing, we require the following additional documents:\n\n${bulletList}\n\nPlease upload these through your client portal. If you have any difficulty locating these documents, please contact our office directly.\n\nSincerely,\n${preparerName} | ${firm}`,

    // 3 — brief/urgent (forced when >3 docs missing)
    `Hi ${firstName},\n\nQuick reminder — we're still waiting on ${count || 'a few'} document${count !== 1 ? 's' : ''} to complete your ${CURRENT_TAX_YEAR} tax return:\n\n${bulletList}\n\nThe sooner we receive these, the sooner we can file. Please upload via your portal link.\n\nThanks,\n${preparerName}`,

    // 4 — final reminder
    `Dear ${firstName},\n\nThis is a follow-up regarding your outstanding ${CURRENT_TAX_YEAR} tax documents. Our records show the following items are still needed:\n\n${bulletList}\n\nPlease prioritize uploading these documents. If there are any issues obtaining them, please let us know so we can assist.\n\nRegards,\n${preparerName} | ${firm}`,
  ];

  if (count > 3) return variations[2];
  return variations[Math.floor(Math.random() * variations.length)];
}

// ── 3. Input Sheet Data Generation ───────────────────────────────────────────

function nameHash(name: string): number {
  let h = 5381;
  for (const c of name) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h;
}

function seededInt(seed: number, slot: number, min: number, max: number): number {
  const r = ((seed * (slot + 1) * 2654435761) >>> 0) / 0xffffffff;
  return Math.floor(r * (max - min + 1)) + min;
}

function fmt(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

const PARTNERSHIPS = ['Alpha Real Estate LLC', 'Beta Capital Partners LP', 'Gamma Ventures LP'];

export function generateInputSheetData(
  clientName: string,
  uploadedFilenames: string[],
): InputSheetField[] {
  const h = nameHash(clientName);
  const fns = uploadedFilenames.map(f => f.toLowerCase());

  const hasW2      = fns.some(f => f.includes('w2') || f.includes('w-2'));
  const has1099nec = fns.some(f => f.includes('1099-nec') || f.includes('1099nec'));
  const has1099int = fns.some(f => f.includes('1099-int') || f.includes('1099int'));
  const has1098    = fns.some(f => f.includes('1098'));
  const hasSchedC  = fns.some(f => f.includes('schedule') || f.includes('schc') || f.includes('sched-c'));
  const hasK1      = fns.some(f => f.includes('k1') || f.includes('k-1'));

  const fields: InputSheetField[] = [];

  if (hasW2) {
    const employer = EMPLOYERS[seededInt(h, 0, 0, EMPLOYERS.length - 1)];
    const wages    = seededInt(h, 1, 85000, 280000);
    const federal  = Math.round(wages * 0.22);
    const stateWith = Math.round(wages * 0.06);
    fields.push(
      { section: 'W-2', field_name: 'Employer Name',       field_value: employer,    confidence: seededInt(h, 10, 96, 99) },
      { section: 'W-2', field_name: 'Wages (Box 1)',        field_value: fmt(wages),  confidence: seededInt(h, 11, 95, 99) },
      { section: 'W-2', field_name: 'Federal Tax Withheld', field_value: fmt(federal), confidence: seededInt(h, 12, 94, 99) },
      { section: 'W-2', field_name: 'State Wages',          field_value: fmt(wages),  confidence: seededInt(h, 13, 94, 98) },
      { section: 'W-2', field_name: 'State Tax Withheld',   field_value: fmt(stateWith), confidence: seededInt(h, 14, 94, 98) },
    );
  }

  if (has1099nec) {
    const payer = PAYERS_NEC[seededInt(h, 20, 0, PAYERS_NEC.length - 1)];
    const comp  = seededInt(h, 21, 8000, 45000);
    fields.push(
      { section: '1099-NEC', field_name: 'Payer Name',       field_value: payer,     confidence: seededInt(h, 22, 95, 99) },
      { section: '1099-NEC', field_name: 'Nonemployee Comp.', field_value: fmt(comp), confidence: seededInt(h, 23, 94, 99) },
    );
  }

  if (has1099int) {
    const payer    = PAYERS_INT[seededInt(h, 30, 0, PAYERS_INT.length - 1)];
    const interest = seededInt(h, 31, 200, 2400);
    fields.push(
      { section: '1099-INT', field_name: 'Payer Name',      field_value: payer,          confidence: seededInt(h, 32, 95, 99) },
      { section: '1099-INT', field_name: 'Interest Income', field_value: fmt(interest),  confidence: seededInt(h, 33, 94, 98) },
    );
  }

  if (has1098) {
    const lender    = LENDERS[seededInt(h, 40, 0, LENDERS.length - 1)];
    const interest  = seededInt(h, 41, 8000, 24000);
    const principal = seededInt(h, 42, 180000, 650000);
    fields.push(
      { section: '1098', field_name: 'Lender Name',           field_value: lender,          confidence: seededInt(h, 43, 95, 99) },
      { section: '1098', field_name: 'Mortgage Interest',     field_value: fmt(interest),   confidence: seededInt(h, 44, 94, 99) },
      { section: '1098', field_name: 'Outstanding Principal', field_value: fmt(principal),  confidence: seededInt(h, 45, 75, 85) },
    );
  }

  if (hasSchedC) {
    const gross    = seededInt(h, 50, 35000, 120000);
    const expenses = Math.round(gross * 0.45);
    fields.push(
      { section: 'Schedule C', field_name: 'Gross Revenue',   field_value: fmt(gross),     confidence: seededInt(h, 51, 94, 98) },
      { section: 'Schedule C', field_name: 'Total Expenses',  field_value: fmt(expenses),  confidence: seededInt(h, 52, 75, 85) },
      { section: 'Schedule C', field_name: 'Net Profit/Loss', field_value: fmt(gross - expenses), confidence: seededInt(h, 53, 75, 85) },
    );
  }

  if (hasK1) {
    const partnership = PARTNERSHIPS[seededInt(h, 60, 0, PARTNERSHIPS.length - 1)];
    const ordIncome   = seededInt(h, 61, 5000, 85000);
    const capitalEnd  = seededInt(h, 62, 10000, 250000);
    fields.push(
      { section: 'K-1', field_name: 'Partnership Name',    field_value: partnership,      confidence: seededInt(h, 63, 95, 99) },
      { section: 'K-1', field_name: 'Ordinary Income',     field_value: fmt(ordIncome),   confidence: seededInt(h, 64, 94, 98) },
      { section: 'K-1', field_name: 'Capital Account End', field_value: fmt(capitalEnd),  confidence: seededInt(h, 65, 75, 85) },
    );
  }

  return fields;
}

// ── Legacy helpers (used by MagicLinkPortal) ──────────────────────────────────

export function buildFlagDescription(result: ValidationResult, fileName: string): string {
  switch (result.outcome) {
    case 'wrong-year': {
      const y = fileName.match(/20\d{2}/)?.[0] ?? 'unknown';
      return `Uploaded ${fileName} — tax year ${y} detected, ${CURRENT_TAX_YEAR} required.`;
    }
    case 'duplicate':
      return `Duplicate upload detected: ${fileName}. Identical file already exists.`;
    case 'too-small':
      return `${fileName} appears incomplete (< 20 KB). Client should re-upload the full document.`;
    case 'page_count_warning':
      return `${fileName} may be missing pages. Client should verify the complete document was uploaded.`;
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
  preparer: string,
): { subject: string; body: string } {
  const firstName = clientName.split(' ')[0];
  const firm = 'Broder Mansoor Muqtadir, Inc.';

  switch (result.outcome) {
    case 'wrong-year': {
      const y = fileName.match(/20\d{2}/)?.[0] ?? 'unknown';
      return {
        subject: `Action Required: Wrong Tax Year — ${fileName}`,
        body: `Hi ${firstName},\n\nThank you for submitting your documents. Our system detected an issue:\n\n• File uploaded: ${fileName}\n• Issue: This document is for tax year ${y}. We need your ${CURRENT_TAX_YEAR} document.\n\nPlease log back in using your secure link and re-upload the correct version at your earliest convenience.\n\nIf you have any questions, please reply to this email.\n\nThank you,\n${preparer}\n${firm}`,
      };
    }
    case 'duplicate':
      return {
        subject: `Heads Up: Duplicate Document Uploaded`,
        body: `Hi ${firstName},\n\nWe noticed you uploaded "${fileName}" twice. We've kept the most recent copy and removed the older one — no action needed on your end.\n\nIf you intended to upload a different document, please use your secure link to upload the correct file.\n\nThank you,\n${preparer}\n${firm}`,
      };
    case 'too-small':
    case 'page_count_warning':
      return {
        subject: `Please Re-Upload: Incomplete Document`,
        body: `Hi ${firstName},\n\nThe file "${fileName}" you uploaded appears to be incomplete or may be missing pages.\n\nPlease re-upload the complete PDF version using your secure link.\n\nThank you,\n${preparer}\n${firm}`,
      };
    default:
      return {
        subject: `Document Issue: ${fileName}`,
        body: `Hi ${firstName},\n\nWe detected an issue with "${fileName}" that requires your attention. Please log back in and review.\n\nThank you,\n${preparer}\n${firm}`,
      };
  }
}
