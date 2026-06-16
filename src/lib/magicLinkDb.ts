import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type DocReq = Database['public']['Tables']['document_requirements']['Row'];
type DocUpload = Database['public']['Tables']['document_uploads']['Row'];

export interface MagicLinkPayload {
  expired?: boolean;
  token_id: string;
  token_expires_at: string;
  client: Client;
  requirements: DocReq[];
  uploads: DocUpload[];
  prior_requirements?: DocReq[];
  prior_uploads?: DocUpload[];
}

export async function resolveMagicLink(token: string): Promise<MagicLinkPayload | null | 'expired'> {
  const { data, error } = await (supabase as any).rpc('resolve_magic_link', { p_token: token });
  if (error || data == null) return null;
  if (data.expired === true) return 'expired';
  return data as MagicLinkPayload;
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
    p_tax_year: params.taxYear ?? '2025',
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
