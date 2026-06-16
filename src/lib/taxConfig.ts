/** Current filing season and prior-year baseline for YoY comparison. */
export const CURRENT_TAX_YEAR = '2025';
export const PRIOR_TAX_YEAR = '2024';

export const CURRENT_TAX_YEAR_NUM = parseInt(CURRENT_TAX_YEAR, 10);
export const PRIOR_TAX_YEAR_NUM = parseInt(PRIOR_TAX_YEAR, 10);

export interface DefaultRequirement {
  name: string;
  doc_type: string;
}

/** Default checklist seeded for new client signups. */
export const DEFAULT_CLIENT_REQUIREMENTS: DefaultRequirement[] = [
  { name: 'W-2', doc_type: 'w2' },
  { name: '1099-NEC', doc_type: '1099-nec' },
  { name: '1098 Mortgage Interest', doc_type: '1098' },
  { name: 'Schedule C', doc_type: 'sched-c' },
];

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
