import { CURRENT_TAX_YEAR } from "./taxConstants.ts";
import type { AnalyzeTaxDocumentInput, TaxAnalysisResult } from "./geminiTaxAnalyze.ts";
import {
  compareYoYDocuments,
  detectTaxYearFromPdfText,
  extractPdfTextFromBase64,
  isUnexpectedNonTaxDocument,
} from "./yoyDocumentCompare.ts";

function detectDocType(filename: string): string {
  const fn = filename.toLowerCase();
  if (fn.includes("w2") || fn.includes("w-2")) return "W-2";
  if (fn.includes("1099-nec") || fn.includes("1099nec")) return "1099-NEC";
  if (fn.includes("1099-int") || fn.includes("1099int")) return "1099-INT";
  if (fn.includes("1099-div") || fn.includes("1099div")) return "1099-DIV";
  if (fn.includes("1099-b") || fn.includes("1099b")) return "1099-B";
  if (fn.includes("1099")) return "1099";
  if (fn.includes("1098")) return "1098 Mortgage Interest";
  if (fn.includes("k1") || fn.includes("k-1")) return "K-1";
  if (fn.includes("schedule") || fn.includes("schc") || fn.includes("sched")) return "Schedule C";
  return "tax document";
}

function normalizeDocTypeSlug(input: string): string {
  const fn = input.toLowerCase();
  if (fn.includes("w2") || fn === "w-2") return "w2";
  if (fn.includes("1099-nec") || fn.includes("1099nec")) return "1099-nec";
  if (fn.includes("1099-int") || fn.includes("1099int")) return "1099-int";
  if (fn.includes("1099-div") || fn.includes("1099div")) return "1099-div";
  if (fn.includes("1099-b") || fn.includes("1099b")) return "1099-b";
  if (fn.includes("1098")) return "1098";
  if (fn.includes("k1") || fn.includes("k-1")) return "k1";
  if (fn.includes("schedule") || fn.includes("schc") || fn.includes("sched")) return "sched-c";
  return fn;
}

export function analyzeMock(input: AnalyzeTaxDocumentInput): TaxAnalysisResult {
  const fn = input.fileName.toLowerCase();
  const detectedLabel = detectDocType(input.fileName);
  const detectedSlug = normalizeDocTypeSlug(detectedLabel);
  const expectedSlug = normalizeDocTypeSlug(input.requirementDocType);
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  const yearMatch = fn.match(/20\d{2}/);

  const currentText = input.fileBase64 ? extractPdfTextFromBase64(input.fileBase64) : "";
  const priorText = input.priorFileBase64 ? extractPdfTextFromBase64(input.priorFileBase64) : "";
  const yearFromPdf = currentText ? detectTaxYearFromPdfText(currentText) : null;
  const taxYear = yearMatch?.[0] ?? yearFromPdf ?? expectedTaxYear;

  if (input.existingFilenames.some((n) => n.toLowerCase() === fn)) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 98,
      issues: [{ type: "duplicate", message: "Duplicate file name." }],
      aiStatus: "duplicate",
      aiMessage: "A file with this name was already uploaded.",
    };
  }

  if (isUnexpectedNonTaxDocument(input.fileName, currentText)) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 95,
      issues: [{ type: "unexpected", message: "Not a required tax document." }],
      aiStatus: "unexpected",
      aiMessage: "This document is not a required tax form for your checklist.",
    };
  }

  const effectiveYear = yearMatch?.[0] ?? yearFromPdf;
  if (effectiveYear && effectiveYear !== expectedTaxYear) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear: effectiveYear,
      confidence: 97,
      issues: [{ type: "wrong-year", message: `Year ${effectiveYear} detected.` }],
      aiStatus: "wrong_year",
      aiMessage: `Tax year ${effectiveYear} detected; ${expectedTaxYear} is required.`,
    };
  }

  if (detectedSlug !== expectedSlug && detectedSlug !== "tax document" && !fn.includes(expectedSlug.replace("-", ""))) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear: expectedTaxYear,
      confidence: 94,
      issues: [{ type: "wrong-type", message: `Expected ${expectedSlug}, got ${detectedSlug}.` }],
      aiStatus: "unexpected",
      aiMessage: `This file looks like a ${detectedLabel}, not the required document type.`,
    };
  }

  const yoyNotes = input.priorFileBase64 || input.priorFileName
    ? compareYoYDocuments(
      expectedSlug,
      input.fileName,
      currentText,
      input.priorFileName,
      priorText,
    )
    : [];

  return {
    docType: detectedLabel,
    docTypeSlug: detectedSlug,
    taxYear: expectedTaxYear,
    confidence: 96,
    issues: [],
    aiStatus: "verified",
    aiMessage: yoyNotes.length
      ? "Document verified. Year-over-year differences noted for staff review."
      : "Document verified and stored.",
    yoyNotes: yoyNotes.length ? yoyNotes : undefined,
  };
}
