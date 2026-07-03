import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { analyzeMock } from "../_shared/analyzeMock.ts";
import { analyzeWithGemini } from "../_shared/geminiTaxAnalyze.ts";
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR } from "../_shared/taxConstants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComparisonResult {
  missing: { docType: string; name: string; hadInPriorYear: boolean }[];
  wrongYear: { fileName: string; detectedYear: string; requirementName: string }[];
  wrongType: { fileName: string; expected: string; detected: string }[];
  unexpected: { fileName: string; reason: string }[];
  verified: { docType: string; fileName: string; name: string }[];
  yoyNotes?: { docType: string; fileName: string; note: string }[];
  engine: "gemini" | "mock";
}

function mapAiStatusToDb(status: string): "verified" | "flagged" | "rejected" {
  if (status === "verified") return "verified";
  if (status === "unexpected") return "rejected";
  return "flagged";
}

function mapIssueToFlagType(issueType: string): "wrong-year" | "duplicate" | "unexpected" | "missing" {
  if (issueType === "wrong-year") return "wrong-year";
  if (issueType === "duplicate") return "duplicate";
  if (issueType === "wrong-type") return "unexpected";
  return "unexpected";
}

async function downloadBase64(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const { data, error } = await admin.storage.from("documents").download(storagePath);
  if (error || !data) return null;
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const mimeType = storagePath.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : storagePath.toLowerCase().match(/\.(jpe?g|png)$/)
    ? "image/jpeg"
    : "application/octet-stream";
  return { base64: btoa(binary), mimeType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clientId, taxYear = CURRENT_TAX_YEAR } = await req.json() as {
      clientId: string;
      taxYear?: string;
    };

    if (!clientId) {
      return new Response(JSON.stringify({ error: "clientId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const [reqsRes, uploadsRes, priorUploadsRes, priorReqsRes] = await Promise.all([
      admin.from("document_requirements").select("*").eq("client_id", clientId).eq("tax_year", taxYear),
      admin.from("document_uploads").select("*").eq("client_id", clientId).eq("tax_year", taxYear),
      admin.from("document_uploads").select("*").eq("client_id", clientId).eq("tax_year", PRIOR_TAX_YEAR),
      admin.from("document_requirements").select("*").eq("client_id", clientId).eq("tax_year", PRIOR_TAX_YEAR),
    ]);

    const currentReqs = reqsRes.data ?? [];
    const currentUploads = uploadsRes.data ?? [];
    const priorUploads = priorUploadsRes.data ?? [];
    const priorReqs = priorReqsRes.data ?? [];

    const result: ComparisonResult = {
      missing: [],
      wrongYear: [],
      wrongType: [],
      unexpected: [],
      verified: [],
      yoyNotes: [],
      engine: Deno.env.get("GEMINI_API_KEY") ? "gemini" : "mock",
    };

    const existingNames = currentUploads.map((u: { file_name: string }) => u.file_name);
    const priorByDocType = new Map<string, { storage_path: string; file_name: string }>();

    for (const u of priorUploads) {
      const req = priorReqs.find((r: { id: string }) => r.id === u.requirement_id);
      const docType = req?.doc_type ?? u.file_name;
      if (u.ai_status === "verified" || u.is_prior_year) {
        priorByDocType.set(docType, { storage_path: u.storage_path, file_name: u.file_name });
      }
    }

    const verifiedTypes = new Set<string>();

    for (const req of currentReqs.filter((r: { required: boolean }) => r.required)) {
      const upload = currentUploads.find((u: { requirement_id: string }) => u.requirement_id === req.id);

      if (!upload) {
        if (priorByDocType.has(req.doc_type)) {
          result.missing.push({ docType: req.doc_type, name: req.name, hadInPriorYear: true });
          await admin.from("ai_flags").insert({
            client_id: clientId,
            upload_id: null,
            flag_type: "missing",
            severity: "HIGH",
            description: `Missing ${taxYear} ${req.name} (client had this in ${PRIOR_TAX_YEAR}).`,
            detected_by: "Missing Doc Tracker Agent",
          });
        }
        continue;
      }

      const others = existingNames.filter((n: string) => n !== upload.file_name);
      let priorBase64: string | undefined;
      let priorFileName: string | undefined;
      const prior = priorByDocType.get(req.doc_type);
      if (prior?.storage_path) {
        const priorFile = await downloadBase64(admin, prior.storage_path);
        if (priorFile) {
          priorBase64 = priorFile.base64;
          priorFileName = prior.file_name;
        }
      }

      const fileData = await downloadBase64(admin, upload.storage_path);
      const analysisInput = {
        fileName: upload.file_name,
        mimeType: upload.mime_type ?? fileData?.mimeType,
        requirementDocType: req.doc_type,
        expectedTaxYear: taxYear,
        existingFilenames: others,
        fileBase64: fileData?.base64,
        priorFileBase64: priorBase64,
        priorFileName,
      };

      const analysis = (await analyzeWithGemini(analysisInput)) ?? analyzeMock(analysisInput);
      const dbStatus = mapAiStatusToDb(analysis.aiStatus);

      await admin.from("document_uploads").update({ ai_status: dbStatus }).eq("id", upload.id);

      for (const issue of analysis.issues) {
        await admin.from("ai_flags").insert({
          client_id: clientId,
          upload_id: upload.id,
          flag_type: mapIssueToFlagType(issue.type),
          severity: issue.type === "wrong-year" ? "HIGH" : "MEDIUM",
          description: issue.message,
          detected_by: "Doc Classifier Agent",
        });
      }

      for (const note of analysis.yoyNotes ?? []) {
        result.yoyNotes!.push({ docType: req.doc_type, fileName: upload.file_name, note });
        await admin.from("ai_flags").insert({
          client_id: clientId,
          upload_id: upload.id,
          flag_type: "unexpected",
          severity: "MEDIUM",
          description: `YoY: ${note}`,
          detected_by: "Doc Classifier Agent",
        });
      }

      if (dbStatus === "verified") {
        verifiedTypes.add(req.doc_type);
        result.verified.push({ docType: req.doc_type, fileName: upload.file_name, name: req.name });
      } else if (analysis.aiStatus === "wrong_year") {
        result.wrongYear.push({
          fileName: upload.file_name,
          detectedYear: analysis.taxYear,
          requirementName: req.name,
        });
      } else if (analysis.issues.some((i) => i.type === "wrong-type")) {
        result.wrongType.push({
          fileName: upload.file_name,
          expected: req.name,
          detected: analysis.docType,
        });
      } else {
        result.unexpected.push({
          fileName: upload.file_name,
          reason: analysis.aiMessage,
        });
      }
    }

    for (const [docType, prior] of priorByDocType.entries()) {
      const hasReq = currentReqs.some((r: { doc_type: string; required: boolean }) =>
        r.doc_type === docType && r.required
      );
      const hasUploadForType = currentReqs
        .filter((r: { doc_type: string; required: boolean }) => r.doc_type === docType && r.required)
        .some((r: { id: string }) =>
          currentUploads.some((u: { requirement_id: string }) => u.requirement_id === r.id)
        );
      const hasOpenIssue =
        result.wrongYear.some((w) => {
          const req = currentReqs.find((r: { name: string }) => r.name === w.requirementName);
          return req?.doc_type === docType;
        }) ||
        result.wrongType.some((w) => {
          const upload = currentUploads.find((u: { file_name: string }) => u.file_name === w.fileName);
          const req = currentReqs.find((r: { id: string }) => r.id === upload?.requirement_id);
          return req?.doc_type === docType;
        }) ||
        result.unexpected.some((u) => {
          const upload = currentUploads.find((up: { file_name: string }) => up.file_name === u.fileName);
          const req = currentReqs.find((r: { id: string }) => r.id === upload?.requirement_id);
          return req?.doc_type === docType;
        });

      if (
        hasReq &&
        !verifiedTypes.has(docType) &&
        !hasUploadForType &&
        !hasOpenIssue &&
        !result.missing.some((m) => m.docType === docType)
      ) {
        const req = currentReqs.find((r: { doc_type: string }) => r.doc_type === docType);
        result.missing.push({
          docType,
          name: req?.name ?? docType,
          hadInPriorYear: true,
        });
      }
      void prior;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
