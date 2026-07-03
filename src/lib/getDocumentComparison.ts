import { supabase } from '@/lib/supabase';
import {
  fetchDocumentRequirements,
  fetchDocumentUploads,
  fetchPriorYearUploads,
  updateUploadAiStatus,
} from '@/lib/db';
import {
  compareDocuments,
  normalizeComparisonResult,
  resolveUploadReviewStatus,
  type ComparisonResult,
} from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR } from '@/lib/taxConfig';

export type AiReviewResult = ComparisonResult & { engine?: 'gemini' | 'mock' };

/** Read-only YoY comparison — no flags or email drafts (for admin review UI). */
export async function getDocumentComparison(clientId: string): Promise<ComparisonResult> {
  const [currentReqs, currentUploads, priorUploads, priorReqs] = await Promise.all([
    fetchDocumentRequirements(clientId, CURRENT_TAX_YEAR),
    fetchDocumentUploads(clientId, CURRENT_TAX_YEAR),
    fetchPriorYearUploads(clientId),
    fetchDocumentRequirements(clientId, PRIOR_TAX_YEAR),
  ]);

  return compareDocuments(currentReqs, currentUploads, priorUploads, priorReqs);
}

async function persistComparisonAiStatuses(
  currentReqs: Awaited<ReturnType<typeof fetchDocumentRequirements>>,
  currentUploads: Awaited<ReturnType<typeof fetchDocumentUploads>>,
  result: ComparisonResult,
): Promise<void> {
  for (const req of currentReqs.filter(r => r.required && r.tax_year === CURRENT_TAX_YEAR)) {
    const upload = currentUploads.find(u => u.requirement_id === req.id);
    if (!upload) continue;

    const nextStatus = resolveUploadReviewStatus(req, upload, result);
    if (upload.ai_status !== nextStatus) {
      await updateUploadAiStatus(upload.id, nextStatus);
    }
  }
}

/** Admin Run AI Review: Gemini PDF analysis + YoY compare (edge fn), with local fallback. */
export async function runAdminAiReview(clientId: string): Promise<AiReviewResult> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-client-documents', {
      body: { clientId, taxYear: CURRENT_TAX_YEAR },
    });

    if (!error && data && Array.isArray(data.verified)) {
      return { ...normalizeComparisonResult(data), engine: data.engine as 'gemini' | 'mock' | undefined };
    }
  } catch {
    // fallback below
  }

  const [currentReqs, currentUploads, priorUploads, priorReqs] = await Promise.all([
    fetchDocumentRequirements(clientId, CURRENT_TAX_YEAR),
    fetchDocumentUploads(clientId, CURRENT_TAX_YEAR),
    fetchPriorYearUploads(clientId),
    fetchDocumentRequirements(clientId, PRIOR_TAX_YEAR),
  ]);

  const result = compareDocuments(currentReqs, currentUploads, priorUploads, priorReqs);
  await persistComparisonAiStatuses(currentReqs, currentUploads, result);
  return { ...result, engine: 'mock' };
}
