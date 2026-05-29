import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';

// Loosely-typed handle for the few insert/update call sites whose generic
// resolution fails under our non-strict tsconfig. RLS still enforces safety.
const supabase: any = typedSupabase;

type Client        = Database['public']['Tables']['clients']['Row'];
type AiFlag        = Database['public']['Tables']['ai_flags']['Row'];
type ActivityEntry = Database['public']['Tables']['activity_log']['Row'];
type DocUpload     = Database['public']['Tables']['document_uploads']['Row'];
type DocReq        = Database['public']['Tables']['document_requirements']['Row'];

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
