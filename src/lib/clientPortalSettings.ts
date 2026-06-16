import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';
import {
  fetchClientById,
  fetchDocumentRequirements,
  fetchDocumentUploadsForYear,
} from './db';
import {
  CURRENT_TAX_YEAR,
  PRIOR_TAX_YEAR,
  getRequirementsForBusinessType,
  type BusinessType,
} from './taxConfig';

const supabase: any = typedSupabase;

type Client = Database['public']['Tables']['clients']['Row'];
type DocReq = Database['public']['Tables']['document_requirements']['Row'];

export const PORTAL_TAX_YEARS = [CURRENT_TAX_YEAR, PRIOR_TAX_YEAR] as const;
export type PortalTaxYear = typeof PORTAL_TAX_YEARS[number];

export function clientCanSelectTaxYear(client: Client, year: string): boolean {
  if (year === CURRENT_TAX_YEAR) return true;
  if (year === PRIOR_TAX_YEAR) return client.prior_year_upload_enabled === true;
  return false;
}

function clientRow(client: Client | null | undefined): Client | null {
  if (!client) return null;
  return {
    ...client,
    profession_locked: client.profession_locked ?? false,
    prior_year_upload_enabled: client.prior_year_upload_enabled ?? false,
    year_upload_unlocks: client.year_upload_unlocks ?? [],
  };
}

const V7_CLIENT_COLUMNS = new Set([
  'profession_locked',
  'prior_year_upload_enabled',
  'year_upload_unlocks',
]);

/** Tolerates DBs that have not applied the v7 migration yet. */
async function updateClientFields(
  clientId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('clients').update(updates).eq('id', clientId);
  if (!error) return;

  const msg = (error.message ?? '').toLowerCase();
  if (!msg.includes('column') && !msg.includes('schema')) throw error;

  const fallback = Object.fromEntries(
    Object.entries(updates).filter(([key]) => !V7_CLIENT_COLUMNS.has(key)),
  );
  if (Object.keys(fallback).length === 0) return;
  const { error: e2 } = await supabase.from('clients').update(fallback).eq('id', clientId);
  if (e2) throw e2;
}

export async function isTaxYearUploadLocked(
  clientId: string,
  taxYear: string,
): Promise<{ locked: boolean; reason?: string }> {
  const client = clientRow(await fetchClientById(clientId));
  if (!client) return { locked: true, reason: 'Client not found' };

  if (taxYear === PRIOR_TAX_YEAR && !client.prior_year_upload_enabled) {
    return {
      locked: true,
      reason: `Uploads for ${PRIOR_TAX_YEAR} are disabled. Ask your preparer to enable prior-year uploads.`,
    };
  }

  const uploads = await fetchDocumentUploadsForYear(clientId, taxYear);
  if (uploads.length === 0) return { locked: false };

  const unlocks: string[] = client.year_upload_unlocks ?? [];
  if (unlocks.includes(taxYear)) return { locked: false };

  return {
    locked: true,
    reason: `You already uploaded ${taxYear} documents. Contact your preparer to unlock this year for changes.`,
  };
}

/** Sync checklist rows to profession template; add missing, remove empty extras. */
export async function syncChecklistToProfession(
  clientId: string,
  taxYear: string,
  businessType: BusinessType,
  options: { lockProfession?: boolean; setBy?: 'client' | 'admin' } = {},
): Promise<DocReq[]> {
  const template = getRequirementsForBusinessType(businessType);
  const existing = await fetchDocumentRequirements(clientId, taxYear);
  const uploads = await fetchDocumentUploadsForYear(clientId, taxYear);
  const uploadByReqId = new Map(uploads.map(u => [u.requirement_id, u]));

  const existingTypes = new Set(existing.map(r => r.doc_type));
  const toInsert = template.filter(t => !existingTypes.has(t.doc_type));
  if (toInsert.length > 0) {
    const { error } = await supabase.from('document_requirements').insert(
      toInsert.map(r => ({
        client_id: clientId,
        name: r.name,
        doc_type: r.doc_type,
        tax_year: taxYear,
        required: true,
      })),
    );
    if (error) throw error;
  }

  for (const req of existing) {
    if (template.some(t => t.doc_type === req.doc_type)) continue;
    if (uploadByReqId.has(req.id)) continue;
    await supabase.from('document_requirements').delete().eq('id', req.id);
  }

  const updates: Record<string, unknown> = {
    business_type: businessType,
  };
  if (taxYear === CURRENT_TAX_YEAR) {
    updates.documents_required = template.length;
  }
  if (options.lockProfession) {
    updates.profession_locked = true;
  }

  await updateClientFields(clientId, updates);

  if (options.setBy === 'client') {
    await supabase.from('activity_log').insert({
      client_id: clientId,
      actor: 'Client',
      actor_type: 'client',
      action: `Set profession to ${businessType} and synced ${taxYear} checklist`,
    });
  }

  return fetchDocumentRequirements(clientId, taxYear);
}

export async function setClientProfessionFromPortal(
  clientId: string,
  businessType: BusinessType,
  taxYear: string,
): Promise<DocReq[]> {
  return syncChecklistToProfession(clientId, taxYear, businessType, {
    lockProfession: true,
    setBy: 'client',
  });
}

export async function unlockTaxYearUpload(
  clientId: string,
  taxYear: string,
): Promise<void> {
  const client = await fetchClientById(clientId);
  if (!client) throw new Error('Client not found');
  const unlocks = new Set<string>(client.year_upload_unlocks ?? []);
  unlocks.add(taxYear);
  await updateClientFields(clientId, { year_upload_unlocks: Array.from(unlocks) });
}

export async function setPriorYearUploadEnabled(
  clientId: string,
  enabled: boolean,
): Promise<void> {
  await updateClientFields(clientId, { prior_year_upload_enabled: enabled });
  if (!enabled) return;

  const client = await fetchClientById(clientId);
  if (!client) return;

  const existing = await fetchDocumentRequirements(clientId, PRIOR_TAX_YEAR);
  if (existing.length > 0) return;

  const businessType = (client.business_type ?? 'freelancer') as BusinessType;
  await syncChecklistToProfession(clientId, PRIOR_TAX_YEAR, businessType, {
    lockProfession: false,
  });
}

export async function unlockClientProfession(clientId: string): Promise<void> {
  await updateClientFields(clientId, { profession_locked: false });
}
