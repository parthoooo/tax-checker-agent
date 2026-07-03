import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';
import type { ComparisonResult } from './documentComparison';
import { comparisonToEmailLabels, normalizeComparisonResult } from './documentComparison';
import { createEmailDraft, logActivity } from './db';
import { generateEmailDraft } from './aiSimulation';
import { CURRENT_TAX_YEAR } from './taxConfig';

const supabase: any = typedSupabase;

export type ClientCorrection = Database['public']['Tables']['client_corrections']['Row'];

export async function fetchActiveClientCorrection(
  clientId: string,
): Promise<(ClientCorrection & { comparison: ComparisonResult }) | null> {
  const { data, error } = await supabase
    .from('client_corrections')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if ((error.message ?? '').toLowerCase().includes('client_corrections')) return null;
    throw error;
  }
  if (!data) return null;

  return {
    ...data,
    comparison: normalizeComparisonResult(
      data.comparison_snapshot as Partial<ComparisonResult> & Record<string, unknown>,
    ),
  };
}

export async function sendClientCorrection(
  clientId: string,
  params: {
    clientName: string;
    clientEmail: string;
    comparison: ComparisonResult;
    staffMessage: string;
    sentByName: string;
    preparerName?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from('client_corrections')
    .update({ status: 'resolved', resolved_at: now })
    .eq('client_id', clientId)
    .eq('status', 'sent');

  const comparison = normalizeComparisonResult(
    params.comparison as Partial<ComparisonResult> & Record<string, unknown>,
  );

  const { error: insertErr } = await supabase
    .from('client_corrections')
    .insert({
      client_id: clientId,
      tax_year: CURRENT_TAX_YEAR,
      comparison_snapshot: comparison,
      staff_message: params.staffMessage || null,
      status: 'sent',
      sent_by: params.sentByName,
    });
  if (insertErr) throw insertErr;

  const labels = comparisonToEmailLabels(comparison);
  const preparer = params.preparerName ?? 'Your Tax Preparer';
  let body: string;

  if (labels.length > 0) {
    body = await generateEmailDraft(params.clientName, labels, preparer);
  } else {
    body = `Hi ${params.clientName.split(' ')[0]},\n\nYour preparer reviewed your documents. Please check your portal for details.\n\n— ${preparer}`;
  }

  if (params.staffMessage.trim()) {
    body = `${body}\n\n---\nNote from your preparer:\n${params.staffMessage.trim()}`;
  }

  const issueCount =
    comparison.missing.length +
    comparison.wrongYear.length +
    comparison.wrongType.length +
    comparison.unexpected.length;

  await createEmailDraft({
    client_id: clientId,
    to_email: params.clientEmail,
    from_label: preparer,
    subject: issueCount > 0
      ? `Action Required: ${CURRENT_TAX_YEAR} Tax Documents`
      : `${CURRENT_TAX_YEAR} documents look good — next steps`,
    body,
    status: 'pending',
    type: 'outbox',
  });

  await logActivity({
    client_id: clientId,
    actor: params.sentByName,
    actor_type: 'staff',
    action: issueCount > 0
      ? `Sent document correction checklist (${issueCount} issue${issueCount === 1 ? '' : 's'}) to client`
      : 'Sent document review confirmation to client',
  });
}

export async function resolveClientCorrection(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('client_corrections')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('status', 'sent');
  if (error) throw error;
}
