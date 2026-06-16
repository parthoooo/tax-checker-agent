import {
  fetchDocumentRequirements,
  fetchDocumentUploads,
  fetchPriorYearUploads,
} from '@/lib/db';
import {
  compareDocuments,
  type ComparisonResult,
} from '@/lib/documentComparison';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR } from '@/lib/taxConfig';

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
