/** Current filing season and prior-year baseline for YoY comparison. */
export const CURRENT_TAX_YEAR = '2025';
export const PRIOR_TAX_YEAR = '2024';

export const CURRENT_TAX_YEAR_NUM = parseInt(CURRENT_TAX_YEAR, 10);
export const PRIOR_TAX_YEAR_NUM = parseInt(PRIOR_TAX_YEAR, 10);

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
