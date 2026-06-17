import { supabase as typedSupabase } from './supabase';
import type { Database } from './database.types';
import {
  fetchClientById,
  fetchDocumentRequirements,
  fetchDocumentUploadsForYear,
  hasClientSubmittedTaxYear,
} from './db';
import {
  CURRENT_TAX_YEAR,
  getEnabledPriorYears,
  isValidPortalTaxYear,
  getRequirementsForBusinessType,
  type BusinessType,
} from './taxConfig';

const supabase: any = typedSupabase;

type Client = Database['public']['Tables']['clients']['Row'];
type DocReq = Database['public']['Tables']['document_requirements']['Row'];

/** @deprecated Use getClientPortalTaxYears(client) for dynamic portal years. */
export type PortalTaxYear = string;

/** Rows the client portal should show for a profession (excludes admin YoY baseline extras). */
export function getClientPortalRequirements(
  reqs: DocReq[],
  businessType: BusinessType,
): DocReq[] {
  const templateTypes = new Set(
    getRequirementsForBusinessType(businessType).map(t => t.doc_type),
  );
  return reqs.filter(r => r.required && templateTypes.has(r.doc_type));
}

/** True when required checklist rows match the profession template. */
export function checklistMatchesProfession(
  reqs: DocReq[],
  businessType: BusinessType,
): boolean {
  const template = getRequirementsForBusinessType(businessType);
  const templateTypes = new Set(template.map(t => t.doc_type));
  const portalReqs = getClientPortalRequirements(reqs, businessType);

  const hasExtraRequired = reqs.some(
    r => r.required && !templateTypes.has(r.doc_type),
  );
  if (hasExtraRequired) return false;
  if (portalReqs.length !== template.length) return false;

  const types = new Set(portalReqs.map(r => r.doc_type));
  return template.every(t => types.has(t.doc_type));
}

export function isPortalTaxYearEnabled(client: Client, year: string): boolean {
  if (year === CURRENT_TAX_YEAR) return true;
  const enabled = client.portal_enabled_years ?? [];
  if (enabled.length > 0) return enabled.includes(year);
  return client.prior_year_upload_enabled === true && year === '2024';
}

export function clientCanSelectTaxYear(client: Client, year: string): boolean {
  if (year === CURRENT_TAX_YEAR) return true;
  return isPortalTaxYearEnabled(client, year) && isValidPortalTaxYear(year);
}

function clientRow(client: Client | null | undefined): Client | null {
  if (!client) return null;
  return {
    ...client,
    profession_locked: client.profession_locked ?? false,
    prior_year_upload_enabled: client.prior_year_upload_enabled ?? false,
    portal_enabled_years: client.portal_enabled_years ?? [],
    year_upload_unlocks: client.year_upload_unlocks ?? [],
  };
}

const V7_CLIENT_COLUMNS = new Set([
  'profession_locked',
  'prior_year_upload_enabled',
  'portal_enabled_years',
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

  if (taxYear !== CURRENT_TAX_YEAR && !isPortalTaxYearEnabled(client, taxYear)) {
    return {
      locked: true,
      reason: `Uploads for ${taxYear} are disabled. Ask your preparer to enable prior-year uploads.`,
    };
  }

  const submitted = await hasClientSubmittedTaxYear(clientId, taxYear);
  if (!submitted) return { locked: false };

  const unlocks: string[] = client.year_upload_unlocks ?? [];
  if (unlocks.includes(taxYear)) return { locked: false };

  return {
    locked: true,
    reason: `Your ${taxYear} documents were already submitted. Contact your preparer if you need to upload again.`,
  };
}

/**
 * Sync checklist rows to profession template.
 * Admin YoY baseline rows (extra doc types with uploads) are kept in DB but marked not required
 * so the client portal only shows profession-appropriate slots.
 */
export async function syncChecklistToProfession(
  clientId: string,
  taxYear: string,
  businessType: BusinessType,
  options: { lockProfession?: boolean; setBy?: 'client' | 'admin' } = {},
): Promise<DocReq[]> {
  const template = getRequirementsForBusinessType(businessType);
  const templateTypes = new Set(template.map(t => t.doc_type));
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
    if (templateTypes.has(req.doc_type)) {
      if (!req.required) {
        await supabase
          .from('document_requirements')
          .update({ required: true })
          .eq('id', req.id);
      }
      continue;
    }

    if (uploadByReqId.has(req.id)) {
      if (req.required) {
        await supabase
          .from('document_requirements')
          .update({ required: false })
          .eq('id', req.id);
      }
      continue;
    }

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

  const refreshed = await fetchDocumentRequirements(clientId, taxYear);
  return getClientPortalRequirements(refreshed, businessType);
}

function parseRpcRequirements(data: unknown): DocReq[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as DocReq[];
  if (typeof data === 'object' && data !== null && 'error' in data) {
    throw new Error(String((data as { error: string }).error));
  }
  return [];
}

export type PortalProfessionUpdate = {
  businessType: BusinessType;
  requirementsByYear: Partial<Record<string, DocReq[]>>;
};

function parseRequirementsByYear(data: unknown): Partial<Record<string, DocReq[]>> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: Partial<Record<string, DocReq[]>> = {};
  for (const [year, reqs] of Object.entries(data as Record<string, unknown>)) {
    out[year] = parseRpcRequirements(reqs);
  }
  return out;
}

function parseProfessionUpdatePayload(
  data: unknown,
  fallbackBusinessType: BusinessType,
): PortalProfessionUpdate {
  const payload = data as {
    error?: string;
    business_type?: string;
    requirements_by_year?: unknown;
    requirements_2025?: unknown;
    requirements_2024?: unknown;
  } | null;
  if (payload?.error) throw new Error(payload.error);
  const businessType = (payload?.business_type ?? fallbackBusinessType) as BusinessType;

  const fromDynamic = parseRequirementsByYear(payload?.requirements_by_year);
  if (Object.keys(fromDynamic).length > 0) {
    return { businessType, requirementsByYear: fromDynamic };
  }

  return {
    businessType,
    requirementsByYear: {
      [CURRENT_TAX_YEAR]: parseRpcRequirements(payload?.requirements_2025),
      ...(parseRpcRequirements(payload?.requirements_2024).length > 0
        ? { '2024': parseRpcRequirements(payload?.requirements_2024) }
        : {}),
    },
  };
}

/** Client session: sync checklist via SECURITY DEFINER RPC (RLS blocks direct writes). */
export async function resolveClientPortalRequirements(
  clientId: string,
  taxYear: string,
  businessType: BusinessType,
): Promise<DocReq[]> {
  const { data, error } = await supabase.rpc('client_ensure_portal_checklist', {
    p_tax_year: taxYear,
  });

  if (!error) {
    return parseRpcRequirements(data);
  }

  const existing = await fetchDocumentRequirements(clientId, taxYear);
  return getClientPortalRequirements(existing, businessType);
}

/** Staff/admin: ensure checklist matches profession (direct DB access). */
export async function ensureClientPortalChecklist(
  clientId: string,
  taxYear: string,
  businessType: BusinessType,
): Promise<DocReq[]> {
  let existing = await fetchDocumentRequirements(clientId, taxYear);

  if (existing.length === 0 && taxYear !== CURRENT_TAX_YEAR) {
    const template = getRequirementsForBusinessType(businessType);
    const { error } = await supabase.from('document_requirements').insert(
      template.map(r => ({
        client_id: clientId,
        name: r.name,
        doc_type: r.doc_type,
        tax_year: taxYear,
        required: true,
      })),
    );
    if (error) throw error;
    existing = await fetchDocumentRequirements(clientId, taxYear);
    return getClientPortalRequirements(existing, businessType);
  }

  if (!checklistMatchesProfession(existing, businessType)) {
    return syncChecklistToProfession(clientId, taxYear, businessType, {
      lockProfession: false,
    });
  }

  return getClientPortalRequirements(existing, businessType);
}

function isMissingRpcError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('could not find the function');
}

async function syncPortalYearsForProfessionFallback(
  clientId: string,
  businessType: BusinessType,
): Promise<Partial<Record<string, DocReq[]>>> {
  const requirementsByYear: Partial<Record<string, DocReq[]>> = {
    [CURRENT_TAX_YEAR]: await resolveClientPortalRequirements(
      clientId,
      CURRENT_TAX_YEAR,
      businessType,
    ),
  };
  const client = clientRow(await fetchClientById(clientId));
  for (const year of getEnabledPriorYears(client ?? { portal_enabled_years: [], prior_year_upload_enabled: false })) {
    requirementsByYear[year] = await resolveClientPortalRequirements(
      clientId,
      year,
      businessType,
    );
  }
  return requirementsByYear;
}

export async function setClientProfessionFromPortal(
  clientId: string,
  businessType: BusinessType,
  taxYear: string,
): Promise<DocReq[]> {
  const { data, error } = await supabase.rpc('client_update_profession', {
    p_business_type: businessType,
    p_lock_profession: true,
  });
  if (error) {
    if (!isMissingRpcError(error)) throw error;
    await updateClientFields(clientId, {
      business_type: businessType,
      profession_locked: true,
    });
    return resolveClientPortalRequirements(clientId, taxYear, businessType);
  }
  const payload = parseProfessionUpdatePayload(data, businessType);
  return payload.requirementsByYear[taxYear]
    ?? payload.requirementsByYear[CURRENT_TAX_YEAR]
    ?? resolveClientPortalRequirements(clientId, taxYear, businessType);
}

/** Client changed profession while admin has unlocked the portal picker. */
export async function updateClientProfessionFromPortal(
  clientId: string,
  businessType: BusinessType,
): Promise<PortalProfessionUpdate> {
  const { data, error } = await supabase.rpc('client_update_profession', {
    p_business_type: businessType,
    p_lock_profession: false,
  });
  if (error) {
    if (!isMissingRpcError(error)) throw error;
    await updateClientFields(clientId, { business_type: businessType });
    return {
      businessType,
      requirementsByYear: await syncPortalYearsForProfessionFallback(clientId, businessType),
    };
  }
  return parseProfessionUpdatePayload(data, businessType);
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

/** Admin grants permission for client to upload again after a prior submission. */
export async function allowClientReupload(clientId: string, taxYear: string): Promise<void> {
  await unlockTaxYearUpload(clientId, taxYear);
}

/** Remove re-upload permission after client submits again. */
export async function clearTaxYearReuploadGrant(clientId: string, taxYear: string): Promise<void> {
  const client = await fetchClientById(clientId);
  if (!client) return;
  const unlocks = (client.year_upload_unlocks ?? []).filter(y => y !== taxYear);
  await updateClientFields(clientId, { year_upload_unlocks: unlocks });
}

export async function enablePortalTaxYear(
  clientId: string,
  year: string,
): Promise<void> {
  if (!isValidPortalTaxYear(year) || year === CURRENT_TAX_YEAR) {
    throw new Error(`Invalid portal tax year: ${year}`);
  }

  const client = clientRow(await fetchClientById(clientId));
  if (!client) throw new Error('Client not found');

  const enabled = new Set(getEnabledPriorYears(client));
  enabled.add(year);
  await updateClientFields(clientId, {
    portal_enabled_years: Array.from(enabled).sort((a, b) => Number(b) - Number(a)),
    ...(year === '2024' ? { prior_year_upload_enabled: true } : {}),
  });

  const businessType = (client.business_type ?? 'freelancer') as BusinessType;
  await ensureClientPortalChecklist(clientId, year, businessType);
}

export async function disablePortalTaxYear(
  clientId: string,
  year: string,
): Promise<void> {
  const client = clientRow(await fetchClientById(clientId));
  if (!client) throw new Error('Client not found');

  const enabled = getEnabledPriorYears(client).filter(y => y !== year);
  await updateClientFields(clientId, {
    portal_enabled_years: enabled,
    ...(year === '2024' ? { prior_year_upload_enabled: false } : {}),
  });
}

/** @deprecated Use enablePortalTaxYear / disablePortalTaxYear */
export async function setPriorYearUploadEnabled(
  clientId: string,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    await enablePortalTaxYear(clientId, '2024');
  } else {
    await disablePortalTaxYear(clientId, '2024');
  }
}

export async function unlockClientProfession(clientId: string): Promise<void> {
  await updateClientFields(clientId, { profession_locked: false });
}
