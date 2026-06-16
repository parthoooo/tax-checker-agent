import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';

const supabase: any = typedSupabase;

export type SignupRequest = Database['public']['Tables']['signup_requests']['Row'];
export type SignupRole = 'client' | 'preparer' | 'admin';

export async function fetchSignupRequestByAuthUser(authUserId: string): Promise<SignupRequest | null> {
  const { data, error } = await supabase
    .from('signup_requests')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSignupRequest(payload: {
  auth_user_id: string;
  email: string;
  full_name: string;
  provider: string;
}): Promise<SignupRequest> {
  const { data: existing } = await supabase
    .from('signup_requests')
    .select('*')
    .eq('auth_user_id', payload.auth_user_id)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('signup_requests')
    .insert({
      auth_user_id: payload.auth_user_id,
      email: payload.email,
      full_name: payload.full_name,
      provider: payload.provider,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPendingSignupRequests(): Promise<SignupRequest[]> {
  const { data, error } = await supabase
    .from('signup_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function countPendingSignupRequests(): Promise<number> {
  const { count, error } = await supabase
    .from('signup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

export async function approveSignupRequest(
  requestId: string,
  role: SignupRole,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('approve-signup', {
    body: { requestId, action: 'approve', role },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function rejectSignupRequest(
  requestId: string,
  rejectedReason?: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('approve-signup', {
    body: { requestId, action: 'reject', rejectedReason },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
