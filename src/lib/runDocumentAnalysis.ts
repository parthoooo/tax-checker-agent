import {
  fetchDocumentRequirements,
  fetchDocumentUploads,
  fetchPriorYearUploads,
  createAiFlag,
  createEmailDraft,
  logActivity,
} from '@/lib/db';
import {
  compareDocuments,
  comparisonToEmailLabels,
  type ComparisonResult,
} from '@/lib/documentComparison';
import { generateEmailDraft } from '@/lib/aiSimulation';
import { CURRENT_TAX_YEAR, PRIOR_TAX_YEAR } from '@/lib/taxConfig';

export async function runDocumentAnalysis(
  clientId: string,
  clientName: string,
  clientEmail: string,
  preparerName = 'Your Tax Preparer',
): Promise<ComparisonResult> {
  const [currentReqs, currentUploads, priorUploads, priorReqs] = await Promise.all([
    fetchDocumentRequirements(clientId, CURRENT_TAX_YEAR),
    fetchDocumentUploads(clientId, CURRENT_TAX_YEAR),
    fetchPriorYearUploads(clientId),
    fetchDocumentRequirements(clientId, PRIOR_TAX_YEAR),
  ]);

  const result = compareDocuments(currentReqs, currentUploads, priorUploads, priorReqs);

  // Persist missing-doc flags (clear old unresolved missing flags first would be ideal; append for demo)
  for (const m of result.missing) {
    await createAiFlag({
      client_id: clientId,
      upload_id: null,
      flag_type: 'missing',
      severity: m.hadIn2024 ? 'HIGH' : 'MEDIUM',
      description: `Missing ${CURRENT_TAX_YEAR} ${m.name}${m.hadIn2024 ? ` (client had this in ${PRIOR_TAX_YEAR})` : ''}.`,
      detected_by: 'Missing Doc Tracker Agent',
    });
  }

  const emailLabels = comparisonToEmailLabels(result);
  if (emailLabels.length > 0) {
    const body = await generateEmailDraft(clientName, emailLabels, preparerName);
    await createEmailDraft({
      client_id: clientId,
      to_email: clientEmail,
      from_label: preparerName,
      subject: `Action Required: ${CURRENT_TAX_YEAR} Tax Documents`,
      body,
      status: 'pending',
      type: 'outbox',
    });

    await logActivity({
      client_id: clientId,
      actor: 'Missing Doc Tracker Agent',
      actor_type: 'ai',
      action: `Drafted follow-up email for ${emailLabels.length} issue(s)`,
    });
  }

  return result;
}
