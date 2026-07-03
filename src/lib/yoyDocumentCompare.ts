import { lookupDemoDocument } from './demoTaxDocumentManifest';
import { docTypeLabel } from './taxConfig';

/** Extract visible text from our minimal demo PDFs (PostScript Tj operators). */
export function extractPdfTextFromBase64(base64: string): string {
  try {
    const binary = atob(base64);
    const matches = [...binary.matchAll(/\(([^)]*)\)\s*Tj/g)];
    return matches
      .map((m) => m[1].replace(/\\\(/g, '(').replace(/\\\)/g, ')'))
      .join('\n');
  } catch {
    return '';
  }
}

/** Pull dollar amounts from PDF text lines. */
export function extractDollarAmounts(text: string): number[] {
  return [...text.matchAll(/\$([\d,]+)/g)].map((m) => parseInt(m[1].replace(/,/g, ''), 10));
}

function pctChange(prior: number, current: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prior) / prior) * 100);
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Compare current vs prior-year demo documents.
 * Uses manifest metadata when filenames match; falls back to PDF text amounts.
 */
export function compareYoYDocuments(
  docType: string,
  currentFileName: string,
  currentText: string,
  priorFileName?: string,
  priorText?: string,
): string[] {
  const notes: string[] = [];
  const currentMeta = lookupDemoDocument(currentFileName);
  const priorMeta = priorFileName ? lookupDemoDocument(priorFileName) : undefined;

  const currentAmount =
    currentMeta?.docType === docType ? currentMeta.primaryAmount
    : extractDollarAmounts(currentText)[0] ?? null;

  const priorAmount =
    priorMeta?.docType === docType ? priorMeta.primaryAmount
    : priorText ? extractDollarAmounts(priorText)[0] ?? null : null;

  if (currentMeta && priorMeta && currentMeta.payerOrEmployer !== priorMeta.payerOrEmployer) {
    notes.push(
      `${docTypeLabel(docType)} payer changed: ${priorMeta.payerOrEmployer} (${priorMeta.taxYear}) → ${currentMeta.payerOrEmployer} (${currentMeta.taxYear}).`,
    );
  }

  if (currentAmount != null && priorAmount != null) {
    const change = pctChange(priorAmount, currentAmount);
    const label = currentMeta?.primaryField?.replace(/_/g, ' ') ?? 'primary amount';
    if (Math.abs(change) >= 25) {
      notes.push(
        `${docTypeLabel(docType)} ${label} ${change > 0 ? 'increased' : 'decreased'} ${Math.abs(change)}% YoY ($${formatMoney(priorAmount)} → $${formatMoney(currentAmount)}).`,
      );
    } else if (change !== 0) {
      notes.push(
        `${docTypeLabel(docType)} ${label} changed modestly YoY ($${formatMoney(priorAmount)} → $${formatMoney(currentAmount)}, ${change > 0 ? '+' : ''}${change}%).`,
      );
    }
  }

  if (priorMeta && !currentMeta && currentAmount == null) {
    notes.push(
      `Could not verify ${docTypeLabel(docType)} amounts in ${currentFileName}; prior year had $${formatMoney(priorMeta.primaryAmount)}.`,
    );
  }

  return notes;
}

/** Detect tax year from PDF body text when filename omits it. */
export function detectTaxYearFromPdfText(text: string): string | null {
  const explicit = text.match(/Tax Year:\s*(20\d{2})/i);
  if (explicit) return explicit[1];
  const calendar = text.match(/Calendar year\s*(20\d{2})/i);
  if (calendar) return calendar[1];
  const formHeader = text.match(/-\s*(20\d{2})/);
  return formHeader ? formHeader[1] : null;
}

/** Non-tax uploads: bank statements, receipts, pay stubs. */
export function isUnexpectedNonTaxDocument(fileName: string, pdfText = ''): boolean {
  const combined = `${fileName} ${pdfText}`.toLowerCase();
  return /(bank|statement|receipt|paystub|pay-stub|not a tax form)/.test(combined);
}
