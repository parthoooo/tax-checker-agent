import {
  DEMO_TAX_DOCUMENT_MANIFEST,
  type DemoTaxDocumentEntry,
} from '@/lib/demoTaxDocumentManifest';
import type { BusinessType } from '@/lib/taxConfig';

export const SAMPLE_DOCS_PUBLIC_BASE = '/sample-docs';

/** Extra root-level PDFs not tied to a profession bundle. */
export const EXTRA_SAMPLE_DOCS: { fileName: string; relativePath: string }[] = [
  { fileName: 'Receipt_OfficeSupply_2025.pdf', relativePath: 'Receipt_OfficeSupply_2025.pdf' },
  { fileName: 'BankStatement_Jan2025.pdf', relativePath: 'BankStatement_Jan2025.pdf' },
];

export function sampleDocPublicUrl(relativePath: string): string {
  return `${SAMPLE_DOCS_PUBLIC_BASE}/${relativePath}`;
}

export interface SampleDocBundle {
  profession: BusinessType;
  taxYear: string;
  documents: DemoTaxDocumentEntry[];
}

export function groupSampleDocsByProfessionYear(): SampleDocBundle[] {
  const professions: BusinessType[] = ['employee', 'freelancer', 'partnership'];
  const years = [...new Set(DEMO_TAX_DOCUMENT_MANIFEST.map((d) => d.taxYear))].sort(
    (a, b) => Number(b) - Number(a),
  );

  return professions.flatMap((profession) =>
    years.map((taxYear) => ({
      profession,
      taxYear,
      documents: DEMO_TAX_DOCUMENT_MANIFEST.filter(
        (d) => d.profession === profession && d.taxYear === taxYear,
      ),
    })),
  );
}

export async function downloadSampleDoc(entry: { fileName: string; relativePath: string }) {
  const url = sampleDocPublicUrl(entry.relativePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${entry.fileName}`);

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = entry.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadSampleDocs(
  entries: { fileName: string; relativePath: string }[],
  delayMs = 350,
) {
  for (let i = 0; i < entries.length; i++) {
    await downloadSampleDoc(entries[i]);
    if (i < entries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
