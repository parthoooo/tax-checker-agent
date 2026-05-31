import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';
import { generateInputSheetData } from './aiSimulation';

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

// ── Document Requirements ──────────────────────────────────────────────────

export async function fetchDocumentRequirements(clientId: string): Promise<DocReq[]> {
  const { data, error } = await supabase
    .from('document_requirements')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

// ── Document Uploads ───────────────────────────────────────────────────────

export async function fetchDocumentUploads(clientId: string): Promise<DocUpload[]> {
  const { data, error } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('client_id', clientId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDocumentUpload(
  payload: Database['public']['Tables']['document_uploads']['Insert']
): Promise<DocUpload> {
  const { data, error } = await supabase
    .from('document_uploads')
    .insert(payload)
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
  status?: EmailDraft['status']
): Promise<(EmailDraft & { clients: { name: string; email: string } | null })[]> {
  let query = supabase
    .from('email_drafts')
    .select('*, clients(name, email)')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
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
  if (error) throw error;
  return data;
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
  const { count, error } = await supabase
    .from('email_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

// ── Input Sheet Entries ────────────────────────────────────────────────────

export async function fetchInputSheetEntries(
  clientId: string,
  taxYear = '2024'
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
  taxYear = '2024',
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
