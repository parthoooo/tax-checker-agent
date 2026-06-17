/** Current filing season and prior-year baseline for YoY comparison. */
export const CURRENT_TAX_YEAR = '2025';
export const PRIOR_TAX_YEAR = '2024';

export const CURRENT_TAX_YEAR_NUM = parseInt(CURRENT_TAX_YEAR, 10);
export const PRIOR_TAX_YEAR_NUM = parseInt(PRIOR_TAX_YEAR, 10);

/** Max prior tax years an admin can enable on the client portal. */
export const MAX_PORTAL_PRIOR_YEARS = 30;

/** Prior years admin can enable: current − 1 down to current − 30. */
export function getAdminSelectablePriorYears(current = CURRENT_TAX_YEAR): string[] {
  const currentNum = parseInt(current, 10);
  return Array.from({ length: MAX_PORTAL_PRIOR_YEARS }, (_, i) => String(currentNum - 1 - i));
}

export function isValidPortalTaxYear(year: string, current = CURRENT_TAX_YEAR): boolean {
  const yearNum = parseInt(year, 10);
  const currentNum = parseInt(current, 10);
  if (!Number.isFinite(yearNum)) return false;
  if (year === current) return true;
  return yearNum >= currentNum - MAX_PORTAL_PRIOR_YEARS && yearNum < currentNum;
}

function normalizedPortalEnabledYears(
  client: { portal_enabled_years?: string[] | null; prior_year_upload_enabled?: boolean | null },
): string[] {
  const enabledYears = client.portal_enabled_years ?? [];
  if (enabledYears.length > 0) {
    return enabledYears.filter(y => isValidPortalTaxYear(y) && y !== CURRENT_TAX_YEAR);
  }
  if (client.prior_year_upload_enabled) return ['2024'];
  return [];
}

export function getEnabledPriorYears(
  client: { portal_enabled_years?: string[] | null; prior_year_upload_enabled?: boolean | null },
): string[] {
  return [...normalizedPortalEnabledYears(client)].sort((a, b) => Number(b) - Number(a));
}

/** Current filing year plus admin-enabled prior years (newest first). */
export function getClientPortalTaxYears(
  client: { portal_enabled_years?: string[] | null; prior_year_upload_enabled?: boolean | null },
): string[] {
  return [CURRENT_TAX_YEAR, ...getEnabledPriorYears(client)];
}

export interface DefaultRequirement {
  name: string;
  doc_type: string;
}

export type BusinessType = 'employee' | 'freelancer' | 'partnership';

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  employee:     'Employee (W-2)',
  freelancer:   'Freelancer / Self-employed',
  partnership:  'Partnership / K-1',
};

/** Checklist templates by profession / business type. */
export const PROFESSION_TEMPLATES: Record<BusinessType, DefaultRequirement[]> = {
  employee: [
    { name: 'W-2', doc_type: 'w2' },
    { name: '1098 Mortgage Interest', doc_type: '1098' },
    { name: '1099-INT', doc_type: '1099-int' },
  ],
  freelancer: [
    { name: 'W-2', doc_type: 'w2' },
    { name: '1099-NEC', doc_type: '1099-nec' },
    { name: '1098 Mortgage Interest', doc_type: '1098' },
    { name: 'Schedule C', doc_type: 'sched-c' },
  ],
  partnership: [
    { name: 'W-2', doc_type: 'w2' },
    { name: '1099-NEC', doc_type: '1099-nec' },
    { name: '1098 Mortgage Interest', doc_type: '1098' },
    { name: 'Schedule C', doc_type: 'sched-c' },
    { name: 'K-1 Partnership', doc_type: 'k1' },
  ],
};

/** Default checklist seeded for new client signups (freelancer template). */
export const DEFAULT_CLIENT_REQUIREMENTS: DefaultRequirement[] =
  PROFESSION_TEMPLATES.freelancer;

export function getRequirementsForBusinessType(
  businessType: BusinessType | string | null | undefined,
): DefaultRequirement[] {
  const key = (businessType ?? 'freelancer') as BusinessType;
  return PROFESSION_TEMPLATES[key] ?? PROFESSION_TEMPLATES.freelancer;
}

/** Maps doc_type slug to display label for emails and UI. */
export const DOC_TYPE_LABELS: Record<string, string> = {
  w2: 'W-2',
  '1099-nec': '1099-NEC',
  '1099-int': '1099-INT',
  '1099-div': '1099-DIV',
  '1099-b': '1099-B',
  '1098': '1098 Mortgage Interest',
  'sched-c': 'Schedule C',
  k1: 'K-1 Partnership',
};

export function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? docType;
}
