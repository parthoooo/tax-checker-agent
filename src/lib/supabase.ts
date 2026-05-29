// Re-export the Lovable Cloud–managed Supabase client.
// Typed loosely so our hand-maintained Database in ./database.types.ts can be
// applied at call sites without fighting the auto-generated empty types.
import { supabase as managedSupabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = managedSupabase as unknown as SupabaseClient<Database>;
