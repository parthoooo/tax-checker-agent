import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { ComparisonResult } from '@/lib/documentComparison';
import { normalizeComparisonResult } from '@/lib/documentComparison';
import { getClientPortalRequirements } from '@/lib/clientPortalSettings';
import {
  computePortalYearLock,
  inferYearSubmittedFromClient,
  type PortalDocRow,
} from '@/lib/clientPortalDocumentState';
import { CURRENT_TAX_YEAR, type BusinessType } from '@/lib/taxConfig';
import { NOTIFY_EMAIL, emailSignature } from '@/lib/branding';

type Client = Database['public']['Tables']['clients']['Row'];
type DocReq = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];
type ClientCorrection = Database['public']['Tables']['client_corrections']['Row'];

export interface MagicLinkPayload {
  expired?: boolean;
  token_id: string;
  token_expires_at: string;
  tax_year?: string;
  client: Client;
  requirements: DocReq[];
  uploads: DocUpload[];
  prior_requirements?: DocReq[];
  prior_uploads?: DocUpload[];
  year_submitted?: boolean;
  year_locked?: boolean;
  year_lock_reason?: string | null;
  active_correction?: ClientCorrection | null;
}

export type MagicLinkActiveCorrection = ClientCorrection & { comparison: ComparisonResult };

export interface MagicLinkPortalSnapshot {
  client: Client;
  docs: PortalDocRow[];
  yearSubmitted: boolean;
  yearLocked: boolean;
  yearLockReason?: string;
  activeCorrection: MagicLinkActiveCorrection | null;
}

export async function resolveMagicLink(
  token: string,
  taxYear: string = CURRENT_TAX_YEAR,
): Promise<MagicLinkPayload | null | 'expired'> {
  let { data, error } = await (supabase as any).rpc('resolve_magic_link', {
    p_token: token,
    p_tax_year: taxYear,
  });

  if (error && taxYear === CURRENT_TAX_YEAR) {
    const legacy = await (supabase as any).rpc('resolve_magic_link', { p_token: token });
    data = legacy.data;
    error = legacy.error;
  }

  if (error || data == null) return null;
  if (data.expired === true) return 'expired';
  return data as MagicLinkPayload;
}

export function buildMagicLinkPortalSnapshot(
  result: MagicLinkPayload,
  taxYear: string,
): MagicLinkPortalSnapshot {
  const client = result.client;
  const businessType = (client.business_type ?? 'freelancer') as BusinessType;
  const reqs = getClientPortalRequirements(
    (result.requirements ?? []).filter(r => r.tax_year === taxYear),
    businessType,
  );
  const uploads = (result.uploads ?? []).filter(u => u.tax_year === taxYear);
  const uploadsByReqId = new Map(uploads.map(u => [u.requirement_id, u]));
  const docs = reqs.map(r => ({ ...r, upload: uploadsByReqId.get(r.id) }));

  const yearSubmitted = result.year_submitted
    ?? inferYearSubmittedFromClient(client, taxYear, docs);

  const yearLock = result.year_locked !== undefined
    ? { locked: Boolean(result.year_locked), reason: result.year_lock_reason ?? undefined }
    : computePortalYearLock(client, taxYear, yearSubmitted);

  let activeCorrection: MagicLinkActiveCorrection | null = null;
  if (result.active_correction) {
    activeCorrection = {
      ...result.active_correction,
      comparison: normalizeComparisonResult(
        result.active_correction.comparison_snapshot as Partial<ComparisonResult> & Record<string, unknown>,
      ),
    };
  }

  return {
    client,
    docs,
    yearSubmitted,
    yearLocked: yearLock.locked,
    yearLockReason: yearLock.reason,
    activeCorrection,
  };
}

export async function loadMagicLinkPortalSnapshot(
  token: string,
  taxYear: string,
): Promise<MagicLinkPortalSnapshot | null | 'expired'> {
  const result = await resolveMagicLink(token, taxYear);
  if (result === null || result === 'expired') return result;
  return buildMagicLinkPortalSnapshot(result, taxYear);
}

export async function getMagicLinkSignedUrl(
  token: string,
  storagePath: string,
  download = false,
): Promise<string | null> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !anonKey) return null;

  const params = new URLSearchParams({ token, path: storagePath });
  if (download) params.set('download', '1');

  try {
    const res = await fetch(`${baseUrl}/functions/v1/magic-link-download?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.signedUrl) {
      console.warn('magic-link-download failed', res.status, json);
      return null;
    }
    return String(json.signedUrl);
  } catch (err) {
    console.warn('magic-link-download request failed', err);
    return null;
  }
}

export async function submitMagicLinkForReview(
  token: string,
  params: {
    taxYear: string;
    uploadedCount: number;
    requiredCount: number;
    actorName: string;
    clientName: string;
    clientEmail: string;
    documentNames: string[];
  },
): Promise<void> {
  const { data, error } = await (supabase as any).rpc('magic_link_submit_for_review', {
    p_token: token,
    p_tax_year: params.taxYear,
    p_uploaded_count: params.uploadedCount,
    p_required_count: params.requiredCount,
    p_actor_name: params.actorName,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));

  const taxYear = params.taxYear;
  const docList = params.documentNames.map(n => `• ${n}`).join('\n');
  await magicLinkCreateEmailDraft(token, {
    clientId: data.client_id,
    toEmail: NOTIFY_EMAIL,
    fromLabel: params.clientName,
    subject: `${params.clientName} submitted ${taxYear} tax documents`,
    body: [
      'Hi team,',
      '',
      `${params.clientName} (${params.clientEmail}) submitted their ${taxYear} tax document package for review via magic link.`,
      '',
      'Uploaded documents (may include flagged items for your review):',
      docList,
      '',
      'Please review in the client portal.',
      '',
      emailSignature(),
    ].join('\n'),
  });
}

export async function submitDocumentsViaMagicLink(token: string): Promise<{
  ok?: boolean;
  error?: string;
  client_id?: string;
  client_name?: string;
  client_email?: string;
  uploaded?: number;
}> {
  const { data, error } = await (supabase as any).rpc('submit_documents_via_token', { p_token: token });
  if (error) throw error;
  return data ?? {};
}

export async function magicLinkUpsertUpload(
  token: string,
  params: {
    existingUploadId?: string | null;
    clientId: string;
    requirementId: string;
    fileName: string;
    storagePath: string;
    fileSize: number;
    mimeType: string | null;
    aiStatus: 'verified' | 'flagged' | 'pending' | 'rejected';
    taxYear?: string;
    isPriorYear?: boolean;
  },
): Promise<DocUpload> {
  const { data, error } = await (supabase as any).rpc('magic_link_upsert_upload', {
    p_token: token,
    p_existing_upload_id: params.existingUploadId ?? null,
    p_client_id: params.clientId,
    p_requirement_id: params.requirementId,
    p_file_name: params.fileName,
    p_storage_path: params.storagePath,
    p_file_size: params.fileSize,
    p_mime_type: params.mimeType,
    p_ai_status: params.aiStatus,
    p_tax_year: params.taxYear ?? CURRENT_TAX_YEAR,
    p_is_prior_year: params.isPriorYear ?? false,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.upload as DocUpload;
}

export async function magicLinkCreateFlag(
  token: string,
  params: {
    clientId: string;
    uploadId: string;
    flagType: string;
    severity: string;
    description: string;
    detectedBy?: string;
  },
): Promise<void> {
  const { data, error } = await (supabase as any).rpc('magic_link_create_flag', {
    p_token: token,
    p_client_id: params.clientId,
    p_upload_id: params.uploadId,
    p_flag_type: params.flagType,
    p_severity: params.severity,
    p_description: params.description,
    p_detected_by: params.detectedBy ?? 'Doc Classifier Agent',
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function magicLinkCreateEmailDraft(
  token: string,
  params: {
    clientId: string;
    toEmail: string;
    fromLabel: string;
    subject: string;
    body: string;
    status?: string;
    type?: string;
  },
): Promise<void> {
  const { data, error } = await (supabase as any).rpc('magic_link_create_email_draft', {
    p_token: token,
    p_client_id: params.clientId,
    p_to_email: params.toEmail,
    p_from_label: params.fromLabel,
    p_subject: params.subject,
    p_body: params.body,
    p_status: params.status ?? 'pending',
    p_type: params.type ?? 'outbox',
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function magicLinkLogActivity(
  token: string,
  params: {
    clientId: string;
    actor: string;
    actorType: string;
    action: string;
  },
): Promise<void> {
  const { data, error } = await (supabase as any).rpc('magic_link_log_activity', {
    p_token: token,
    p_client_id: params.clientId,
    p_actor: params.actor,
    p_actor_type: params.actorType,
    p_action: params.action,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function uploadFileViaMagicLink(
  token: string,
  file: File,
  clientId: string,
  docType: string,
  taxYear: string | number,
  upsert = true,
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !anonKey) {
    return { success: false, error: 'Supabase is not configured' };
  }

  const form = new FormData();
  form.append('token', token);
  form.append('clientId', clientId);
  form.append('docType', docType);
  form.append('taxYear', String(taxYear));
  form.append('upsert', String(upsert));
  form.append('file', file);

  try {
    const res = await fetch(`${baseUrl}/functions/v1/magic-link-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${anonKey}` },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error ?? 'Upload failed' };
    }
    return { success: true, storagePath: json.storagePath };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Upload failed' };
  }
}
