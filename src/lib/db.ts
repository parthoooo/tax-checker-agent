import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';
import { generateInputSheetData } from './aiSimulation';
import {
  CURRENT_TAX_YEAR,
  PRIOR_TAX_YEAR,
  DEFAULT_CLIENT_REQUIREMENTS,
  getRequirementsForBusinessType,
  type BusinessType,
  type DefaultRequirement,
} from './taxConfig';
import { syncChecklistToProfession } from './clientPortalSettings';

// Loosely-typed handle for insert/update call sites. RLS enforces safety.
const supabase: any = typedSupabase;

type Client            = Database['public']['Tables']['clients']['Row'];
type AiFlag            = Database['public']['Tables']['ai_flags']['Row'];
type ActivityEntry     = Database['public']['Tables']['activity_log']['Row'];
type DocUpload         = Database['public']['Tables']['document_uploads']['Row'];
type DocReq            = Database['public']['Tables']['document_requirements']['Row'];
type MagicLinkToken    = Database['public']['Tables']['magic_link_tokens']['Row'];
type EmailDraft        = Database['public']['Tables']['email_drafts']['Row'];
type InputSheetEntry   = Database['public']['Tables']['input_sheet_entries']['Row'];
type TimeEntry         = Database['public']['Tables']['time_entries']['Row'];

// ── Clients ────────────────────────────────────────────────────────────────

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('last_activity', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function fetchClientByAuthUser(authUserId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();
  if (error) return null;
  return data;
}

/** Admin/preparer inbox for client submission notifications (demo). */
export const PREPARER_NOTIFY_EMAIL = 'nick@brodermansoor.com';

export async function submitDocumentsForReview(
  clientId: string,
  params: {
    clientName: string;
    clientEmail: string;
    actorName: string;
    uploadedCount: number;
    requiredCount: number;
    documentNames: string[];
    taxYear?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const taxYear = params.taxYear ?? CURRENT_TAX_YEAR;

  const { error: clientErr } = await supabase
    .from('clients')
    .update({
      documents_submitted: params.uploadedCount,
      documents_required: params.requiredCount,
      status: 'complete',
      issues: 0,
      last_activity: now,
    })
    .eq('id', clientId);
  if (clientErr) throw clientErr;

  await logActivity({
    client_id: clientId,
    actor: params.actorName,
    actor_type: 'client',
    action: `Submitted all ${taxYear} documents for preparer review`,
  });

  await notifyPreparerOfSubmission(clientId, {
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    documentNames: params.documentNames,
    taxYear,
  });
}

export async function notifyPreparerOfSubmission(
  clientId: string,
  params: {
    clientName: string;
    clientEmail: string;
    documentNames: string[];
    taxYear?: string;
  },
): Promise<void> {
  const taxYear = params.taxYear ?? CURRENT_TAX_YEAR;
  const docList = params.documentNames.map(n => `• ${n}`).join('\n');
  await createEmailDraft({
    client_id: clientId,
    to_email: PREPARER_NOTIFY_EMAIL,
    from_label: params.clientName,
    subject: `${params.clientName} submitted ${taxYear} tax documents`,
    body: [
      'Hi team,',
      '',
      `${params.clientName} (${params.clientEmail}) submitted their ${taxYear} tax document package for review.`,
      '',
      'Uploaded documents (may include flagged items for your review):',
      docList,
      '',
      'Please review in the client portal.',
      '',
      '— Broder Mansoor Portal',
    ].join('\n'),
    status: 'pending',
    type: 'outbox',
  });
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function updateClientBusinessType(
  clientId: string,
  businessType: BusinessType,
  taxYear = CURRENT_TAX_YEAR,
): Promise<Client> {
  await syncChecklistToProfession(clientId, taxYear, businessType, { lockProfession: true });
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  if (error) throw error;
  return data;
}

/** Seed empty checklist for a tax year from the client's profession template. */
export async function applyChecklistTemplate(
  clientId: string,
  taxYear: string,
  businessType?: BusinessType,
): Promise<DocReq[]> {
  const template = getRequirementsForBusinessType(businessType);
  const { data: existing } = await supabase
    .from('document_requirements')
    .select('id')
    .eq('client_id', clientId)
    .eq('tax_year', taxYear)
    .limit(1);

  if (existing?.length) {
    throw new Error(`${taxYear} checklist already exists for this client`);
  }

  const { data, error } = await supabase
    .from('document_requirements')
    .insert(
      template.map(r => ({
        client_id: clientId,
        name: r.name,
        doc_type: r.doc_type,
        tax_year: taxYear,
        required: true,
      })),
    )
    .select();
  if (error) throw error;
  return data ?? [];
}

/**
 * Admin test tool: create verified {prior year} baseline from profession template.
 * Use before testing YoY comparison for new clients with no last-year history.
 */
export async function seedPriorYearTestBaseline(
  clientId: string,
  businessType: BusinessType = 'freelancer',
): Promise<void> {
  const template = getRequirementsForBusinessType(businessType);
  const existing = await fetchDocumentRequirements(clientId, PRIOR_TAX_YEAR);
  if (existing.length > 0) {
    throw new Error(`${PRIOR_TAX_YEAR} baseline already exists. Reset documents first if you need a fresh baseline.`);
  }

  await seedPriorYearBaseline(clientId, template);
}

// ── Document Requirements ──────────────────────────────────────────────────

export async function fetchDocumentRequirements(
  clientId: string,
  taxYear = CURRENT_TAX_YEAR,
): Promise<DocReq[]> {
  const { data, error } = await supabase
    .from('document_requirements')
    .select('*')
    .eq('client_id', clientId)
    .eq('tax_year', taxYear)
    .order('created_at');
  if (error) throw error;
  if ((data ?? []).length > 0) return data ?? [];
  if (taxYear === CURRENT_TAX_YEAR) {
    try {
      const client = await fetchClientById(clientId);
      const businessType = (client?.business_type ?? 'freelancer') as BusinessType;
      return await seedDefaultRequirements(clientId, CURRENT_TAX_YEAR, businessType);
    } catch {
      const { data: legacy } = await supabase
        .from('document_requirements')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at');
      return (legacy ?? []).filter(r => r.tax_year !== PRIOR_TAX_YEAR);
    }
  }
  return [];
}

export async function seedDefaultRequirements(
  clientId: string,
  taxYear = CURRENT_TAX_YEAR,
  businessType: BusinessType = 'freelancer',
): Promise<DocReq[]> {
  const template = getRequirementsForBusinessType(businessType);
  const { data, error } = await supabase
    .from('document_requirements')
    .insert(
      template.map(r => ({
        client_id: clientId,
        name: r.name,
        doc_type: r.doc_type,
        tax_year: taxYear,
        required: true,
      })),
    )
    .select();
  if (error) throw error;

  if (taxYear === CURRENT_TAX_YEAR) {
    await supabase
      .from('clients')
      .update({ documents_required: template.length })
      .eq('id', clientId);
  }

  return data ?? [];
}

export async function createClientRecord(payload: {
  name: string;
  email: string;
  authUserId: string;
  phone?: string;
  businessType?: BusinessType;
}): Promise<Client> {
  const template = getRequirementsForBusinessType(payload.businessType);
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      auth_user_id: payload.authUserId,
      business_type: payload.businessType ?? 'freelancer',
      status: 'active',
      documents_required: template.length,
      documents_submitted: 0,
      issues: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function seedPriorYearBaseline(
  clientId: string,
  requirements: DefaultRequirement[] = DEFAULT_CLIENT_REQUIREMENTS,
): Promise<void> {
  const { data: priorReqs, error: reqErr } = await supabase
    .from('document_requirements')
    .insert(
      requirements.map(r => ({
        client_id: clientId,
        name: r.name,
        doc_type: r.doc_type,
        tax_year: PRIOR_TAX_YEAR,
        required: true,
      })),
    )
    .select('id, doc_type');
  if (reqErr) throw reqErr;

  const uploads = (priorReqs ?? []).map((req: { id: string; doc_type: string }) => ({
    client_id: clientId,
    requirement_id: req.id,
    file_name: `${req.doc_type}_${PRIOR_TAX_YEAR}.pdf`,
    storage_path: `clients/${clientId}/${PRIOR_TAX_YEAR}/${req.doc_type}/${req.doc_type}_${PRIOR_TAX_YEAR}.pdf`,
    file_size: 200000,
    mime_type: 'application/pdf',
    ai_status: 'verified' as const,
    tax_year: PRIOR_TAX_YEAR,
    is_prior_year: true,
    uploaded_by: null,
  }));

  if (uploads.length > 0) {
    const { error: upErr } = await supabase.from('document_uploads').insert(uploads);
    if (upErr) {
      const legacy = uploads.map(({ tax_year: _t, is_prior_year: _p, ...rest }) => rest);
      const { error: upErr2 } = await supabase.from('document_uploads').insert(legacy);
      if (upErr2) throw upErr2;
    }
  }
}

// ── Document Uploads ───────────────────────────────────────────────────────

/** Insert upload; omits tax_year/is_prior_year if remote schema not migrated yet. */
async function insertDocumentUploadRow(
  payload: Database['public']['Tables']['document_uploads']['Insert'],
): Promise<DocUpload> {
  const { data, error } = await supabase.from('document_uploads').insert(payload).select().single();
  if (!error) return data;

  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('tax_year') || msg.includes('is_prior_year') || msg.includes('column')) {
    const { tax_year: _ty, is_prior_year: _py, ...legacy } = payload as Record<string, unknown>;
    const { data: d2, error: e2 } = await supabase.from('document_uploads').insert(legacy).select().single();
    if (e2) throw e2;
    return d2;
  }
  throw error;
}

/** All uploads for a tax year (includes admin baseline seeds and client uploads). */
export async function fetchDocumentUploadsForYear(
  clientId: string,
  taxYear: string,
): Promise<DocUpload[]> {
  const { data, error } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .eq('tax_year', taxYear)
    .order('uploaded_at', { ascending: false });

  if (!error) return dedupeUploadsByRequirement(data ?? []);

  const { data: all, error: e2 } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false });
  if (e2) throw e2;
  return dedupeUploadsByRequirement(all ?? []);
}

function dedupeUploadsByRequirement(uploads: DocUpload[]): DocUpload[] {
  const seen = new Set<string>();
  const out: DocUpload[] = [];
  for (const u of uploads) {
    const key = u.requirement_id ?? u.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

/** Current-year client uploads only (excludes prior-year baseline seeds). */
export async function fetchDocumentUploads(
  clientId: string,
  taxYear = CURRENT_TAX_YEAR,
): Promise<DocUpload[]> {
  const { data, error } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .eq('tax_year', taxYear)
    .eq('is_prior_year', false)
    .order('uploaded_at', { ascending: false });

  if (!error) return dedupeUploadsByRequirement(data ?? []);

  const { data: all, error: e2 } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false });
  if (e2) throw e2;
  return dedupeUploadsByRequirement(
    (all ?? []).filter(u => !(u as DocUpload).is_prior_year),
  );
}

export async function fetchPriorYearUploads(clientId: string): Promise<DocUpload[]> {
  const { data, error } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .eq('tax_year', PRIOR_TAX_YEAR)
    .order('uploaded_at', { ascending: false });

  if (!error) return data ?? [];

  const { data: all, error: e2 } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false });
  if (e2) throw e2;
  return (all ?? []).filter(u => {
    const row = u as DocUpload;
    return row.is_prior_year || /_2024\.|\/2024\//.test(row.storage_path ?? row.file_name ?? '');
  });
}

export async function createDocumentUpload(
  payload: Database['public']['Tables']['document_uploads']['Insert']
): Promise<DocUpload> {
  return insertDocumentUploadRow(payload);
}

export async function replaceDocumentUpload(
  uploadId: string,
  payload: Omit<Database['public']['Tables']['document_uploads']['Insert'], 'client_id' | 'requirement_id'>,
): Promise<DocUpload> {
  const { data, error } = await supabase
    .from('document_uploads')
    .update({
      file_name: payload.file_name,
      storage_path: payload.storage_path,
      file_size: payload.file_size,
      mime_type: payload.mime_type,
      ai_status: payload.ai_status,
      tax_year: payload.tax_year,
      is_prior_year: payload.is_prior_year ?? false,
      uploaded_by: payload.uploaded_by ?? null,
      uploaded_at: new Date().toISOString(),
    })
    .eq('id', uploadId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUploadAiStatus(
  uploadId: string,
  aiStatus: DocUpload['ai_status']
): Promise<void> {
  const { error } = await supabase
    .from('document_uploads')
    .update({ ai_status: aiStatus })
    .eq('id', uploadId);
  if (error) throw error;
}

/** Admin: wipe current-year uploads, flags, drafts; re-seed empty checklist. Keeps client + magic links + prior-year baseline. */
export async function resetClientDocuments(clientId: string): Promise<DocReq[]> {
  const { data: allUploads, error: fetchErr } = await supabase
    .from('document_uploads')
    .select('id, storage_path, tax_year, is_prior_year')
    .eq('client_id', clientId);
  if (fetchErr) throw fetchErr;

  const currentUploads = (allUploads ?? []).filter((u: DocUpload) => {
    if (u.is_prior_year === true) return false;
    if (u.tax_year === PRIOR_TAX_YEAR) return false;
    if (u.tax_year === CURRENT_TAX_YEAR) return true;
    // Legacy rows: treat as current unless path is clearly prior-year
    return !new RegExp(`/${PRIOR_TAX_YEAR}/`).test(u.storage_path ?? '');
  });

  const storagePaths = [
    ...new Set(
      currentUploads
        .map((u: DocUpload) => u.storage_path)
        .filter((p): p is string => Boolean(p)),
    ),
  ];

  if (storagePaths.length > 0) {
    const { error: storageErr } = await supabase.storage.from('documents').remove(storagePaths);
    if (storageErr) {
      // Best-effort: also try listing the current-year folder
      const prefix = `clients/${clientId}/${CURRENT_TAX_YEAR}`;
      const { data: listed } = await supabase.storage.from('documents').list(prefix, { limit: 200 });
      if (listed?.length) {
        await supabase.storage
          .from('documents')
          .remove(listed.map((f: { name: string }) => `${prefix}/${f.name}`));
      }
    }
  }

  const deletes = await Promise.all([
    supabase.from('document_uploads').delete().eq('client_id', clientId).eq('tax_year', CURRENT_TAX_YEAR),
    supabase.from('document_requirements').delete().eq('client_id', clientId).eq('tax_year', CURRENT_TAX_YEAR),
    supabase.from('ai_flags').delete().eq('client_id', clientId),
    supabase.from('email_drafts').delete().eq('client_id', clientId),
    supabase.from('input_sheet_entries').delete().eq('client_id', clientId).eq('tax_year', CURRENT_TAX_YEAR),
  ]);

  // Fallback when tax_year column is missing on uploads/requirements
  const uploadDelErr = deletes[0].error;
  if (uploadDelErr && (uploadDelErr.message ?? '').toLowerCase().includes('tax_year')) {
    const ids = currentUploads.map((u: DocUpload) => u.id);
    if (ids.length > 0) {
      const { error } = await supabase.from('document_uploads').delete().in('id', ids);
      if (error) throw error;
    }
  } else if (uploadDelErr) {
    throw uploadDelErr;
  }

  const reqDelErr = deletes[1].error;
  if (reqDelErr && (reqDelErr.message ?? '').toLowerCase().includes('tax_year')) {
    const { data: reqs } = await supabase
      .from('document_requirements')
      .select('id, tax_year')
      .eq('client_id', clientId);
    const currentReqIds = (reqs ?? [])
      .filter((r: DocReq) => r.tax_year !== PRIOR_TAX_YEAR)
      .map((r: DocReq) => r.id);
    if (currentReqIds.length > 0) {
      const { error } = await supabase.from('document_requirements').delete().in('id', currentReqIds);
      if (error) throw error;
    }
  } else if (reqDelErr) {
    throw reqDelErr;
  }

  for (const { error } of deletes.slice(2)) {
    if (error && !(error.message ?? '').toLowerCase().includes('input_sheet')) throw error;
  }

  const client = await fetchClientById(clientId);
  const businessType = (client?.business_type ?? 'freelancer') as BusinessType;
  const requirements = await seedDefaultRequirements(clientId, CURRENT_TAX_YEAR, businessType);

  await supabase
    .from('clients')
    .update({
      documents_submitted: 0,
      issues: 0,
      status: 'active',
      documents_required: requirements.length,
      last_activity: new Date().toISOString(),
    })
    .eq('id', clientId);

  await supabase
    .from('client_corrections')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('status', 'sent')
    .then(() => {})
    .catch(() => {});

  return requirements;
}

// ── Storage ────────────────────────────────────────────────────────────────

export async function uploadFileToStorage(
  clientId: string,
  file: File
): Promise<string> {
  const path = `clients/${clientId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

// ── AI Flags ───────────────────────────────────────────────────────────────

export async function fetchAiFlags(resolved?: boolean): Promise<(AiFlag & { clients: { name: string; email: string } | null })[]> {
  let query = supabase
    .from('ai_flags')
    .select('*, clients(name, email)')
    .order('created_at', { ascending: false });

  if (resolved !== undefined) query = query.eq('resolved', resolved);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any;
}

export async function createAiFlag(
  payload: Database['public']['Tables']['ai_flags']['Insert']
): Promise<void> {
  const { error } = await supabase.from('ai_flags').insert(payload);
  if (error) throw error;
}

export async function resolveAiFlag(flagId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_flags')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', flagId);
  if (error) throw error;
}

// ── Activity Log ───────────────────────────────────────────────────────────

export async function fetchActivityLog(): Promise<(ActivityEntry & { clients: { name: string } | null })[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function logActivity(
  payload: Database['public']['Tables']['activity_log']['Insert']
): Promise<void> {
  const { error } = await supabase.from('activity_log').insert(payload);
  if (error) throw error;
}

// ── Reminders ──────────────────────────────────────────────────────────────

export async function saveReminder(
  payload: Database['public']['Tables']['reminders']['Insert']
): Promise<void> {
  const { error } = await supabase.from('reminders').insert(payload);
  if (error) throw error;
}

// ── Magic Link Tokens ──────────────────────────────────────────────────────

export async function fetchClientByToken(
  token: string
): Promise<(Client & { token_id: string; token_expires_at: string }) | null> {
  const { data, error } = await supabase
    .from('magic_link_tokens')
    .select('id, expires_at, clients(*)')
    .eq('token', token)
    .single();
  if (error || !data) return null;
  return { ...data.clients, token_id: data.id, token_expires_at: data.expires_at };
}

export async function generateMagicToken(clientId: string): Promise<string> {
  const token = crypto.randomUUID();
  const { error } = await supabase
    .from('magic_link_tokens')
    .insert({ client_id: clientId, token });
  if (error) throw error;
  return token;
}

// ── Email Drafts ───────────────────────────────────────────────────────────

export async function fetchEmailDrafts(
  status?: EmailDraft['status'],
  type?: 'outbox' | 'reminder'
): Promise<(EmailDraft & { clients: { name: string; email: string } | null })[]> {
  let query = supabase
    .from('email_drafts')
    .select('*, clients(name, email)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  if (type === 'reminder') {
    query = query.eq('type', 'reminder');
  } else if (type === 'outbox') {
    query = query.or('type.eq.outbox,type.is.null');
  }
  let { data, error } = await query;
  if (error && type && (error.message ?? '').toLowerCase().includes('type')) {
    let fallback = supabase
      .from('email_drafts')
      .select('*, clients(name, email)')
      .order('created_at', { ascending: false });
    if (status) fallback = fallback.eq('status', status);
    ({ data, error } = await fallback);
  }
  if (error) throw error;
  return (data ?? []) as any;
}

export async function createEmailDraft(
  payload: Database['public']['Tables']['email_drafts']['Insert']
): Promise<EmailDraft> {
  const { data, error } = await supabase
    .from('email_drafts')
    .insert(payload)
    .select()
    .single();
  if (!error) return data;

  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('type') || msg.includes('column')) {
    const { type: _t, ...legacy } = payload as Record<string, unknown>;
    const { data: d2, error: e2 } = await supabase
      .from('email_drafts')
      .insert(legacy)
      .select()
      .single();
    if (e2) throw e2;
    return d2;
  }
  throw error;
}

export async function approveEmailDraft(id: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('email_drafts')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function dismissEmailDraft(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_drafts')
    .update({ status: 'dismissed' })
    .eq('id', id);
  if (error) throw error;
}

export async function updateEmailDraftBody(id: string, body: string, subject: string): Promise<void> {
  const { error } = await supabase
    .from('email_drafts')
    .update({ body, subject })
    .eq('id', id);
  if (error) throw error;
}

export async function countPendingEmailDrafts(): Promise<number> {
  let { count, error } = await supabase
    .from('email_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or('type.eq.outbox,type.is.null');
  if (error && (error.message ?? '').toLowerCase().includes('type')) {
    ({ count, error } = await supabase
      .from('email_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'));
  }
  if (error) return 0;
  return count ?? 0;
}

export async function countPendingReminderDrafts(): Promise<number> {
  const { count, error } = await supabase
    .from('email_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('type', 'reminder');
  if (error) return 0;
  return count ?? 0;
}

// ── Input Sheet Entries ────────────────────────────────────────────────────

export async function fetchInputSheetEntries(
  clientId: string,
  taxYear = CURRENT_TAX_YEAR,
): Promise<InputSheetEntry[]> {
  const { data, error } = await supabase
    .from('input_sheet_entries')
    .select('*')
    .eq('client_id', clientId)
    .eq('tax_year', taxYear)
    .order('section')
    .order('field_name');
  if (error) throw error;
  return data ?? [];
}

export async function verifyInputSheetEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('input_sheet_entries')
    .update({ verified: true })
    .eq('id', id);
  if (error) throw error;
}

export async function populateInputSheet(
  clientId: string,
  uploads: DocUpload[],
  taxYear = CURRENT_TAX_YEAR,
  clientName = 'Client',
): Promise<void> {
  await supabase
    .from('input_sheet_entries')
    .delete()
    .eq('client_id', clientId)
    .eq('tax_year', taxYear)
    .eq('ai_populated', true)
    .eq('verified', false);

  const filenames = uploads.map(u => u.file_name);
  const generated = generateInputSheetData(clientName, filenames);

  if (generated.length === 0) return;

  const entries: Database['public']['Tables']['input_sheet_entries']['Insert'][] =
    generated.map(f => ({
      client_id:    clientId,
      tax_year:     taxYear,
      section:      f.section,
      field_name:   f.field_name,
      field_value:  f.field_value,
      ai_populated: true,
      verified:     false,
    }));

  const { error } = await supabase.from('input_sheet_entries').insert(entries);
  if (error) throw error;
}

// ── Time Entries ───────────────────────────────────────────────────────────

export async function startTimeEntry(clientId: string, userEmail: string): Promise<string> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert({ client_id: clientId, user_email: userEmail, started_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function stopTimeEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchTimeThisWeek(userEmail?: string): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('time_entries')
    .select('started_at, ended_at')
    .gte('started_at', weekAgo)
    .not('ended_at', 'is', null);
  if (userEmail) query = query.eq('user_email', userEmail);
  const { data, error } = await query;
  if (error) return 0;
  const totalSeconds = (data ?? []).reduce((sum: number, e: TimeEntry) => {
    if (!e.ended_at) return sum;
    return sum + (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 1000;
  }, 0);
  return Math.round(totalSeconds / 3600 * 10) / 10; // hours rounded to 1dp
}
