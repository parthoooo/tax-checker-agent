import manifestData from "./demoTaxDocumentManifest.json" with { type: "json" };

export interface DemoTaxDocumentEntry {
  fileName: string;
  relativePath: string;
  profession: "employee" | "freelancer" | "partnership";
  taxYear: string;
  docType: string;
  payerOrEmployer: string;
  primaryAmount: number;
  primaryField: string;
}

const { manifest: DEMO_TAX_DOCUMENT_MANIFEST } = manifestData as {
  manifest: DemoTaxDocumentEntry[];
};

export function lookupDemoDocument(fileName: string): DemoTaxDocumentEntry | undefined {
  return DEMO_TAX_DOCUMENT_MANIFEST.find(
    (d) => d.fileName.toLowerCase() === fileName.toLowerCase(),
  );
}

export function extractPdfTextFromBase64(base64: string): string {
  try {
    const binary = atob(base64);
    const matches = [...binary.matchAll(/\(([^)]*)\)\s*Tj/g)];
    return matches
      .map((m) => m[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")"))
      .join("\n");
  } catch {
    return "";
  }
}

export function extractDollarAmounts(text: string): number[] {
  return [...text.matchAll(/\$([\d,]+)/g)].map((m) => parseInt(m[1].replace(/,/g, ""), 10));
}

function pctChange(prior: number, current: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - prior) / prior) * 100);
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}

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

  const currentAmount = currentMeta?.docType === docType
    ? currentMeta.primaryAmount
    : extractDollarAmounts(currentText)[0] ?? null;

  const priorAmount = priorMeta?.docType === docType
    ? priorMeta.primaryAmount
    : priorText ? extractDollarAmounts(priorText)[0] ?? null : null;

  if (currentMeta && priorMeta && currentMeta.payerOrEmployer !== priorMeta.payerOrEmployer) {
    notes.push(
      `${docType} payer changed: ${priorMeta.payerOrEmployer} (${priorMeta.taxYear}) → ${currentMeta.payerOrEmployer} (${currentMeta.taxYear}).`,
    );
  }

  if (currentAmount != null && priorAmount != null) {
    const change = pctChange(priorAmount, currentAmount);
    const label = currentMeta?.primaryField?.replace(/_/g, " ") ?? "primary amount";
    if (Math.abs(change) >= 25) {
      notes.push(
        `${docType} ${label} ${change > 0 ? "increased" : "decreased"} ${Math.abs(change)}% YoY ($${formatMoney(priorAmount)} → $${formatMoney(currentAmount)}).`,
      );
    } else if (change !== 0) {
      notes.push(
        `${docType} ${label} changed modestly YoY ($${formatMoney(priorAmount)} → $${formatMoney(currentAmount)}).`,
      );
    }
  }

  return notes;
}

export function detectTaxYearFromPdfText(text: string): string | null {
  const explicit = text.match(/Tax Year:\s*(20\d{2})/i);
  if (explicit) return explicit[1];
  const calendar = text.match(/Calendar year\s*(20\d{2})/i);
  if (calendar) return calendar[1];
  const formHeader = text.match(/-\s*(20\d{2})/);
  return formHeader ? formHeader[1] : null;
}

export function isUnexpectedNonTaxDocument(fileName: string, pdfText = ""): boolean {
  const combined = `${fileName} ${pdfText}`.toLowerCase();
  return /(bank|statement|receipt|paystub|pay-stub|not a tax form)/.test(combined);
}
