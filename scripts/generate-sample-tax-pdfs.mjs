#!/usr/bin/env node
/**
 * Generate realistic demo tax PDFs for all three profession categories.
 * Employee (3 docs), Freelancer (4), Partnership (5) — each with 2024 + 2025 data.
 *
 * Run: node scripts/generate-sample-tax-pdfs.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'sample-docs');
const MANIFEST_PATH = join(__dirname, '..', 'src', 'lib', 'demoTaxDocumentManifest.ts');
const EDGE_MANIFEST_JSON = join(__dirname, '..', 'supabase', 'functions', '_shared', 'demoTaxDocumentManifest.json');

const PERSONA = {
  name: 'John Smith',
  address: '123 Oak Street, Montclair, NJ 07042',
  tin: 'XXX-XX-4567',
};

// ── PDF builder ─────────────────────────────────────────────────────────────

function pdfEscape(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function line(fontSize, dy, text) {
  const parts = [];
  if (dy !== null) parts.push(`0 ${dy} Td`);
  parts.push(`/F1 ${fontSize} Tf`);
  parts.push(`(${pdfEscape(text)}) Tj`);
  return parts.join('\n');
}

function buildPdf(rows) {
  const stream = ['BT', '72 750 Td', ...rows.map((r) => line(r.size, r.dy, r.text)), 'ET'].join('\n');
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj + '\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function header(title, subtitle) {
  return [
    { size: 16, dy: null, text: title },
    { size: 10, dy: -22, text: subtitle },
  ];
}

function personBlock() {
  return [
    { size: 10, dy: -20, text: `Employee / Recipient: ${PERSONA.name}` },
    { size: 10, dy: -14, text: `   ${PERSONA.address}` },
    { size: 10, dy: -14, text: `   TIN: ${PERSONA.tin}` },
  ];
}

// ── Form templates ──────────────────────────────────────────────────────────

function w2Rows(year, wages, fedWithheld) {
  return [
    ...header(`Form W-2 Wage and Tax Statement - ${year}`, 'Copy B - For Employee'),
    { size: 11, dy: -24, text: 'c  Employer: Goldman Sachs & Co. LLC' },
    { size: 10, dy: -14, text: '   EIN: 13-3571560' },
    { size: 10, dy: -14, text: '   200 West Street, New York, NY 10282' },
    ...personBlock(),
    { size: 11, dy: -22, text: 'Federal tax information' },
    { size: 10, dy: -16, text: `1  Wages, tips, other compensation .......... $${wages}` },
    { size: 10, dy: -14, text: `2  Federal income tax withheld ............. $${fedWithheld}` },
    { size: 10, dy: -14, text: `3  Social security wages ................... $${wages}` },
    { size: 10, dy: -14, text: `5  Medicare wages and tips ................. $${wages}` },
    { size: 9, dy: -22, text: `Tax Year: ${year}  |  OMB No. 1545-0008` },
  ];
}

function form1098Rows(year, interest, principal) {
  return [
    ...header(`Form 1098 Mortgage Interest Statement - ${year}`, 'Copy B - For Payer/Borrower'),
    { size: 11, dy: -24, text: 'LENDER: Wells Fargo Bank, N.A.' },
    { size: 10, dy: -14, text: '   EIN: 94-1347393' },
    { size: 10, dy: -14, text: '   420 Montgomery Street, San Francisco, CA 94104' },
    ...personBlock(),
    { size: 11, dy: -22, text: 'Mortgage information' },
    { size: 10, dy: -16, text: `1  Mortgage interest received .............. $${interest}` },
    { size: 10, dy: -14, text: `2  Outstanding mortgage principal .......... $${principal}` },
    { size: 10, dy: -14, text: '9  Property address: 123 Oak Street, Montclair, NJ 07042' },
    { size: 9, dy: -22, text: `Tax Year: ${year}  |  OMB No. 1545-1380` },
  ];
}

function form1099IntRows(year, interest) {
  return [
    ...header(`Form 1099-INT Interest Income - ${year}`, 'Copy B - For Recipient'),
    { size: 11, dy: -24, text: 'PAYER: Fidelity Investments' },
    { size: 10, dy: -14, text: '   EIN: 04-3180740' },
    { size: 10, dy: -14, text: '   245 Summer Street, Boston, MA 02210' },
    ...personBlock(),
    { size: 11, dy: -22, text: 'Interest income' },
    { size: 10, dy: -16, text: `1  Interest income ......................... $${interest}` },
    { size: 10, dy: -14, text: '8  Tax-exempt interest ..................... $0' },
    { size: 9, dy: -22, text: `Tax Year: ${year}  |  OMB No. 1545-0112` },
  ];
}

function form1099NecRows(year, compensation) {
  return [
    ...header(`Form 1099-NEC Nonemployee Compensation - ${year}`, 'Copy B - For Recipient'),
    { size: 11, dy: -24, text: 'PAYER: Bright Path Consulting LLC' },
    { size: 10, dy: -14, text: '   EIN: 84-2917364' },
    { size: 10, dy: -14, text: '   88 Broad Street, Newark, NJ 07102' },
    ...personBlock(),
    { size: 11, dy: -22, text: 'Nonemployee compensation' },
    { size: 10, dy: -16, text: `1  Nonemployee compensation ................ $${compensation}` },
    { size: 10, dy: -14, text: '4  Federal income tax withheld ............. $0' },
    { size: 9, dy: -22, text: `Tax Year: ${year}  |  OMB No. 1545-0116` },
  ];
}

function scheduleCRows(year, gross, expenses, net) {
  return [
    ...header(`Schedule C (Form 1040) Profit or Loss From Business - ${year}`, 'Sole Proprietorship'),
    { size: 11, dy: -24, text: 'A  Principal business: Graphic Design Services' },
    { size: 10, dy: -14, text: 'B  Business name: Smith Design Studio' },
    { size: 10, dy: -14, text: 'C  Business code: 541430' },
    ...personBlock(),
    { size: 11, dy: -22, text: 'Part I - Income' },
    { size: 10, dy: -16, text: `1  Gross receipts or sales ................. $${gross}` },
    { size: 10, dy: -14, text: `7  Gross income ............................ $${gross}` },
    { size: 11, dy: -20, text: 'Part II - Expenses' },
    { size: 10, dy: -16, text: `28 Total expenses .......................... $${expenses}` },
    { size: 10, dy: -14, text: `31 Net profit or (loss) .................... $${net}` },
    { size: 9, dy: -22, text: `Tax Year: ${year}` },
  ];
}

function k1Rows(year, ordinaryIncome, interestIncome, guaranteedPayments, selfEmployment, distributions) {
  return [
    ...header(`Schedule K-1 (Form 1065) - Tax Year ${year}`, "Partner's Share of Income, Deductions, Credits, etc."),
    { size: 11, dy: -24, text: 'Part I - Information About the Partnership' },
    { size: 10, dy: -16, text: 'A  Partnership EIN: 84-7291846' },
    { size: 10, dy: -14, text: 'B  Alpha Real Estate LLC' },
    { size: 10, dy: -14, text: '   500 Park Avenue, Suite 1200, New York, NY 10022' },
    { size: 11, dy: -20, text: 'Part II - Information About the Partner' },
    { size: 10, dy: -16, text: `E  Partner TIN: ${PERSONA.tin}` },
    { size: 10, dy: -14, text: `F  ${PERSONA.name}` },
    { size: 10, dy: -14, text: `   ${PERSONA.address}` },
    { size: 10, dy: -14, text: 'H  Profit / Loss / Capital sharing: 2.5000% / 2.5000% / 2.5000%' },
    { size: 11, dy: -20, text: "Part III - Partner's Share of Current Year Income" },
    { size: 10, dy: -16, text: `1   Ordinary business income (loss) ............... $${ordinaryIncome}` },
    { size: 10, dy: -14, text: `4c  Total guaranteed payments .................... $${guaranteedPayments}` },
    { size: 10, dy: -14, text: `5   Interest income ............................... $${interestIncome}` },
    { size: 10, dy: -14, text: `14  Self-employment earnings (loss) .............. $${selfEmployment}` },
    { size: 10, dy: -14, text: `19  Distributions ................................. $${distributions}` },
    { size: 9, dy: -22, text: `OMB No. 1545-0123 - Calendar year ${year}` },
  ];
}

function bankStatementRows() {
  return [
    ...header('Chase Total Checking - Statement', 'January 2025'),
    { size: 10, dy: -24, text: `Account holder: ${PERSONA.name}` },
    { size: 10, dy: -14, text: 'Account ending: ****4821' },
    { size: 11, dy: -22, text: 'Statement summary' },
    { size: 10, dy: -16, text: 'Beginning balance .......................... $4,218.44' },
    { size: 10, dy: -14, text: 'Deposits and additions ..................... $6,850.00' },
    { size: 10, dy: -14, text: 'ATM & debit card withdrawals ............... -$1,942.18' },
    { size: 10, dy: -14, text: 'Ending balance ............................. $8,126.26' },
    { size: 9, dy: -22, text: 'NOT A TAX FORM - Bank statement for demo unexpected-doc testing' },
  ];
}

function receiptRows() {
  return [
    ...header('Office Supply Receipt', 'Staples #1842 - March 14, 2025'),
    { size: 10, dy: -24, text: `Customer: ${PERSONA.name}` },
    { size: 10, dy: -14, text: 'HP Printer Paper (5 reams) ................. $42.99' },
    { size: 10, dy: -14, text: 'Pens & folders ............................. $18.47' },
    { size: 10, dy: -14, text: 'NJ sales tax ............................... $4.06' },
    { size: 10, dy: -14, text: 'Total ...................................... $65.52' },
    { size: 9, dy: -22, text: 'NOT A TAX FORM - Receipt for demo unexpected-doc testing' },
  ];
}

// ── Document catalog ────────────────────────────────────────────────────────

const AMOUNTS = {
  2024: {
    w2: { wages: '185,400', fed: '38,200' },
    '1098': { interest: '14,820', principal: '412,500' },
    '1099-int': { interest: '1,245' },
    '1099-nec': { compensation: '48,500' },
    'sched-c': { gross: '52,000', expenses: '18,400', net: '33,600' },
    k1: { ordinary: '12,450', interest: '125', guaranteed: '0', se: '12,450', dist: '8,000' },
  },
  2025: {
    w2: { wages: '207,200', fed: '42,850' },
    '1098': { interest: '13,650', principal: '398,200' },
    '1099-int': { interest: '1,890' },
    '1099-nec': { compensation: '62,750' },
    'sched-c': { gross: '68,200', expenses: '21,350', net: '46,850' },
    k1: { ordinary: '18,920', interest: '210', guaranteed: '3,600', se: '22,520', dist: '12,500' },
  },
};

const DOC_BUILDERS = {
  w2: (year) => buildPdf(w2Rows(year, AMOUNTS[year].w2.wages, AMOUNTS[year].w2.fed)),
  '1098': (year) => buildPdf(form1098Rows(year, AMOUNTS[year]['1098'].interest, AMOUNTS[year]['1098'].principal)),
  '1099-int': (year) => buildPdf(form1099IntRows(year, AMOUNTS[year]['1099-int'].interest)),
  '1099-nec': (year) => buildPdf(form1099NecRows(year, AMOUNTS[year]['1099-nec'].compensation)),
  'sched-c': (year) => buildPdf(scheduleCRows(year, AMOUNTS[year]['sched-c'].gross, AMOUNTS[year]['sched-c'].expenses, AMOUNTS[year]['sched-c'].net)),
  k1: (year) => buildPdf(k1Rows(year, AMOUNTS[year].k1.ordinary, AMOUNTS[year].k1.interest, AMOUNTS[year].k1.guaranteed, AMOUNTS[year].k1.se, AMOUNTS[year].k1.dist)),
};

const FILE_NAMES = {
  w2: (year) => `W2_${year}_Goldman.pdf`,
  '1098': (year) => `1098_${year}_WellsFargo.pdf`,
  '1099-int': (year) => `1099-INT_${year}_Fidelity.pdf`,
  '1099-nec': (year) => `1099-NEC_${year}_BrightPath.pdf`,
  'sched-c': (year) => `ScheduleC_${year}_SmithDesign.pdf`,
  k1: (year) => `K1_${year}_AlphaPartnership.pdf`,
};

const PROFESSIONS = {
  employee: ['w2', '1098', '1099-int'],
  freelancer: ['w2', '1099-nec', '1098', 'sched-c'],
  partnership: ['w2', '1099-nec', '1098', 'sched-c', 'k1'],
};

const YEARS = ['2024', '2025'];

const manifest = [];

function writePdf(relativePath, content) {
  const full = join(OUT_DIR, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  console.log('Wrote', relativePath);
}

function primaryAmount(docType, year) {
  const a = AMOUNTS[year][docType];
  if (!a) return null;
  if (docType === 'w2') return parseInt(a.wages.replace(/,/g, ''), 10);
  if (docType === '1098') return parseInt(a.interest.replace(/,/g, ''), 10);
  if (docType === '1099-int') return parseInt(a.interest.replace(/,/g, ''), 10);
  if (docType === '1099-nec') return parseInt(a.compensation.replace(/,/g, ''), 10);
  if (docType === 'sched-c') return parseInt(a.net.replace(/,/g, ''), 10);
  if (docType === 'k1') return parseInt(a.ordinary.replace(/,/g, ''), 10);
  return null;
}

const PAYER_LABELS = {
  w2: 'Goldman Sachs & Co. LLC',
  '1098': 'Wells Fargo Bank, N.A.',
  '1099-int': 'Fidelity Investments',
  '1099-nec': 'Bright Path Consulting LLC',
  'sched-c': 'Smith Design Studio',
  k1: 'Alpha Real Estate LLC',
};

// Generate profession bundles + flat root copies
for (const [profession, docTypes] of Object.entries(PROFESSIONS)) {
  for (const year of YEARS) {
    for (const docType of docTypes) {
      const fileName = FILE_NAMES[docType](year);
      const pdf = DOC_BUILDERS[docType](year);
      const bundlePath = join(profession, year, fileName);
      writePdf(bundlePath, pdf);
      writePdf(fileName, pdf);

      manifest.push({
        fileName,
        relativePath: bundlePath.replace(/\\/g, '/'),
        profession,
        taxYear: year,
        docType,
        payerOrEmployer: PAYER_LABELS[docType],
        primaryAmount: primaryAmount(docType, year),
        primaryField:
          docType === 'w2' ? 'wages'
          : docType === '1098' ? 'mortgage_interest'
          : docType === '1099-int' ? 'interest_income'
          : docType === '1099-nec' ? 'nonemployee_compensation'
          : docType === 'sched-c' ? 'net_profit'
          : 'ordinary_business_income',
      });
    }
  }
}

// Negative-test documents (flat only)
writePdf('BankStatement_Jan2025.pdf', buildPdf(bankStatementRows()));
writePdf('Receipt_OfficeSupply_2025.pdf', buildPdf(receiptRows()));
// Legacy generic 1099-NEC for wrong-type slot testing
writePdf('1099-NEC_2025.pdf', DOC_BUILDERS['1099-nec']('2025'));

// TypeScript manifest for YoY compare in app
const ts = `/** AUTO-GENERATED by scripts/generate-sample-tax-pdfs.mjs — do not edit manually */\n\nexport interface DemoTaxDocumentEntry {
  fileName: string;
  relativePath: string;
  profession: 'employee' | 'freelancer' | 'partnership';
  taxYear: string;
  docType: string;
  payerOrEmployer: string;
  primaryAmount: number;
  primaryField: string;
}

export const DEMO_TAX_DOCUMENT_MANIFEST: DemoTaxDocumentEntry[] = ${JSON.stringify(manifest, null, 2)};

export const PROFESSION_SAMPLE_BUNDLES = ${JSON.stringify(PROFESSIONS, null, 2)} as const;

export function lookupDemoDocument(fileName: string): DemoTaxDocumentEntry | undefined {
  return DEMO_TAX_DOCUMENT_MANIFEST.find(
    (d) => d.fileName.toLowerCase() === fileName.toLowerCase(),
  );
}

export function demoDocumentsForProfession(
  profession: keyof typeof PROFESSION_SAMPLE_BUNDLES,
  taxYear: string,
): DemoTaxDocumentEntry[] {
  return DEMO_TAX_DOCUMENT_MANIFEST.filter(
    (d) => d.profession === profession && d.taxYear === taxYear,
  );
}
`;

writeFileSync(MANIFEST_PATH, ts, 'utf8');
writeFileSync(EDGE_MANIFEST_JSON, JSON.stringify({ manifest, professions: PROFESSIONS }, null, 2), 'utf8');
console.log('Wrote', 'src/lib/demoTaxDocumentManifest.ts');
console.log('Wrote', 'supabase/functions/_shared/demoTaxDocumentManifest.json');
console.log(`Done — ${manifest.length} documents across 3 professions x 2 years`);
