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
  verified?: number;
}> {
  const { data, error } = await (supabase as any).rpc('submit_documents_via_token', { p_token: token });
  if (error) throw error;
  return data ?? {};
}
