import { CURRENT_TAX_YEAR } from "./taxConstants.ts";

export interface TaxAnalysisIssue {
  type: "wrong-year" | "wrong-type" | "duplicate" | "unexpected";
  message: string;
}

export interface TaxAnalysisResult {
  docType: string;
  docTypeSlug: string;
  taxYear: string;
  confidence: number;
  issues: TaxAnalysisIssue[];
  aiStatus: "verified" | "wrong_year" | "duplicate" | "unexpected";
  aiMessage: string;
  extractedFields?: Record<string, string | number | null>;
  yoyNotes?: string[];
}

export interface AnalyzeTaxDocumentInput {
  fileName: string;
  mimeType?: string;
  requirementDocType: string;
  expectedTaxYear?: string;
  existingFilenames: string[];
  fileBase64?: string;
  priorFileBase64?: string;
  priorFileName?: string;
}

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"] as const;

function parseJsonResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence ? fence[1] : trimmed).trim();
  return JSON.parse(body);
}

function normalizeSlug(input: string): string {
  const fn = input.toLowerCase();
  if (fn.includes("w2") || fn === "w-2") return "w2";
  if (fn.includes("1099-nec") || fn.includes("1099nec")) return "1099-nec";
  if (fn.includes("1099-int") || fn.includes("1099int")) return "1099-int";
  if (fn.includes("1099-div") || fn.includes("1099div")) return "1099-div";
  if (fn.includes("1099-b") || fn.includes("1099b")) return "1099-b";
  if (fn.includes("1098")) return "1098";
  if (fn.includes("k1") || fn.includes("k-1")) return "k1";
  if (fn.includes("schedule") || fn.includes("schc") || fn.includes("sched")) return "sched-c";
  return fn.replace(/\s+/g, "-");
}

function buildPrompt(input: AnalyzeTaxDocumentInput): string {
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  const hasPdf = Boolean(input.fileBase64);
  const hasPrior = Boolean(input.priorFileBase64);

  return `You are a US tax document classifier for a CPA firm demo app.

Expected checklist slot: ${input.requirementDocType} (${expectedTaxYear} tax year).
Uploaded filename: "${input.fileName}".
Existing filenames already on file: ${JSON.stringify(input.existingFilenames)}.

${hasPdf ? "Analyze the attached document bytes (PDF or image)." : "No file bytes provided — infer cautiously from filename only."}
${hasPrior ? `A prior-year reference document "${input.priorFileName ?? "prior"}" is attached for year-over-year comparison.` : ""}

Return ONLY valid JSON (no markdown) with this exact shape:
{
  "docType": "human label e.g. W-2",
  "docTypeSlug": "w2|1099-nec|1098|1099-int|1099-div|1099-b|k1|sched-c|other",
  "taxYear": "YYYY",
  "confidence": 0-100,
  "issues": [{ "type": "wrong-year|wrong-type|duplicate|unexpected", "message": "..." }],
  "aiStatus": "verified|wrong_year|duplicate|unexpected",
  "aiMessage": "one sentence for staff/client",
  "extractedFields": { "employerOrPayer": "...", "recipient": "...", "amounts": "..." },
  "yoyNotes": ["optional YoY mismatch notes when prior doc attached"]
}

Rules:
- Flag wrong-year if form tax year != ${expectedTaxYear}.
- Flag wrong-type if document is not the expected slot type.
- Flag duplicate if filename matches an existing upload (case-insensitive).
- Flag unexpected for bank statements, receipts, pay stubs, or non-tax docs.
- If content is unreadable, set confidence < 60 and aiStatus unexpected with clear message.
- Be strict on tax forms: W-2, 1099 variants, 1098, K-1, Schedule C.`;
}

function normalizeResult(raw: Record<string, unknown>, input: AnalyzeTaxDocumentInput): TaxAnalysisResult {
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  const docType = String(raw.docType ?? "tax document");
  const docTypeSlug = normalizeSlug(String(raw.docTypeSlug ?? docType));
  const taxYear = String(raw.taxYear ?? expectedTaxYear);
  const issues = Array.isArray(raw.issues)
    ? raw.issues.map((i: Record<string, unknown>) => ({
      type: (String(i.type ?? "unexpected") as TaxAnalysisIssue["type"]),
      message: String(i.message ?? ""),
    }))
    : [];

  let aiStatus = String(raw.aiStatus ?? "verified") as TaxAnalysisResult["aiStatus"];
  if (!["verified", "wrong_year", "duplicate", "unexpected"].includes(aiStatus)) {
    aiStatus = issues.length ? "unexpected" : "verified";
  }

  return {
    docType,
    docTypeSlug,
    taxYear,
    confidence: Number(raw.confidence ?? 85),
    issues,
    aiStatus,
    aiMessage: String(raw.aiMessage ?? "Document analyzed."),
    extractedFields: typeof raw.extractedFields === "object" && raw.extractedFields
      ? raw.extractedFields as Record<string, string | number | null>
      : undefined,
    yoyNotes: Array.isArray(raw.yoyNotes) ? raw.yoyNotes.map(String) : undefined,
  };
}

async function callGemini(
  apiKey: string,
  prompt: string,
  parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>,
): Promise<string | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      // try next model
    }
  }
  return null;
}

export async function analyzeWithGemini(input: AnalyzeTaxDocumentInput): Promise<TaxAnalysisResult | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const prompt = buildPrompt(input);
  const parts: Array<{ inline_data: { mime_type: string; data: string } }> = [];

  if (input.fileBase64) {
    parts.push({
      inline_data: {
        mime_type: input.mimeType?.startsWith("image/") ? input.mimeType : "application/pdf",
        data: input.fileBase64,
      },
    });
  }
  if (input.priorFileBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: input.priorFileBase64,
      },
    });
  }

  const text = await callGemini(apiKey, prompt, parts);
  if (!text) return null;

  try {
    return normalizeResult(parseJsonResponse(text), input);
  } catch {
    return null;
  }
}
