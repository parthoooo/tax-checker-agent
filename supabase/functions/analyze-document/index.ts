import { CURRENT_TAX_YEAR } from "../_shared/taxConstants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeInput {
  fileName: string;
  mimeType?: string;
  requirementDocType: string;
  clientId: string;
  existingFilenames: string[];
  expectedTaxYear?: string;
}

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

function analyzeMock(input: AnalyzeInput) {
  const fn = input.fileName.toLowerCase();
  const detectedLabel = detectDocType(input.fileName);
  const detectedSlug = normalizeDocTypeSlug(detectedLabel);
  const expectedSlug = normalizeDocTypeSlug(input.requirementDocType);
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  const yearMatch = fn.match(/20\d{2}/);
  const taxYear = yearMatch?.[0] ?? expectedTaxYear;

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

  if (/(bank|statement)/.test(fn)) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear,
      confidence: 95,
      issues: [{ type: "unexpected", message: "Bank statement not required." }],
      aiStatus: "unexpected",
      aiMessage: "Bank statements are not required for your tax filing.",
    };
  }

  if (yearMatch && yearMatch[0] !== expectedTaxYear) {
    return {
      docType: detectedLabel,
      docTypeSlug: detectedSlug,
      taxYear: yearMatch[0],
      confidence: 97,
      issues: [{ type: "wrong-year", message: `Year ${yearMatch[0]} detected.` }],
      aiStatus: "wrong_year",
      aiMessage: `Tax year ${yearMatch[0]} detected; ${expectedTaxYear} is required.`,
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

  return {
    docType: detectedLabel,
    docTypeSlug: detectedSlug,
    taxYear: expectedTaxYear,
    confidence: 96,
    issues: [],
    aiStatus: "verified",
    aiMessage: "Document verified and stored.",
  };
}

async function analyzeWithLlm(input: AnalyzeInput): Promise<ReturnType<typeof analyzeMock> | null> {
  // Lovable built-in document AI is not available in this project; hook reserved for future use.
  void input;
  return null;
}

async function analyzeWithAnthropic(input: AnalyzeInput): Promise<ReturnType<typeof analyzeMock> | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  // Phase 1b: filename-only prompt until PDF OCR is wired
  const expectedTaxYear = input.expectedTaxYear ?? CURRENT_TAX_YEAR;
  const prompt = `Analyze tax document filename "${input.fileName}" for requirement type "${input.requirementDocType}" and tax year ${expectedTaxYear}. Return JSON: { docType, taxYear, aiStatus, aiMessage }`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return {
      docType: parsed.docType ?? detectDocType(input.fileName),
      docTypeSlug: normalizeDocTypeSlug(parsed.docType ?? input.fileName),
      taxYear: parsed.taxYear ?? CURRENT_TAX_YEAR,
      confidence: 92,
      issues: [],
      aiStatus: parsed.aiStatus ?? "verified",
      aiMessage: parsed.aiMessage ?? "Document analyzed.",
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input: AnalyzeInput = await req.json();

    const llmResult =
      (await analyzeWithLlm(input)) ??
      (await analyzeWithAnthropic(input)) ??
      analyzeMock(input);

    return new Response(JSON.stringify(llmResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
